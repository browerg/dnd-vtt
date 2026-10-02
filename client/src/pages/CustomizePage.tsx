import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, uploadImage, type User } from "../api";
import { useAuth } from "../App";
import { BACKGROUNDS, CUSTOM_PREFIX, customImageUrl, getBackground, setBackground } from "../background";
import { DEFAULT_DICE_CUSTOMIZATION, decodeDiceCustomization, encodeDiceCustomization, type DiceCustomization } from "../diceCustomization";
import { getDiceTrailStyle, previewDice, setDiceTrailStyle, type DiceTrailStyle } from "../dice3d";
import { CATEGORIES, diceCollection, type Category, type CollectionItem, type CollectionShop, type DicePreset } from "../customizeCollection";
import CollectionDicePreview, { DiceThumbnail } from "../components/CollectionDicePreview";
import CollectionDiceEditor from "../components/CollectionDiceEditor";
import CacheRewardArt from "../components/CacheRewardArt";
import TurnStartEffect from "../components/TurnStartEffect";
import { PROFILE_PALETTES } from "../components/ProfileIdentity";
import "../components/RelicAppearance.css";
import "./CustomizePage.css";

function CategoryIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    dice: "m12 2 9 5v10l-9 5-9-5V7Zm0 0v10m9-5-9 5-9-5m9 5v10",
    "dice-trail": "M2 9c5-10 8 10 14 0s8 0 6 1M2 17c5-10 8 10 14 0",
    "nat20-effect": "m12 2 2 7 8 3-8 2-2 8-2-8-8-2 8-3Z",
    "nat1-effect": "m13 2-4 8 6 3-4 9M4 5l3 3m10 8 3 3M3 15l4-1m10-5 4-2",
    "turn-start-effect": "M12 3a9 9 0 1 1-8 5M3 3v6h6m3-3v6l4 2",
    "token-border": "M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20m0 4a6 6 0 1 0 0 12 6 6 0 1 0 0-12",
    profile: "M16 7a4 4 0 1 1-8 0 4 4 0 1 1 8 0M4 22v-3a8 8 0 0 1 16 0v3Z",
    table: "M3 3h18v18H3ZM3 17l6-6 4 4 3-3 5 5M8 7h.01",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind] || paths.profile} /></svg>;
}
const rarityName = (rarity: string) => rarity === "custom" ? "Custom design" : rarity.charAt(0).toUpperCase() + rarity.slice(1);

export default function CustomizePage() {
  const { user, setUser } = useAuth();
  const [shop, setShop] = useState<CollectionShop | null>(null);
  const [presets, setPresets] = useState<DicePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>("dice");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("all");
  const [diceTab, setDiceTab] = useState("all");
  const [mobileDetail, setMobileDetail] = useState(false);
  const [wide, setWide] = useState(() => matchMedia("(min-width: 651px)").matches);
  useEffect(() => { const query = matchMedia("(min-width: 651px)"); const sync = () => setWide(query.matches); query.addEventListener("change", sync); return () => query.removeEventListener("change", sync); }, []);
  const [sides, setSides] = useState(20);
  const [trail, setTrail] = useState(getDiceTrailStyle);
  const [bg, setBg] = useState(getBackground);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workshop, setWorkshop] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [settings, setSettings] = useState<DiceCustomization>({ ...DEFAULT_DICE_CUSTOMIZATION });
  const [name, setName] = useState("");
  const [savedSignature, setSavedSignature] = useState("");
  const [turnPreview, setTurnPreview] = useState(0);
  const turnTimer = useRef<ReturnType<typeof setTimeout>>();
  const heading = useRef<HTMLHeadingElement>(null);
  const draftTheme = useMemo(() => encodeDiceCustomization(settings), [settings]);
  const signature = name + "|" + draftTheme;
  const dirty = signature !== savedSignature;
  const dice = useMemo(() => diceCollection(shop, presets, user), [shop, presets, user]);
  const owned = shop?.items.filter(item => item.owned) ?? [];
  const palettes: CollectionItem[] = PROFILE_PALETTES.map(palette => ({ id: `palette-${palette.id}`, effect: palette.id, name: palette.name, description: "A color palette for your public profile.", rarity: "starter", type: "palette", owned: true }));
  const profileItems: CollectionItem[] = [...owned.filter(item => item.type === "chat-flair"), ...palettes,
    ...(user?.relicOwner ? [{ id: "title-relic-owner", effect: "relic-owner", name: "Relic Owner", description: "Your earned title appears automatically on your profile.", rarity: "mythic", type: "title", owned: true }] : [])];
  const backdropItems: CollectionItem[] = BACKGROUNDS.map(background => ({ id: `background-${background.key}`, effect: background.key, name: background.name, description: "A backdrop behind your tabletop. Saved on this device.", rarity: "starter", type: "background", owned: true }));
  if (bg.startsWith(CUSTOM_PREFIX)) backdropItems.push({ id: "background-upload", effect: bg, name: "Your image", description: "Your uploaded table backdrop. Saved on this device.", rarity: "custom", type: "background", owned: true });
  const categoryItems = category === "dice" ? dice : category === "profile" ? profileItems : category === "table" ? backdropItems : owned.filter(item => item.type === category);
  const filtered = categoryItems.filter(item => (rarity === "all" || item.rarity === rarity) && (category !== "dice" || diceTab === "all" || item.rarity === "custom") && (item.name + " " + item.description).toLowerCase().includes(search.toLowerCase()));
  const equipped = (item: CollectionItem) => item.type === "dice" ? (user?.diceTheme || "white") === item.theme : item.type === "dice-trail" ? trail === item.effect : item.type === "palette" ? (user?.profileStyle || "astral") === item.effect : item.type === "background" ? bg === item.effect : item.type === "title" ? true : !!item.slot && shop?.equipped[item.slot] === item.id;
  const selected = categoryItems.find(item => item.id === selectedId) ?? filtered.find(equipped) ?? filtered[0];
  const currentCategory = CATEGORIES.find(item => item.id === category)!;
  const currentDice = dice.find(item => equipped(item));
  const currentTrail = owned.find(item => item.type === "dice-trail" && equipped(item));

  async function load() {
    setLoading(true); setError("");
    try {
      const [catalogue, designs] = await Promise.all([api<CollectionShop>("/api/shop"), api<{ presets: DicePreset[] }>("/api/auth/me/dice-presets")]);
      setShop(catalogue); setPresets(designs.presets);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't load your collection."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); return () => clearTimeout(turnTimer.current); }, []);
  useEffect(() => {
    if (!workshop || !dirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [workshop, dirty]);
  const canLeave = () => !workshop || !dirty || window.confirm("Discard the changes to this dice design?");
  function switchCategory(value: Category) {
    if (busy || !canLeave()) return;
    window.scrollTo(0, 0); setCategory(value); setWorkshop(false); setSelectedId(""); setSearch(""); setRarity("all"); setDiceTab("all"); setMobileDetail(false); setNotice(""); setError("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function action(run: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try { await run(); } catch (cause) { setError(cause instanceof Error ? cause.message : "That didn't work. Please try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function equipTheme(theme: string) {
    await api("/api/auth/me/dice", { method: "PUT", body: JSON.stringify({ theme }) });
    if (user) setUser({ ...user, diceTheme: theme });
  }
  const equipItem = (item: CollectionItem) => action(async () => {
    if (item.type === "dice") await equipTheme(item.theme!);
    else if (item.type === "dice-trail") { setDiceTrailStyle(item.effect as DiceTrailStyle); setTrail(item.effect as DiceTrailStyle); }
    else if (item.type === "background") { setBackground(item.effect); setBg(item.effect); }
    else if (item.type === "palette" && user) {
      const response = await api<{ user: User }>("/api/auth/me/profile", { method: "PUT", body: JSON.stringify({ displayName: user.display_name, pronouns: user.pronouns ?? "", bio: user.bio ?? "", avatarPath: user.avatarPath ?? "", profileStyle: item.effect }) }); setUser(response.user);
    } else if (item.slot) {
      const response = await api<{ equipped: Record<string, string> }>("/api/shop/equip", { method: "POST", body: JSON.stringify({ cosmeticId: item.id }) });
      setShop(current => current ? { ...current, equipped: response.equipped } : current);
    }
    setNotice(`Equipped ${item.name}.`);
  });
  const clearItem = (item: CollectionItem) => action(async () => {
    await api("/api/shop/appearance/clear", { method: "POST", body: JSON.stringify({ slot: item.slot }) });
    setShop(current => current ? { ...current, equipped: { ...current.equipped, [item.slot!]: "" } } : current); setNotice(`Removed ${item.name}.`);
  });
  const preview = (item: CollectionItem) => action(async () => {
    if (item.type === "dice") await previewDice(item.theme!);
    else if (item.type === "dice-trail") await previewDice(user?.diceTheme || "white", item.effect as DiceTrailStyle);
    else if (item.type === "nat20-effect" || item.type === "nat1-effect") window.dispatchEvent(new CustomEvent("tabletop:critical-roll", { detail: { kind: item.type === "nat20-effect" ? "nat20" : "nat1", effect: item.effect, preview: true, userName: user?.display_name || "Preview", label: item.name } }));
    else if (item.type === "turn-start-effect") { clearTimeout(turnTimer.current); setTurnPreview(Date.now()); turnTimer.current = setTimeout(() => setTurnPreview(0), 1800); }
    setNotice(`Previewed ${item.name}. Your equipment hasn't changed.`);
  });
  function openWorkshop(item?: CollectionItem) {
    if (!canLeave()) return;
    const custom = decodeDiceCustomization(item?.theme ?? "") ?? { ...DEFAULT_DICE_CUSTOMIZATION };
    const title = item?.preset?.name ?? (item?.rarity === "custom" ? "My dice" : "");
    setSettings(custom); setName(title); setEditingId(item?.preset?.id ?? null); setSavedSignature(title + "|" + encodeDiceCustomization(custom));
    window.scrollTo(0, 0); setWorkshop(true); setCategory("dice"); setMobileDetail(false); setNotice(""); setError("");
  }
  const saveDesign = () => action(async () => {
    if (!name.trim()) throw new Error("Give your design a name first.");
    if (editingId === null && presets.length >= 5) throw new Error("You can save up to five dice designs.");
    const response = await api<{ preset: DicePreset }>(`/api/auth/me/dice-presets${editingId === null ? "" : `/${editingId}`}`, { method: editingId === null ? "POST" : "PUT", body: JSON.stringify({ name: name.trim(), theme: draftTheme }) });
    setPresets(current => editingId === null ? [...current, response.preset] : current.map(preset => preset.id === editingId ? response.preset : preset));
    setEditingId(response.preset.id); setName(response.preset.name); setSavedSignature(response.preset.name + "|" + draftTheme); setSelectedId(`preset-${response.preset.id}`); setNotice(`Saved ${response.preset.name}.`);
  });
  const deleteDesign = (item: CollectionItem) => {
    if (!item.preset || !window.confirm(`Delete “${item.name}” from your saved designs? Your equipped dice will remain unchanged.`)) return;
    void action(async () => { await api(`/api/auth/me/dice-presets/${item.preset!.id}`, { method: "DELETE" }); setPresets(current => current.filter(preset => preset.id !== item.preset!.id)); setSelectedId(""); setNotice(`Deleted ${item.name}.`); });
  };
  const upload = (file: File) => action(async () => { const url = await uploadImage(file); const value = CUSTOM_PREFIX + url; setBackground(value); setBg(value); setSelectedId("background-upload"); setNotice("Your table backdrop is ready."); });
  function art(item: CollectionItem) {
    if (item.type === "dice") return <DiceThumbnail theme={item.theme!} />;
    if (item.type === "background") return <span className="collection-backdrop-art" style={{ background: item.effect.startsWith(CUSTOM_PREFIX) ? `center / cover url("${customImageUrl(item.effect)}")` : BACKGROUNDS.find(value => value.key === item.effect)?.css || "#171b23" }} />;
    if (item.type === "palette") return <span className="collection-profile-art" style={{ color: PROFILE_PALETTES.find(value => value.id === item.effect)?.color }}><span>{user?.display_name?.slice(0, 1) || "V"}</span><i /> <i /></span>;
    if (item.type === "chat-flair") return <span className="collection-chat-art"><strong className="relic-chat-name">{user?.display_name}</strong><span>Ready for the next adventure.</span></span>;
    if (item.type === "title") return <span className="collection-title-art">Relic Owner<span>Mythic title</span></span>;
    if (item.type === "token-border") return <span className="relic-preview-token">{shop?.previewCharacter?.imageUrl ? <img src={shop.previewCharacter.imageUrl} alt="" /> : <strong>{(shop?.previewCharacter?.name || user?.display_name || "V").slice(0, 1)}</strong>}<span className="relic-token-ring" /></span>;
    if (item.type === "turn-start-effect") return <span className="collection-turn-art"><CategoryIcon kind={item.type} /><TurnStartEffect effect={item.effect} staticPreview /></span>;
    return <CacheRewardArt id={item.effect} />;
  }
  const counter = (id: Category) => id === "dice" ? dice.length : id === "profile" ? profileItems.length : id === "table" ? backdropItems.length : owned.filter(item => item.type === id).length;
  return <div className={`customize-vault${workshop ? " is-workshop" : ""}${mobileDetail ? " show-detail" : ""}`}>
    <a className="collection-skip" href="#collection-content">Skip to collection</a>
    <header className="collection-topbar"><Link className="collection-wordmark" to="/" onClick={e => { if (!canLeave()) e.preventDefault(); }}>Vivid Realms</Link><nav aria-label="Main navigation"><Link to="/" onClick={e => { if (!canLeave()) e.preventDefault(); }}>Campaigns</Link><Link to="/customize" aria-current="page">Customize</Link><Link to="/emporium" onClick={e => { if (!canLeave()) e.preventDefault(); }}>Emporium</Link></nav><Link className="collection-avatar" to="/profile" aria-label="Your profile" onClick={e => { if (!canLeave()) e.preventDefault(); }}>{user?.avatarPath ? <img src={user.avatarPath} alt="" /> : user?.display_name?.slice(0, 1)}</Link></header>
    <div className="collection-layout">
      <aside className="collection-sidebar"><h2>Your collection</h2><nav aria-label="Cosmetic categories">{CATEGORIES.map(item => <button key={item.id} aria-current={category === item.id ? "page" : undefined} disabled={busy} onClick={() => switchCategory(item.id)}><CategoryIcon kind={item.id} /><span>{item.name}</span><small>{loading ? "—" : counter(item.id)}</small></button>)}</nav>
        <section className="collection-equipped"><h2>Currently equipped</h2>{[
          { label: "Dice", item: currentDice, category: "dice" }, { label: "Trail", item: currentTrail, category: "dice-trail" },
          { label: "Nat 20", item: owned.find(item => item.type === "nat20-effect" && equipped(item)), category: "nat20-effect" },
          { label: "Nat 1", item: owned.find(item => item.type === "nat1-effect" && equipped(item)), category: "nat1-effect" },
        ].map(row => <button key={row.label} disabled={busy} onClick={() => { if (canLeave()) { setWorkshop(false); setCategory(row.category as Category); setSearch(""); setRarity("all"); setSelectedId(row.item?.id || ""); } }}><span className="equipped-mini">{row.item ? art(row.item) : <CategoryIcon kind={row.category} />}</span><span><small>{row.label}</small><strong>{row.item?.name || (loading ? "Loading…" : "Default")}</strong></span></button>)}</section>
      </aside>
      <main className="collection-main" id="collection-content">
        <header className="collection-heading"><div><h1 tabIndex={-1} ref={heading}>{workshop ? "Dice workshop" : currentCategory.name === "Dice sets" ? "Your dice" : currentCategory.name}</h1><p>{workshop ? "A design that feels like yours." : currentCategory.description}</p></div>{category === "dice" && <button className={workshop ? "" : "collection-primary"} disabled={busy} onClick={() => workshop ? canLeave() && setWorkshop(false) : openWorkshop()}>{workshop ? "Back to collection" : "+ Create dice"}</button>}</header>
        {error && <div className="collection-error" role="alert">{error} {!shop && <button onClick={() => void load()}>Try again</button>}</div>}
        <div className="collection-notice" role="status">{notice}</div>
        {workshop ? <div className="workshop-layout">
          <aside className="workshop-designs"><h2>My designs <small>{presets.length} / 5</small></h2><button disabled={busy} onClick={() => openWorkshop()}>+ New design</button>{presets.map(preset => <button className="workshop-design" aria-pressed={editingId === preset.id} disabled={busy} key={preset.id} onClick={() => openWorkshop(dice.find(item => item.preset?.id === preset.id))}><DiceThumbnail theme={preset.theme} /><span>{preset.name}<small>Custom design</small></span></button>)}{presets.length === 0 && <p>Your saved designs will appear here.</p>}</aside>
          <section className="workshop-stage"><div className="workshop-stage-heading"><h2>{name || "Untitled dice"}</h2><span>{dirty ? "Unsaved changes" : editingId ? "Saved" : "New design"}</span></div><CollectionDicePreview theme={draftTheme} sides={sides} onSides={setSides} /><button disabled={busy} onClick={() => void action(async () => { await previewDice(draftTheme); setNotice("Test roll complete. Your equipment hasn't changed."); })}>Test roll</button></section>
          <CollectionDiceEditor settings={settings} onChange={setSettings} name={name} onName={setName} editing={editingId !== null} full={editingId === null && presets.length >= 5} busy={busy} dirty={dirty || editingId === null} onSave={() => void saveDesign()} onEquip={() => void action(async () => { await equipTheme(draftTheme); setNotice("Equipped your current dice design."); })} onReset={() => setSettings({ ...DEFAULT_DICE_CUSTOMIZATION })} />
        </div> : <div className="collection-browser">
          <section className="collection-inventory" aria-label={`${currentCategory.name} collection`}>
            {category === "dice" && <div className="collection-tabs" aria-label="Dice collection filter"><button aria-pressed={diceTab === "all"} onClick={() => { setDiceTab("all"); setSelectedId(""); }}>All dice</button><button aria-pressed={diceTab === "custom"} onClick={() => { setDiceTab("custom"); setSelectedId(""); }}>Custom designs <span>{presets.length} / 5</span></button></div>}
            <div className="collection-filters"><label className="collection-search"><span className="sr-only">Search your collection</span><input type="search" value={search} placeholder={`Search ${currentCategory.name.toLowerCase()}…`} onChange={e => { setSearch(e.target.value); setSelectedId(""); }} /></label><label><span className="sr-only">Rarity</span><select aria-label="Rarity" value={rarity} onChange={e => { setRarity(e.target.value); setSelectedId(""); }}><option value="all">All rarities</option>{[...new Set(categoryItems.map(item => item.rarity))].map(value => <option key={value} value={value}>{rarityName(value)}</option>)}</select></label></div>
            <div className="collection-results"><span>{loading ? "Loading collection…" : `${filtered.length} ${filtered.length === 1 ? "item" : "items"}`}</span><span>Owned & included</span></div>
            {loading ? <div className="collection-loading" role="status">Gathering your collection…</div> : <div className="collection-grid">{filtered.map(item => <button key={item.id} className={`collection-tile${selected?.id === item.id ? " selected" : ""}`} aria-pressed={selected?.id === item.id} onClick={() => { setSelectedId(item.id); setMobileDetail(true); if (!wide) window.scrollTo(0, 0); setTurnPreview(0); }}><span className="collection-tile-art">{art(item)}</span>{equipped(item) && <span className="collection-equipped-tag">Equipped</span>}<span className="collection-tile-name">{item.name}</span><span className={`collection-rarity rarity-${item.rarity}`}>{rarityName(item.rarity)}</span></button>)}</div>}
            {!loading && filtered.length === 0 && <div className="collection-empty"><CategoryIcon kind={category} /><h2>{search || rarity !== "all" ? "No matches this time" : "Room for something new"}</h2><p>{search || rarity !== "all" ? "Try another name or clear your filters." : category === "dice" ? "Create your first custom dice design." : "Your owned cosmetics will appear here as your collection grows."}</p>{search || rarity !== "all" ? <button onClick={() => { setSearch(""); setRarity("all"); }}>Clear filters</button> : category === "dice" ? <button onClick={() => openWorkshop()}>Create dice</button> : <Link to="/emporium">Explore the Emporium</Link>}</div>}
            {category === "table" && <label className="collection-upload">{busy ? "Uploading…" : "+ Upload your own backdrop"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} /></label>}
            {category === "profile" && <p className="collection-footnote">Manage your avatar, biography, and earned badge showcase in <Link to="/profile">your profile</Link>.</p>}
            <footer className="collection-footnote">Looking for something new? <Link to="/emporium">Visit the Emporium</Link></footer>
          </section>
          {(wide || mobileDetail) && <aside className="collection-inspector" aria-label="Selected item preview"><button className="collection-mobile-back" onClick={() => setMobileDetail(false)}>Back to collection</button>
            {selected ? <><div className="collection-preview-label">{selected.type === "dice" ? "Live 3D preview" : "Preview"}</div>{selected.type === "dice" ? <CollectionDicePreview theme={selected.theme!} sides={sides} onSides={setSides} /> : <div className={`collection-effect-stage type-${selected.type}`}>{art(selected)}{selected.type === "turn-start-effect" && turnPreview > 0 && <TurnStartEffect key={turnPreview} effect={selected.effect} preview />}</div>}
              <div className="collection-item-details"><h2>{selected.name}</h2><p className={`collection-rarity rarity-${selected.rarity}`}>{rarityName(selected.rarity)} · {selected.type === "dice" ? "Dice set" : currentCategory.name}</p><p>{selected.description}</p><div className="collection-actions">{selected.type !== "title" && <button className="collection-primary" disabled={busy || equipped(selected)} onClick={() => void equipItem(selected)}>{equipped(selected) ? "Equipped" : selected.type === "background" ? "Use backdrop" : selected.type === "dice" ? "Equip dice" : "Equip"}</button>}{["dice", "dice-trail", "nat20-effect", "nat1-effect", "turn-start-effect"].includes(selected.type) && <button disabled={busy} onClick={() => void preview(selected)}>{busy ? "Working…" : selected.type === "dice" ? "Test roll" : "Preview effect"}</button>}</div>
              {selected.rarity === "custom" && selected.type === "dice" && <div className="collection-secondary-actions"><button disabled={busy} onClick={() => openWorkshop(selected)}>Edit design</button>{selected.preset && <button disabled={busy} onClick={() => deleteDesign(selected)}>Delete</button>}</div>}
              {["token-border", "chat-flair"].includes(selected.type) && equipped(selected) && <button className="collection-text-button" disabled={busy} onClick={() => void clearItem(selected)}>Remove {selected.type === "token-border" ? "border" : "chat effect"}</button>}
              </div></> : <div className="collection-preview-empty"><CategoryIcon kind={category} /><p>Select an item to take a closer look.</p></div>}
          </aside>}
        </div>}
      </main>
    </div>
  </div>;
}
