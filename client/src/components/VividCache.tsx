import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "../api";
import { useAuth } from "../App";
import { createCacheTickPlayer } from "../cacheSound";
import { playCoinSound } from "../emporiumAudio";
import { buildCacheReel, buildSpinPath, CACHE_WINNER_INDEX, CACHE_SPIN_DURATION_MS } from "../../../shared/vividCacheReel";
import CacheRewardArt from "./CacheRewardArt";
import "./VividCache.css";

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";
interface Reward {
  id: string; name: string; rarity: Rarity; weight: number; owned?: boolean; diceTheme?: string;
  preview: { symbol: string; description: string };
}
interface Result { requestId: string; reward: Reward; balance: number; cost: number; refund: number; duplicate: boolean }
interface Catalog { cost: number; balance: number; rewards: Reward[]; refunds: Record<Rarity, number>; pending: Result | null }
const rarities: Rarity[] = ["common", "rare", "epic", "legendary", "mythic"];
const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
const position = (index: number) => `translateX(calc(50% - ${index * 160 + 74}px))`;
// buildSpinPath starts on tile 2 and emits one tick per tile that arrives
// under the pointer, so tick i is the moment tile 3 + i is centred on it.
const FIRST_TICKED_TILE = 3;
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

export default function VividCache({ onChange, onPreviewDice }: { onChange: () => Promise<void>; onPreviewDice?: (theme: string) => void }) {
  const { user, setUser } = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [reel, setReel] = useState<Reward[]>([]);
  const [phase, setPhase] = useState<"idle" | "request" | "spin" | "reveal">("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const sound = useRef<ReturnType<typeof createCacheTickPlayer>>(null);
  const lock = useRef(false);
  const strip = useRef<HTMLDivElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const requestId = useRef<string | null>(null);
  const storageKey = `vivid-cache-request:${user?.id}`;

  useEffect(() => {
    let active = true;
    api<Catalog>("/api/shop/cache").then(data => {
      if (!active) return;
      setCatalog(data);
      if (data.pending) {
        setResult(data.pending); setReel(buildCacheReel(data.rewards, data.pending.reward)); setPhase("reveal");
      }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; sound.current?.dispose(); sound.current = null; };
  }, []);

  useEffect(() => {
    if (phase !== "spin" || !strip.current || !result) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reelEl = strip.current;
    const windowEl = reelEl.parentElement!;
    const pointer = windowEl.querySelector<HTMLElement>(".cache-pointer")!;
    const flare = windowEl.querySelector<HTMLElement>(".cache-flare")!;
    const burst = windowEl.querySelector<HTMLElement>(".cache-burst")!;
    const won = result.reward.rarity;
    // The strip, the ticks, the flares and the "still fast" window all read the same curve.
    const path = buildSpinPath();
    const animation = reelEl.animate(
      path.positions.map(index => ({ transform: position(index), easing: "linear" })),
      { duration: reduced.matches ? 0 : CACHE_SPIN_DURATION_MS, fill: "forwards" },
    );
    const finish = () => animation.finish();
    reduced.addEventListener("change", finish);
    let active = true;
    let frame = 0;
    let nextTick = 0;
    let pointerTimer = 0;
    const started = performance.now();

    // Everything here lands on the one pointer, the one flare layer and the one
    // burst -- never on tiles. The strip is ~10,400px wide; repainting tiles
    // inside it mid-spin is what made this lag before.
    const light = (rarity: Rarity | "launch", strength: number, duration: number) => {
      flare.className = `cache-flare ${rarity === "launch" ? "is-launch" : `rarity-${rarity}`}`;
      flare.animate([{ opacity: 0 }, { opacity: strength, offset: 0.16 }, { opacity: 0 }], { duration, easing: EASE_OUT });
    };
    const catchPointer = (rarity: Rarity) => {
      pointer.className = `cache-pointer rarity-${rarity} is-caught`;
      window.clearTimeout(pointerTimer);
      pointerTimer = window.setTimeout(() => { pointer.className = "cache-pointer"; }, rarity === "mythic" ? 620 : 420);
    };
    // Classes and WAAPI rather than state: a re-render per frame of an
    // eleven-second animation over a 65-tile strip is exactly what to avoid.
    const followReel = () => {
      const elapsed = performance.now() - started;
      let passing: Reward | null = null;
      while (nextTick < path.tickTimes.length && path.tickTimes[nextTick] <= elapsed) {
        const tile = reel[FIRST_TICKED_TILE + nextTick];
        if (tile && (!passing || RANK[tile.rarity] > RANK[passing.rarity])) passing = tile;
        nextTick++;
      }
      if (passing) {
        const slow = elapsed >= path.settleAt;
        // createCacheTickPlayer checks the table's sound mute on every tick.
        sound.current?.tick(passing.rarity, slow);
        // A big tile crossing the pointer is the point of the whole spin:
        // make it impossible to miss, loudest when it creeps past at the end.
        if (RANK[passing.rarity] >= RANK.epic) catchPointer(passing.rarity);
        if (RANK[passing.rarity] >= RANK.legendary) light(passing.rarity, passing.rarity === "mythic" ? (slow ? 1 : 0.8) : 0.6, slow ? 900 : 620);
      }
      if (elapsed >= path.settleAt) { windowEl.classList.remove("is-fast"); windowEl.classList.add("is-closing"); }
      frame = requestAnimationFrame(followReel);
    };

    const land = () => {
      if (reduced.matches) {
        // Reduced motion keeps the meaning -- what you won, and how rare --
        // as a gentle light change, with no rings and no knock.
        if (RANK[won] >= RANK.legendary) light(won, 0.5, 700);
        return;
      }
      sound.current?.land(won);
      windowEl.classList.add("is-hit");
      window.setTimeout(() => windowEl.classList.remove("is-hit"), 520);
      if (RANK[won] < RANK.epic) return;
      // The same shockwave vocabulary as the critical-roll overlays, scaled by rarity.
      burst.className = `cache-burst rarity-${won}`;
      const rings = burst.querySelectorAll<HTMLElement>(".cache-ring");
      const reach = won === "mythic" ? 3.4 : won === "legendary" ? 2.6 : 2;
      rings[0].animate([{ opacity: 1, transform: "scale(.35)" }, { opacity: 0, transform: `scale(${reach})` }], { duration: 900, easing: EASE_OUT });
      if (won === "mythic") {
        rings[1].animate([{ opacity: 1, transform: "scale(.3)" }, { opacity: 0, transform: "scale(4.6)" }], { duration: 1300, delay: 140, easing: EASE_OUT });
        light("mythic", 1, 1400);
      } else if (won === "legendary") light("legendary", 0.75, 900);
    };

    if (!reduced.matches) {
      reelEl.classList.add("is-spinning");
      windowEl.classList.add("is-fast");
      sound.current?.launch();
      light("launch", 0.9, 700);
      frame = requestAnimationFrame(followReel);
    }
    animation.finished.then(() => {
      if (!active) return;
      lock.current = false;
      cancelAnimationFrame(frame);
      reelEl.classList.remove("is-spinning");
      windowEl.classList.remove("is-fast", "is-closing");
      pointer.className = "cache-pointer";
      land();
      setPhase("reveal");
    }).catch(() => {});
    return () => {
      active = false; cancelAnimationFrame(frame); window.clearTimeout(pointerTimer);
      reduced.removeEventListener("change", finish); animation.cancel();
      reelEl.classList.remove("is-spinning"); windowEl.classList.remove("is-fast", "is-closing", "is-hit");
      pointer.className = "cache-pointer";
      sound.current?.dispose(); sound.current = null;
    };
  }, [phase, reel]);
  useEffect(() => {
    if (phase !== "reveal") return;
    // Focusing Continue scrolls it into view, which jumps the panel past the
    // reel just as the winning tile pops — the payoff played off-screen. Take
    // the focus without the scroll, let the tile land, then follow the eye
    // down to the reward.
    continueButton.current?.focus({ preventScroll: true });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const followUp = window.setTimeout(
      () => reveal.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" }),
      reduced ? 0 : 560,
    );
    if (result?.reward.rarity === "mythic") {
      void api<{ user: typeof user }>("/api/auth/me").then(data => setUser(data.user)).catch(() => {});
    }
    return () => window.clearTimeout(followUp);
  }, [phase]);

  const open = async () => {
    if (lock.current || phase !== "idle" || !catalog) return;
    lock.current = true; setPhase("request"); setError(""); setNotice("");
    sound.current?.dispose();
    sound.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : createCacheTickPlayer();
    try {
      requestId.current ||= localStorage.getItem(storageKey) || crypto.randomUUID();
      // Persist before sending: ambiguous network failures must retry this key.
      localStorage.setItem(storageKey, requestId.current);
      const selected = await api<Result>("/api/shop/cache/open", { method: "POST", body: JSON.stringify({ requestId: requestId.current }) });
      if (selected.cost) playCoinSound(); // a paid spin pays the merchant first; a free one doesn't pretend to
      setResult(selected); setCatalog({ ...catalog, balance: selected.balance });
      setReel(buildCacheReel(catalog.rewards, selected.reward)); setPhase("spin");
      void onChange().catch(() => {});
    } catch (e) { sound.current?.dispose(); sound.current = null; setError((e as Error).message + " Retry to recover the same opening safely."); setPhase("idle"); lock.current = false; }
  };
  const dismiss = async () => {
    if (!result || lock.current) return;
    lock.current = true; setError("");
    try {
      await api("/api/shop/cache/acknowledge", { method: "POST", body: JSON.stringify({ requestId: result.requestId }) });
      localStorage.removeItem(storageKey); requestId.current = null;
      const data = await api<Catalog>("/api/shop/cache");
      setCatalog(data); setResult(null); setPhase("idle"); setReel([]);
      void onChange().catch(() => {});
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; }
  };
  const equipDice = async (theme: string, name: string) => {
    try {
      await api("/api/auth/me/dice", { method: "PUT", body: JSON.stringify({ theme }) });
      if (user) setUser({ ...user, diceTheme: theme, ...(theme === "first-flame" ? { relicOwner: true } : {}) });
      setNotice(theme === "first-flame"
        ? "First Flame dice equipped. Open the bundle's features in the Emporium to equip its other pieces separately."
        : `${name} equipped. Your next roll uses them.`);
    } catch (e) { setError((e as Error).message); }
  };
  const mythic = phase === "reveal" && result?.reward.rarity === "mythic";
  const total = catalog?.rewards.reduce((n, r) => n + r.weight, 0) || 1;
  const cost = catalog?.cost;
  const busy = phase === "spin" || phase === "request";
  const ownedDice = catalog?.rewards.filter(r => r.diceTheme && (r.owned || (phase === "reveal" && result?.reward.id === r.id))) ?? [];
  // Legendary and mythic wins show their real odds -- the number is the brag.
  const odds = (reward: Reward) => RANK[reward.rarity] >= RANK.legendary
    ? ` · 1 in ${Math.round(total / reward.weight).toLocaleString()}` : "";
  return <section className={`vivid-cache ${mythic ? "is-mythic" : ""}`} aria-labelledby="cache-heading">
    <div className="cache-heading"><div><span className="cache-eyebrow">A SPARK OF SOMETHING ANCIENT</span><h2 id="cache-heading">Vivid Cache</h2><p>One cache. One cosmetic. A chance at the First Flame.</p></div>
      <div className="cache-wallet"><strong>{catalog?.balance ?? "—"} VCoins</strong><span>{cost === undefined ? "" : cost ? `${cost} VCoins per opening` : "Free to open"}</span></div></div>
    <div className="cache-reel-window" aria-hidden="true"><span className="cache-pointer" /><span className="cache-fade" /><span className="cache-flare" />
      <span className="cache-burst"><i className="cache-ring" /><i className="cache-ring" /></span>
      <div className="cache-reel" ref={strip} style={{ transform: position(reel.length && phase !== "spin" ? CACHE_WINNER_INDEX : 2) }}>
        {(reel.length ? reel : catalog?.rewards ?? []).map((reward, i) => <div key={i} className={`cache-tile rarity-${reward.rarity}${reel.length && phase === "reveal" && i === CACHE_WINNER_INDEX ? " is-winner" : ""}`}><CacheRewardArt id={reward.id} concealed={reward.rarity === "mythic"} /><small>{reward.rarity}</small><strong>{reward.name}</strong></div>)}
      </div>
    </div>
    <div className="cache-controls"><button type="button" className="cache-open" onClick={open} disabled={!catalog || phase !== "idle" || catalog.balance < catalog.cost}>{phase === "request" ? "Confirming…" : phase === "spin" ? "Opening…" : cost ? `Open Cache · ${cost} VCoins` : "Open Cache · Free"}</button><span role="status">{phase === "spin" ? "Your reward is secured. Revealing…" : "Fictional rewards · No cash value"}</span></div>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {phase === "reveal" && result && <div ref={reveal} className={`cache-reveal rarity-${result.reward.rarity}`} role="status">
      {mythic && <div className="cache-embers" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div>}
      <CacheRewardArt id={result.reward.id} concealed={result.reward.rarity === "mythic"} />
      <h3>{result.reward.name}</h3>
      <p className="cache-reveal-rarity">{result.reward.rarity}{odds(result.reward)}</p>
      <p>{result.reward.preview.description}</p>
      <p className="cache-reveal-status">{!result.duplicate ? "Added to your collection" : result.refund ? `Already owned · ${result.refund} VCoins refunded` : "Already in your collection"}</p>
      <div className="cache-reveal-actions">
        {result.reward.diceTheme && <button type="button" onClick={() => void equipDice(result.reward.diceTheme!, result.reward.name)}>Equip dice</button>}
        {result.reward.rarity !== "mythic" && result.reward.diceTheme && onPreviewDice && <button type="button" onClick={() => onPreviewDice(result.reward.diceTheme!)}>Roll them</button>}
        <button type="button" ref={continueButton} onClick={dismiss}>Continue</button>
      </div>
    </div>}
    {ownedDice.length > 0 && <div className="cache-owned-dice"><strong>Your mythic dice</strong>
      {ownedDice.map(r => <span key={r.id} className="cache-owned-die">{r.name}
        <button type="button" disabled={busy || user?.diceTheme === r.diceTheme} onClick={() => void equipDice(r.diceTheme!, r.name)}>{user?.diceTheme === r.diceTheme ? "Equipped" : "Equip"}</button>
        {r.rarity !== "mythic" && onPreviewDice && <button type="button" disabled={busy} onClick={() => onPreviewDice(r.diceTheme!)}>Roll</button>}
      </span>)}
    </div>}
    <ul className="cache-legend" aria-label="Rarity odds and duplicate refunds">{rarities.map(rarity => <li key={rarity} className={`rarity-${rarity}`}><strong>{rarity}</strong><span>{((catalog?.rewards.filter(r => r.rarity === rarity).reduce((n, r) => n + r.weight, 0) ?? 0) / total * 100).toFixed(1)}%</span><small>{!catalog ? "—" : catalog.refunds[rarity] ? `Duplicate: ${catalog.refunds[rarity]} VCoins` : "No duplicate refund while free"}</small></li>)}</ul>
      <details><summary>Reward collection & how it works</summary>
      <p>Your reward is decided before the reel moves, and every opening uses the odds above. The rare items you see flying past are placed in the reel for show and never change what you get.{cost ? " Duplicate cosmetics become a partial refund." : " While opening is free, duplicates don't refund VCoins."}</p>
      <ul className="cache-collection">{catalog?.rewards.map(r => <li key={r.id}>{r.name} · {r.rarity} · {r.owned ? "Owned" : "Not owned"}</li>)}</ul>
    </details>
  </section>;
}
