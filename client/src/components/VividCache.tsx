import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "../api";
import { useAuth } from "../App";
import { createCacheTickPlayer } from "../cacheSound";
import { playCoinSound } from "../emporiumAudio";
import { buildCacheReel, buildSpinPath, CACHE_WINNER_INDEX, CACHE_SPIN_DURATION_MS } from "../../../shared/vividCacheReel";
import { previewDice } from "../dice3d";
import { FIRST_FLAME } from "../diceCosmetics";
import "./VividCache.css";

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";
interface Reward {
  id: string; name: string; rarity: Rarity; weight: number; owned?: boolean;
  preview: { symbol: string; description: string };
}
interface Result { requestId: string; reward: Reward; balance: number; cost: number; refund: number; duplicate: boolean }
interface Catalog { cost: number; balance: number; rewards: Reward[]; refunds: Record<Rarity, number>; pending: Result | null }
const rarities: Rarity[] = ["common", "rare", "epic", "legendary", "mythic"];
const position = (index: number) => `translateX(calc(50% - ${index * 160 + 74}px))`;

export default function VividCache({ onChange, onPreviewDice }: { onChange: () => Promise<void>; onPreviewDice?: () => void }) {
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
    if (phase !== "spin" || !strip.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reelEl = strip.current;
    const windowEl = reelEl.parentElement;
    // The strip, the ticks and the "still fast" window all read the same curve.
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
    const started = performance.now();
    // Classes rather than state: a re-render per frame of an eleven-second
    // animation over a 65-tile strip is exactly what this is trying to avoid.
    const followReel = () => {
      const elapsed = performance.now() - started;
      let crossed = false;
      while (nextTick < path.tickTimes.length && path.tickTimes[nextTick] <= elapsed) { nextTick++; crossed = true; }
      // createCacheTickPlayer checks the table's sound mute on every tick.
      if (crossed) sound.current?.tick();
      if (elapsed >= path.settleAt) windowEl?.classList.remove("is-fast");
      frame = requestAnimationFrame(followReel);
    };
    if (!reduced.matches) {
      reelEl.classList.add("is-spinning");
      windowEl?.classList.add("is-fast");
      frame = requestAnimationFrame(followReel);
    }
    animation.finished.then(() => {
      if (!active) return;
      lock.current = false;
      reelEl.classList.remove("is-spinning");
      windowEl?.classList.remove("is-fast");
      if (!reduced.matches) {
        windowEl?.classList.add("is-hit");
        window.setTimeout(() => windowEl?.classList.remove("is-hit"), 520);
      }
      setPhase("reveal");
    }).catch(() => {});
    return () => {
      active = false; cancelAnimationFrame(frame); reduced.removeEventListener("change", finish); animation.cancel();
      reelEl.classList.remove("is-spinning"); windowEl?.classList.remove("is-fast", "is-hit");
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
      playCoinSound(); // the spin is a purchase too — pay the merchant first
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
  const equipDice = async () => {
    try {
      await api("/api/auth/me/dice", { method: "PUT", body: JSON.stringify({ theme: "first-flame" }) });
      if (user) setUser({ ...user, diceTheme: "first-flame", relicOwner: true });
      setNotice("First Flame dice equipped. Open the bundle's features in the Emporium to equip its other pieces separately.");
    } catch (e) { setError((e as Error).message); }
  };
  const mythic = phase === "reveal" && result?.reward.rarity === "mythic";
  const total = catalog?.rewards.reduce((n, r) => n + r.weight, 0) || 1;
  const ownsRelic = catalog?.rewards.some(r => r.id === "relic-first-flame" && r.owned) || (phase === "reveal" && result?.reward.id === "relic-first-flame");
  return <section className={`vivid-cache ${mythic ? "is-mythic" : ""}`} aria-labelledby="cache-heading">
    <div className="cache-heading"><div><span className="cache-eyebrow">A SPARK OF SOMETHING ANCIENT</span><h2 id="cache-heading">Vivid Cache</h2><p>One cache. One cosmetic. A chance at the First Flame.</p></div>
      <div className="cache-wallet"><strong>{catalog?.balance ?? "—"} VCoins</strong><span>{catalog?.cost ?? 500} VCoins per opening</span></div></div>
    <div className="cache-reel-window" aria-hidden="true"><span className="cache-pointer" /><span className="cache-fade" />
      <div className="cache-reel" ref={strip} style={{ transform: position(reel.length && phase !== "spin" ? CACHE_WINNER_INDEX : 2) }}>
        {(reel.length ? reel : catalog?.rewards ?? []).map((reward, i) => <div key={i} className={`cache-tile rarity-${reward.rarity}${reel.length && phase === "reveal" && i === CACHE_WINNER_INDEX ? " is-winner" : ""}`}><span className="cache-symbol">{reward.preview.symbol}</span><small>{reward.rarity}</small><strong>{reward.name}</strong></div>)}
      </div>
    </div>
    <div className="cache-controls"><button type="button" onClick={open} disabled={!catalog || phase !== "idle" || catalog.balance < catalog.cost}>{phase === "request" ? "Confirming…" : phase === "spin" ? "Opening…" : `Open Cache · ${catalog?.cost ?? 500} VCoins`}</button><span role="status">{phase === "spin" ? "Your reward is secured. Revealing…" : "Fictional rewards · No cash value"}</span></div>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {phase === "reveal" && result && <div ref={reveal} className={`cache-reveal rarity-${result.reward.rarity}`} role="status">
      {mythic && <div className="cache-embers" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div>}
      <span className="cache-eyebrow">{result.reward.rarity.toUpperCase()}</span><h3>{result.reward.name}</h3><p>{result.reward.preview.description}</p>
      <p>{result.duplicate ? `Already owned · ${result.refund} VCoins refunded` : "Added to your collection"}</p>
      <button type="button" ref={continueButton} onClick={dismiss}>Continue</button>
    </div>}
    {ownsRelic && <p className="cache-relic-owned">◆ Relic Owner <button type="button" onClick={equipDice}>Equip First Flame dice</button> <button type="button" disabled={phase === "spin" || phase === "request"} onClick={() => onPreviewDice ? onPreviewDice() : void previewDice(FIRST_FLAME.id)}>Preview {FIRST_FLAME.label}</button></p>}
    <ul className="cache-legend" aria-label="Rarity odds and duplicate refunds">{rarities.map(rarity => <li key={rarity} className={`rarity-${rarity}`}><strong>{rarity}</strong><span>{((catalog?.rewards.filter(r => r.rarity === rarity).reduce((n, r) => n + r.weight, 0) ?? 0) / total * 100).toFixed(1)}%</span><small>Duplicate: {catalog?.refunds[rarity] ?? "—"} VCoins</small></li>)}</ul>
      <details><summary>Reward collection & how it works</summary>
      <p>Each opening uses the same odds. Duplicate cosmetics become a partial refund. Reel neighbors are decorative random draws and do not change your reward.</p>
      <ul className="cache-collection">{catalog?.rewards.map(r => <li key={r.id}>{r.name} · {r.rarity} · {r.owned ? "Owned" : "Not owned"}</li>)}</ul>
    </details>
  </section>;
}
