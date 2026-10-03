import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, uploadImage, type User } from "../api";
import { useAuth } from "../App";
import { GALLERY_ACCENTS, GALLERY_SECTIONS, PROFILE_BANNERS, readProfileGallery, type GallerySection, type ProfileGallery } from "../../../shared/profileGallery";
import Achievements, { type AchievementSnapshot } from "../components/Achievements";
import { DiceThumbnail } from "../components/CollectionDicePreview";
import ProfileGalleryView, { BannerArtwork, CampaignList, CharacterGrid, Icon, type GalleryData, type GalleryTab } from "../components/ProfileGallery";
import { diceCollection, type CollectionShop, type DicePreset } from "../customizeCollection";

// The owner's Personal Gallery. Viewing shows the gallery as visitors see it
// plus an Edit profile button; editing adds the bottom toolbar. Changes
// preview live and publish together on "Done editing".

const BIO_MAX = 280;
type Panel = "details" | "cover" | "layout" | "showcase" | null;
const SECTION_NAMES: Record<GallerySection, string> = {
  character: "My character",
  dice: "Signature dice",
  badges: "At the table (badges)",
  memory: "Campaign memory",
};
const ACCENT_COLORS: Record<ProfileGallery["accent"], { name: string; color: string }> = {
  copper: { name: "Copper", color: "#dc9a76" },
  rose: { name: "Rose", color: "#df9aa6" },
  jade: { name: "Jade", color: "#8fc0a2" },
  ice: { name: "Ice", color: "#9fc2d9" },
  profile: { name: "From Customize", color: "#b899ee" },
};

interface Identity { displayName: string; pronouns: string; bio: string; avatarPath: string }
const identityOf = (user: User): Identity => ({
  displayName: user.display_name, pronouns: user.pronouns ?? "", bio: user.bio ?? "", avatarPath: user.avatarPath ?? "",
});
function restoredProfileDraft(user: User | null): { identity: Identity; gallery: ProfileGallery } | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(`vivid:profile-draft:${user?.id}`) || "null");
    if (!draft?.identity || ["displayName", "pronouns", "bio", "avatarPath"].some(key => typeof draft.identity[key] !== "string")) return null;
    return { identity: draft.identity, gallery: readProfileGallery(draft.gallery) };
  } catch { return null; }
}

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [restored] = useState(() => restoredProfileDraft(user));
  const [data, setData] = useState<GalleryData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<GalleryTab>("gallery");
  const [editing, setEditing] = useState(!!restored);
  const [previewing, setPreviewing] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [identity, setIdentity] = useState<Identity>(() => restored?.identity ?? (user ? identityOf(user) : { displayName: "", pronouns: "", bio: "", avatarPath: "" }));
  const [gallery, setGallery] = useState<ProfileGallery>(() => restored?.gallery ?? readProfileGallery(user?.profileGallery ?? {}));
  const [saved, setSaved] = useState(() => JSON.stringify({ identity: user ? identityOf(user) : identity, gallery: readProfileGallery(user?.profileGallery ?? {}) }));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [shop, setShop] = useState<CollectionShop | null>(null);
  const [presets, setPresets] = useState<DicePreset[]>([]);
  const dirty = JSON.stringify({ identity, gallery }) !== saved;
  const panelTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!panel || !editing || previewing) return;
    panelTrigger.current = document.activeElement as HTMLElement;
    const element = document.querySelector<HTMLElement>(".pg-panel");
    element?.focus({ preventScroll: true });
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPanel(null); };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); panelTrigger.current?.focus({ preventScroll: true }); };
  }, [panel, editing, previewing]);
  useEffect(() => {
    try {
      const key = `vivid:profile-draft:${user?.id}`;
      if (dirty) sessionStorage.setItem(key, JSON.stringify({ identity, gallery }));
      else sessionStorage.removeItem(key);
    } catch { /* The editor remains usable when storage is unavailable. */ }
  }, [dirty, identity, gallery, user?.id]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setData(await api<GalleryData>(`/api/achievements/profiles/${user.id}`));
      setLoadError("");
    } catch (e: any) {
      setLoadError(e.message);
    }
  }, [user?.id]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    api<CollectionShop>("/api/shop").then(setShop).catch(() => {});
    api<{ presets: DicePreset[] }>("/api/auth/me/dice-presets").then((r) => setPresets(r.presets)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const dice = useMemo(() => diceCollection(shop, presets, user ?? null), [shop, presets, user]);
  // Badge choices made in the Journal tab show up on the gallery right away.
  const journalChanged = useCallback((snapshot: AchievementSnapshot) => {
    setData((current) => current && JSON.stringify(current.showcase) !== JSON.stringify(snapshot.showcase) ? { ...current, showcase: snapshot.showcase } : current);
  }, []);
  const patch = (next: Partial<ProfileGallery>) => setGallery((current) => ({ ...current, ...next }));

  const upload = async (key: string, file: File, apply: (url: string) => void) => {
    setBusy(key);
    setError("");
    try {
      apply(await uploadImage(file));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    if (!user) return;
    setBusy("save");
    setError("");
    try {
      const response = await api<{ user: User }>("/api/auth/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName: identity.displayName, pronouns: identity.pronouns, bio: identity.bio,
          avatarPath: identity.avatarPath, profileStyle: user.profileStyle ?? "astral", profileGallery: gallery,
        }),
      });
      setUser(response.user);
      const next = { identity: identityOf(response.user), gallery: readProfileGallery(response.user.profileGallery ?? gallery) };
      setIdentity(next.identity);
      setGallery(next.gallery);
      setSaved(JSON.stringify(next));
      setEditing(false);
      setPreviewing(false);
      setPanel(null);
      setStatus("Your gallery is saved.");
      void load();
    } catch (e: any) {
      setError(e.message);
      setPanel((current) => current ?? "details");
    } finally {
      setBusy("");
    }
  };

  const discard = () => {
    const previous = JSON.parse(saved) as { identity: Identity; gallery: ProfileGallery };
    setIdentity(previous.identity);
    setGallery(previous.gallery);
    setEditing(false);
    setPreviewing(false);
    setPanel(null);
    setError("");
  };

  if (!user) return null;

  const view: GalleryData | null = data && {
    ...data,
    profile: {
      ...data.profile,
      display_name: identity.displayName || user.display_name,
      pronouns: identity.pronouns,
      bio: identity.bio,
      avatarPath: identity.avatarPath,
      profileGallery: gallery,
    },
  };

  const togglePanel = (next: Exclude<Panel, null>) => { setStatus(""); setPanel((current) => (current === next ? null : next)); };

  const toolbar = editing && <div className="pg-toolbar" role="toolbar" aria-label="Edit your gallery">
    <div className="pg-tools">
      {previewing ? <button type="button" aria-pressed="true" onClick={() => setPreviewing(false)}><Icon name="eye" /><span>Exit preview</span></button> : <>
        <button type="button" aria-label="Cover art" aria-expanded={panel === "cover"} onClick={() => togglePanel("cover")}><Icon name="image" /><span>Cover art</span></button>
        <button type="button" aria-label="Layout" aria-expanded={panel === "layout"} onClick={() => togglePanel("layout")}><Icon name="layout" /><span>Layout</span></button>
        <button type="button" aria-label="Showcase" aria-expanded={panel === "showcase"} onClick={() => togglePanel("showcase")}><Icon name="sparkle" /><span>Showcase</span></button>
        <button type="button" aria-label="Preview" onClick={() => { setPanel(null); setTab("gallery"); setPreviewing(true); }}><Icon name="eye" /><span>Preview</span></button>
      </>}
    </div>
    <div className="pg-done">
      <button type="button" disabled={busy === "save" || !!busy} onClick={() => void save()}>{busy === "save" ? "Saving…" : "Done editing"}</button>
    </div>
  </div>;

  const panelShell = (title: string, body: ReactNode) => <section className="pg-panel" aria-label={title} tabIndex={-1}>
    <div className="pg-panel-head"><h2>{title}</h2><button type="button" className="pg-panel-close" aria-label="Close" onClick={() => setPanel(null)}><Icon name="close" /></button></div>
    <fieldset className="pg-panel-body" disabled={!!busy}>{body}</fieldset>
    {error && <div className="pg-error" role="alert">{error}</div>}
  </section>;

  const fileButton = (key: string, label: string, apply: (url: string) => void) =>
    <label className="pg-outline-button pg-file">
      <Icon name="upload" />{busy === key ? "Uploading…" : label}
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!!busy} onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void upload(key, file, apply);
        event.target.value = "";
      }} />
    </label>;

  const panels = editing && !previewing && panel && (
    panel === "details" ? panelShell("Edit profile", <>
      <fieldset>
        <legend>Portrait</legend>
        {identity.avatarPath && <img className="pg-thumb" src={identity.avatarPath} alt="Your current portrait" style={{ maxWidth: 140, aspectRatio: "1" }} />}
        <div className="pg-row-actions">
          {fileButton("avatar", identity.avatarPath ? "Replace portrait" : "Upload portrait", (url) => setIdentity((current) => ({ ...current, avatarPath: url })))}
          {identity.avatarPath && <button type="button" className="pg-text-button" onClick={() => setIdentity((current) => ({ ...current, avatarPath: "" }))}>Remove</button>}
        </div>
      </fieldset>
      <label className="pg-field">Display name<input value={identity.displayName} maxLength={40} onChange={(e) => setIdentity((current) => ({ ...current, displayName: e.target.value }))} /></label>
      <label className="pg-field">Pronouns<input value={identity.pronouns} maxLength={30} placeholder="she/her, they/them…" onChange={(e) => setIdentity((current) => ({ ...current, pronouns: e.target.value }))} /></label>
      <label className="pg-field">Bio <small>{identity.bio.length}/{BIO_MAX}</small>
        <textarea rows={3} value={identity.bio} maxLength={BIO_MAX} placeholder="A line about you the table can see." onChange={(e) => setIdentity((current) => ({ ...current, bio: e.target.value }))} />
      </label>
      <p>This is you as a player, not your character. Members of your campaigns can see it.</p>
      <PasswordChange />
    </>)
    : panel === "cover" ? panelShell("Cover art", <>
      <p>Pick a ready-made banner or upload a picture of your own.</p>
      <div className="pg-banner-picker" aria-label="Built-in banners">
        {PROFILE_BANNERS.map(banner => <button type="button" key={banner.id} aria-pressed={gallery.coverPath === `preset:${banner.id}`} onClick={() => patch({ coverPath: `preset:${banner.id}` })}>
          <span className="pg-banner-swatch"><BannerArtwork value={`preset:${banner.id}`} /></span><span>{banner.name}</span>
        </button>)}
      </div>
      {gallery.coverPath.startsWith("/uploads/") && <img className="pg-thumb" src={gallery.coverPath} alt="Your current cover art" />}
      <div className="pg-row-actions">
        {fileButton("cover", gallery.coverPath ? "Replace cover art" : "Upload cover art", (url) => patch({ coverPath: url }))}
        {gallery.coverPath && <button type="button" className="pg-text-button" onClick={() => patch({ coverPath: "" })}>Remove</button>}
      </div>
      <fieldset>
        <legend>Frame colour</legend>
        <div className="pg-swatches">
          {GALLERY_ACCENTS.map((accent) => <button key={accent} type="button" aria-pressed={gallery.accent === accent} onClick={() => patch({ accent })}>
            <i style={{ background: ACCENT_COLORS[accent].color }} aria-hidden="true" />{ACCENT_COLORS[accent].name}
          </button>)}
        </div>
      </fieldset>
    </>)
    : panel === "layout" ? panelShell("Layout", <>
      <fieldset>
        <legend>Show on your gallery</legend>
        {GALLERY_SECTIONS.map((section) => <label key={section} className="pg-check">
          <input type="checkbox" checked={gallery.sections.includes(section)} onChange={(e) => patch({
            sections: e.target.checked ? GALLERY_SECTIONS.filter((s) => s === section || gallery.sections.includes(s)) : gallery.sections.filter((s) => s !== section),
          })} />
          {SECTION_NAMES[section]}
        </label>)}
      </fieldset>
      <fieldset>
        <legend>Order</legend>
        <label className="pg-check"><input type="checkbox" checked={gallery.badgesFirst} onChange={(e) => patch({ badgesFirst: e.target.checked })} />Put badges and memory above your character</label>
      </fieldset>
    </>)
    : panelShell("Showcase", <>
      <fieldset>
        <legend>My character</legend>
        <label className="pg-field">Character name<input value={gallery.characterName} maxLength={60} placeholder="Rowan" onChange={(e) => patch({ characterName: e.target.value })} /></label>
        {gallery.characterImage && <img className="pg-thumb" src={gallery.characterImage} alt="Your featured character art" />}
        <div className="pg-row-actions">
          {fileButton("character", gallery.characterImage ? "Replace art" : "Upload art", (url) => patch({ characterImage: url }))}
          {gallery.characterImage && <button type="button" className="pg-text-button" onClick={() => patch({ characterImage: "" })}>Remove</button>}
        </div>
        {!!data?.characters.length && <>
          <p>Or use one of your characters:</p>
          <div className="pg-picker">
            {data.characters.slice(0, 8).map((character) => <button key={character.id} type="button" onClick={() => patch({ characterName: character.name, characterImage: character.portraitUrl || "" })}>
              {character.portraitUrl ? <img src={character.portraitUrl} alt="" /> : <span className="pg-character-initial" aria-hidden="true">{character.name.slice(0, 1)}</span>}
              {character.name}
            </button>)}
          </div>
        </>}
      </fieldset>
      <fieldset>
        <legend>Signature dice</legend>
        <label className="pg-field">Dice to show
          <select value={gallery.signatureDice} onChange={(e) => patch({ signatureDice: e.target.value })}>
            <option value="">The dice I have equipped</option>
            {dice.map((item) => <option key={item.id} value={item.theme}>{item.name}</option>)}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>At the table</legend>
        <p>Your three showcased badges appear here.</p>
        <div className="pg-row-actions"><button type="button" className="pg-outline-button" onClick={() => { setPanel(null); setTab("journal"); }}>Choose badges</button></div>
      </fieldset>
      <fieldset>
        <legend>Campaign memory</legend>
        {gallery.memoryImage && <img className="pg-thumb" src={gallery.memoryImage} alt="Your campaign memory" />}
        <div className="pg-row-actions">
          {fileButton("memory", gallery.memoryImage ? "Replace picture" : "Upload picture", (url) => patch({ memoryImage: url }))}
          {gallery.memoryImage && <button type="button" className="pg-text-button" onClick={() => patch({ memoryImage: "" })}>Remove</button>}
        </div>
        <label className="pg-field">Caption <small>{gallery.memoryCaption.length}/280</small>
          <textarea rows={2} maxLength={280} value={gallery.memoryCaption} placeholder="That night by the lake…" onChange={(e) => patch({ memoryCaption: e.target.value })} />
        </label>
      </fieldset>
    </>)
  );

  const tabHeading = (title: string, lead?: string) => <>
    <div className="pg-tab-heading"><h2>{title}</h2><span className="pg-ornament is-rule" aria-hidden="true"><i /><b /><i /></span></div>
    {lead && <p className="pg-tab-lead">{lead}</p>}
  </>;

  const tabContent = view && (
    tab === "characters" ? <>{tabHeading("Characters", "Everyone you play, across your campaigns.")}<CharacterGrid characters={view.characters} emptyText="No characters yet. Create one inside a campaign." /></>
    : tab === "campaigns" ? <>{tabHeading("Campaigns")}<CampaignList campaigns={view.campaigns} linked emptyText="You haven't joined a campaign yet." /></>
    : tab === "journal" ? <>{tabHeading("Journal", "Your badges and how you earned them. Choose three to show on your gallery.")}<div className="pg-journal"><Achievements embedded onChange={journalChanged} /></div></>
    : tab === "saved" ? <>{tabHeading("Saved", "Your saved dice designs.")}
      {presets.length ? <ul className="pg-saved-grid">{presets.map((preset) => <li key={preset.id}><DiceThumbnail theme={preset.theme} /><span>{preset.name}</span></li>)}</ul> : <p className="pg-tab-empty">No saved dice designs yet.</p>}
      <p><Link className="pg-text-link" to="/customize">Design dice in Customize</Link></p>
    </> : null
  );

  if (loadError) return <div className="pg-page"><p className="pg-error" role="alert" style={{ margin: 24 }}>{loadError} <button type="button" className="pg-text-button" onClick={() => void load()}>Try again</button></p></div>;
  if (!view) return <div className="pg-page" aria-busy="true"><p className="pg-tab-empty" role="status">Loading your gallery…</p></div>;

  return <>
    <ProfileGalleryView
      data={view}
      mode={previewing ? "visitor" : "owner"}
      tab={tab}
      onTab={setTab}
      editing={editing && !previewing}
      onEditProfile={() => { setStatus(""); setEditing(true); setPanel("details"); setTab("gallery"); }}
      onEmpty={(slot) => slot === "badges" ? setTab("journal") : setPanel(slot === "cover" ? "cover" : "showcase")}
      toolbar={toolbar || undefined}
      tabContent={tabContent}
      overlay={panels}
      notice={<>
        {previewing && <div className="pg-banner-note"><span><strong>Preview.</strong> This is how your gallery looks to members of your campaigns.</span></div>}
        {editing && !previewing && dirty && <div className="pg-banner-note"><span><strong>Unsaved changes.</strong> Press Done editing to publish them.</span><button type="button" className="pg-text-button" onClick={discard}>Discard changes</button></div>}
        {!editing && status && <div className="pg-banner-note" role="status"><span>{status}</span><Link className="pg-text-link" to={`/profiles/${user.id}`}>See it as a visitor</Link></div>}
        {!editing && !status && !gallery.coverPath && !gallery.characterImage && !gallery.memoryImage && <div className="pg-banner-note"><span><strong>Make this gallery yours.</strong> Add cover art, a character, and a campaign memory.</span><Link className="pg-text-link" to="/profiles/example">See an example</Link></div>}
      </>}
    />
  </>;
}

function PasswordChange() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const change = async () => {
    setError(""); setNotice("");
    if (next.length < 8) return setError("Your new password must be at least 8 characters.");
    if (next !== confirm) return setError("Those new passwords don't match.");
    setBusy(true);
    try {
      await api("/api/auth/me/password", { method: "PUT", body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      setCurrent(""); setNext(""); setConfirm("");
      setNotice("Password changed. Other signed-in sessions were closed.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!open) return <div className="pg-row-actions"><button type="button" className="pg-text-button" onClick={() => setOpen(true)}>Change password</button></div>;
  return <fieldset>
    <legend>Change password</legend>
    <label className="pg-field">Current password<input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
    <label className="pg-field">New password<input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} /></label>
    <label className="pg-field">Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
    {error && <div className="pg-error" role="alert">{error}</div>}
    {notice && <p className="pg-status" role="status">{notice}</p>}
    <div className="pg-row-actions">
      <button type="button" className="pg-outline-button" disabled={busy || !current || !next || !confirm} onClick={() => void change()}>{busy ? "Changing…" : "Change password"}</button>
      <button type="button" className="pg-text-button" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  </fieldset>;
}
