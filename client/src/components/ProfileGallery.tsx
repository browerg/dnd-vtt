import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import type { ProfileGallery as GallerySettings } from "../../../shared/profileGallery";
import { COVER_HEIGHTS, MAX_IMAGE_ZOOM, defaultFraming, profileBanner, profileGalleryArtwork, type CoverHeight, type FramedImage, type ImageFraming } from "../../../shared/profileGallery";
import type { ProfileBadge } from "./BadgeShowcase";
import { Avatar } from "./Avatar";
import { DiceThumbnail } from "./CollectionDicePreview";
import { PROFILE_PALETTES } from "./ProfileIdentity";
import "@fontsource/wittgenstein/400.css";
import "@fontsource/wittgenstein/500.css";
import "@fontsource/wittgenstein/400-italic.css";
import "./ProfileGallery.css";

// The Personal Gallery profile: a portrait rail beside a player's chosen
// world (cover art), character, signature dice, earned badges and one
// campaign memory. The same layout serves the owner (with an editing
// toolbar), visitors, and the labelled Ruby Rose example.

export interface GalleryProfile {
  id: number;
  display_name: string;
  avatarPath?: string;
  pronouns?: string;
  bio?: string;
  diceTheme?: string;
  relicOwner?: boolean;
  profileStyle?: string;
  profileGallery: GallerySettings;
}
export interface GalleryCharacter {
  id: number;
  name: string;
  campaignId: number;
  campaignName: string;
  portraitUrl: string;
  summary: string;
}
export interface GalleryCampaign {
  id: number;
  name: string;
  system: string;
  role: string;
}
export interface GalleryData {
  profile: GalleryProfile;
  showcase: ProfileBadge[];
  characters: GalleryCharacter[];
  campaigns: GalleryCampaign[];
  /** Example-only artwork; real profiles use their saved uploads. */
  art?: { banner: string; character: string; dice: string; memory: string };
}

export type GalleryTab = "gallery" | "characters" | "campaigns" | "journal" | "saved";
export function BannerArtwork({ value }: { value: string }) {
  const preset = profileBanner(value);
  return preset && !preset.image
    ? <span className={`pg-banner-art pg-banner-${preset.id}`} aria-hidden="true" />
    : <img src={preset?.image || value} alt="" />;
}
type Mode = "owner" | "visitor" | "example";

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    gallery: <><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5" /></>,
    characters: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.6-3.8 3.4-6 7-6s6.4 2.2 7 6" /></>,
    campaigns: <><path d="M12 6.5c-2.2-1.5-5-2-8-1.5v13c3-.5 5.8 0 8 1.5 2.2-1.5 5-2 8-1.5V5c-3-.5-5.8 0-8 1.5Z" /><path d="M12 6.5v13" /></>,
    journal: <><rect x="5.5" y="3.5" width="13" height="17" rx="1.2" /><path d="M8.5 3.5v17M11.5 8h4M11.5 11h4" /></>,
    saved: <path d="M7 3.5h10a.5.5 0 0 1 .5.5v16l-5.5-4-5.5 4V4a.5.5 0 0 1 .5-.5Z" />,
    pencil: <><path d="m15.5 5 3.5 3.5L8.5 19H5v-3.5Z" /><path d="m13.5 7 3.5 3.5" /></>,
    image: <><rect x="3.5" y="4.5" width="17" height="15" rx="1.2" /><circle cx="9" cy="10" r="1.5" /><path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5" /></>,
    layout: <><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M4 12h16M12 4v16" /></>,
    sparkle: <><path d="M10 3.5 11.7 9l5.3 1.7-5.3 1.8L10 18l-1.7-5.5L3 10.7 8.3 9Z" /><path d="M18 3v4M16 5h4M18.5 15.5v3M17 17h3" /></>,
    eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4.5 15v4.5h15V15" /></>,
    move: <><path d="M12 3v18M3 12h18" /><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" /></>,
    dice: <><path d="m12 2.5 8.5 5v9L12 21.5l-8.5-5v-9Z" /><path d="M12 2.5v9m8.5-4-8.5 4-8.5-4m8.5 4v10" /></>,
  };
  return <svg className="pg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Crest() {
  return <svg className="pg-crest" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 3 33 11v18L20 37 7 29V11Z" />
    <path d="M20 3v14M7 11l13 6 13-6M20 17l-7 12h14Z" />
    <path d="M20 17 13 29M20 17l7 12" opacity=".6" />
  </svg>;
}

/** A short rule with a diamond, the comp's ornament. */
function Ornament({ variant = "center" }: { variant?: "center" | "start" | "rule" }) {
  return <span className={`pg-ornament is-${variant}`} aria-hidden="true"><i /><b /><i /></span>;
}

/** Owner editing: reposition, zoom and (for the banner) resize photos in place. */
export interface FramingControls {
  onFraming: (slot: FramedImage, framing: ImageFraming) => void;
  onCoverHeight: (height: CoverHeight) => void;
}
export const COVER_HEIGHT_NAMES: Record<CoverHeight, string> = { short: "Short", standard: "Standard", tall: "Tall", xtall: "Extra tall" };
const clampFraming = (f: ImageFraming): ImageFraming => ({
  x: Math.round(Math.min(100, Math.max(0, f.x)) * 10) / 10,
  y: Math.round(Math.min(100, Math.max(0, f.y)) * 10) / 10,
  zoom: Math.round(Math.min(MAX_IMAGE_ZOOM, Math.max(1, f.zoom)) * 100) / 100,
});

/**
 * A photo that fills its frame at the owner's chosen focal point and zoom.
 * In edit mode an Adjust button lets the owner drag it, zoom it, and nudge
 * it with the arrow keys; everyone else just sees the framed result.
 */
function FramedPhoto({ slot, src, framing, controls, label, coverHeight }: {
  slot: FramedImage;
  src: string;
  framing: ImageFraming;
  controls?: FramingControls;
  label: string;
  coverHeight?: CoverHeight;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const drag = useRef<{ x: number; y: number; start: ImageFraming } | null>(null);
  const clip = useRef<HTMLDivElement>(null);
  const adjustButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!controls) setAdjusting(false); }, [controls]);
  useEffect(() => { if (adjusting) clip.current?.focus({ preventScroll: true }); }, [adjusting]);

  const update = (next: ImageFraming) => controls?.onFraming(slot, clampFraming(next));
  const finish = () => { setAdjusting(false); requestAnimationFrame(() => adjustButton.current?.focus({ preventScroll: true })); };
  const style: CSSProperties = {
    objectPosition: `${framing.x}% ${framing.y}%`,
    transformOrigin: `${framing.x}% ${framing.y}%`,
    transform: framing.zoom > 1 ? `scale(${framing.zoom})` : undefined,
  };

  return <div className={`pg-frame${adjusting ? " is-adjusting" : ""}`}>
    <div
      ref={clip}
      className="pg-frame-clip"
      tabIndex={adjusting ? 0 : undefined}
      role={adjusting ? "group" : undefined}
      aria-label={adjusting ? `Reposition ${label}. Drag, or use the arrow keys; plus and minus zoom.` : undefined}
      onPointerDown={(event) => {
        if (!adjusting) return;
        event.preventDefault();
        drag.current = { x: event.clientX, y: event.clientY, start: framing };
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Capture is a nicety; dragging works without it. */ }
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || !clip.current) return;
        // Moving the pointer right pulls the picture right, revealing more
        // of its left side, so the focal point moves the other way.
        const { width, height } = clip.current.getBoundingClientRect();
        update({
          ...active.start,
          x: active.start.x - ((event.clientX - active.x) / Math.max(1, width)) * 100 / active.start.zoom,
          y: active.start.y - ((event.clientY - active.y) / Math.max(1, height)) * 100 / active.start.zoom,
        });
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={(event) => {
        if (!adjusting) return;
        const step = event.shiftKey ? 10 : 2;
        const moves: Record<string, Partial<ImageFraming>> = {
          ArrowLeft: { x: framing.x + step }, ArrowRight: { x: framing.x - step },
          ArrowUp: { y: framing.y + step }, ArrowDown: { y: framing.y - step },
          "+": { zoom: framing.zoom + 0.1 }, "=": { zoom: framing.zoom + 0.1 }, "-": { zoom: framing.zoom - 0.1 },
        };
        if (event.key === "Escape" || event.key === "Enter") { event.preventDefault(); finish(); return; }
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        update({ ...framing, ...move });
      }}
    >
      <img src={src} alt="" draggable={false} style={style} decoding="async" loading={slot === "memory" ? "lazy" : "eager"} fetchPriority={slot === "cover" ? "high" : "auto"} />
    </div>
    {controls && !adjusting && <button ref={adjustButton} type="button" className="pg-adjust" onClick={() => setAdjusting(true)}>
      <Icon name="move" /><span>Adjust<span className="sr-only"> {label}</span></span>
    </button>}
    {controls && adjusting && <div className="pg-adjust-panel" onPointerDown={(event) => event.stopPropagation()}>
      <p>Drag the picture to move it.</p>
      <label className="pg-zoom">Zoom
        <input type="range" min={1} max={MAX_IMAGE_ZOOM} step={0.05} value={framing.zoom}
          onChange={(event) => update({ ...framing, zoom: Number(event.target.value) })} />
      </label>
      {slot === "cover" && coverHeight && <div className="pg-height-choice" role="group" aria-label="Banner height">
        {COVER_HEIGHTS.map((height) => <button key={height} type="button" aria-pressed={coverHeight === height} onClick={() => controls.onCoverHeight(height)}>{COVER_HEIGHT_NAMES[height]}</button>)}
      </div>}
      <div className="pg-adjust-actions">
        <button type="button" className="pg-text-button" onClick={() => update(defaultFraming()[slot])}>Reset</button>
        <button type="button" className="pg-adjust-done" onClick={finish}>Done</button>
      </div>
    </div>}
  </div>;
}

export function GalleryTopbar({ active }: { active: "profile" | "other" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [open]);
  return <header className="pg-topbar">
    <Link className="pg-brand" to="/"><Crest /><span>Vivid Realms</span></Link>
    <nav className="pg-nav" aria-label="Main navigation">
      <Link to="/">Campaigns</Link>
      <Link to="/customize">Customize</Link>
      <Link to="/profile" aria-current={active === "profile" ? "page" : undefined}>Profile</Link>
    </nav>
    <div className="pg-account" ref={menu}>
      <button type="button" className="pg-account-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Avatar name={user?.display_name ?? "?"} src={user?.avatarPath || undefined} id={user?.id} size={36} />
        <span className="sr-only">Account menu</span>
        <Icon name="chevron" />
      </button>
      {open && <div className="pg-menu" role="menu">
        <Link role="menuitem" to="/profile" onClick={() => setOpen(false)}>My profile</Link>
        <Link role="menuitem" to="/customize" onClick={() => setOpen(false)}>Customize</Link>
        <Link role="menuitem" to="/emporium" onClick={() => setOpen(false)}>Emporium</Link>
        <button role="menuitem" type="button" onClick={async () => { setOpen(false); await logout(); navigate("/login"); }}>Sign out</button>
      </div>}
    </div>
  </header>;
}

const NAV: { id: GalleryTab; label: string; icon: string }[] = [
  { id: "gallery", label: "Gallery", icon: "gallery" },
  { id: "characters", label: "Characters", icon: "characters" },
  { id: "campaigns", label: "Campaigns", icon: "campaigns" },
  { id: "journal", label: "Journal", icon: "journal" },
  { id: "saved", label: "Saved", icon: "saved" },
];

export default function ProfileGalleryView({
  data, mode, tab, onTab, onEditProfile, onEmpty, toolbar, tabContent, editing = false, notice, overlay, framingControls,
}: {
  data: GalleryData;
  mode: Mode;
  tab: GalleryTab;
  onTab: (tab: GalleryTab) => void;
  onEditProfile?: () => void;
  /** Owner editing: an empty slot's button opens the matching editor. */
  onEmpty?: (slot: "cover" | "character" | "memory" | "badges") => void;
  toolbar?: ReactNode;
  tabContent?: ReactNode;
  editing?: boolean;
  notice?: ReactNode;
  overlay?: ReactNode;
  /** Present only while the owner is editing. */
  framingControls?: FramingControls;
}) {
  const { profile, showcase, art } = data;
  const gallery = profile.profileGallery;
  const owner = mode === "owner";
  const tabs = NAV.filter((item) => owner || item.id === "gallery" || item.id === "characters" || item.id === "campaigns");
  const show = (section: GallerySettings["sections"][number]) => gallery.sections.includes(section);
  const starter = profileGalleryArtwork(gallery);
  const banner = art?.banner || starter.banner;
  const character = art?.character || starter.character;
  const memory = art?.memory || starter.memory;
  const signature = gallery.signatureDice || profile.diceTheme || "white";
  const portrait = profile.avatarPath;
  const framing = { ...defaultFraming(), ...gallery.framing };
  const controls = owner && editing ? framingControls : undefined;
  const coverHeight = gallery.coverHeight ?? "standard";
  const palette = PROFILE_PALETTES.find(item => item.id === profile.profileStyle) ?? PROFILE_PALETTES[0];
  const paletteStyle = gallery.accent === "profile" ? {
    "--pg-accent": palette.color, "--pg-accent-text": palette.color, "--pg-accent-fill": palette.color,
    "--pg-accent-fill-hover": palette.color, "--pg-accent-wash": `${palette.color}22`, "--pg-accent-ink": "#171413",
  } as CSSProperties : undefined;

  const empty = (slot: "cover" | "character" | "memory" | "badges", label: string, hint: string) =>
    <div className="pg-empty">
      <p>{hint}</p>
      {owner && editing && onEmpty && <button type="button" className="pg-outline-button" onClick={() => onEmpty(slot)}>{label}</button>}
    </div>;

  const characterCard = show("character") && (character || gallery.characterName || owner) &&
    <article className="pg-card pg-character">
      {character && <FramedPhoto slot="character" src={character} framing={framing.character} controls={controls} label="your character art" />}
      <header className="pg-card-title">
        <h2>My character{gallery.characterName && <><span className="pg-dot" aria-hidden="true">•</span>{gallery.characterName}</>}</h2>
        <Ornament variant="start" />
      </header>
      {!character && empty("character", "Feature a character", owner ? "Show off a character you love: their art and their name." : "")}
    </article>;

  const diceCard = show("dice") &&
    <article className="pg-card pg-dice">
      {art?.dice ? <img src={art.dice} alt="" /> : <div className="pg-dice-stage"><DiceThumbnail theme={signature} /></div>}
      <header className="pg-card-title is-small">
        <h2>Signature dice</h2>
        <Ornament variant="start" />
      </header>
    </article>;

  const badgesBlock = show("badges") && (showcase.length > 0 || owner) &&
    <section className="pg-badges" aria-labelledby="pg-badges-heading">
      <div className="pg-section-heading"><h2 id="pg-badges-heading">At the table</h2><Ornament variant="rule" /></div>
      {showcase.length ? <ul className="pg-badge-list">
        {showcase.slice(0, 3).map((badge) => <li key={badge.id}>
          <img src={badge.badgeImage} alt="" />
          <strong>{badge.name}</strong>
          <span>{badge.description}</span>
        </li>)}
      </ul> : empty("badges", "Choose badges", "Earn badges at the table, then choose three to show here.")}
    </section>;

  const memoryBlock = show("memory") && (memory || gallery.memoryCaption || owner) &&
    <section className="pg-memory" aria-labelledby="pg-memory-heading">
      <div className="pg-section-heading"><h2 id="pg-memory-heading">Campaign memory</h2><Ornament variant="rule" /></div>
      {memory ? <FramedPhoto slot="memory" src={memory} framing={framing.memory} controls={controls} label="your campaign memory" /> : empty("memory", "Add a memory", "A moment from your table worth keeping: one picture and a line about it.")}
      {gallery.memoryCaption && <p className="pg-caption">{gallery.memoryCaption}</p>}
      {gallery.memoryCaption && <Ornament />}
    </section>;

  const upper = (characterCard || diceCard) && <div className={`pg-row pg-feature${characterCard && diceCard ? "" : " is-single"}`}>{characterCard}{diceCard}</div>;
  const lower = (badgesBlock || memoryBlock) && <div className={`pg-row pg-lower${badgesBlock && memoryBlock ? "" : " is-single"}`}>{badgesBlock}{memoryBlock}</div>;

  return <div className={`pg-page accent-${gallery.accent}${toolbar ? " has-toolbar" : ""}`} style={paletteStyle}>
    <a className="pg-skip" href="#pg-main">Skip to profile</a>
    <GalleryTopbar active={owner ? "profile" : "other"} />
    <div className="pg-layout">
      <aside className="pg-rail">
        <div className="pg-portrait">
          {portrait ? <FramedPhoto slot="portrait" src={portrait} framing={framing.portrait} controls={controls} label="your portrait" /> : <Avatar name={profile.display_name} id={profile.id || undefined} size={286} />}
        </div>
        <h1 className="pg-name">{profile.display_name}</h1>
        {profile.pronouns && <p className="pg-pronouns">{profile.pronouns}</p>}
        {!!profile.relicOwner && <p className="pg-title">Relic Owner</p>}
        <Ornament />
        {(profile.bio || owner) && <p className={`pg-bio${profile.bio ? "" : " is-empty"}`}>{profile.bio || "Add a line about yourself the table can see."}</p>}
        {owner && onEditProfile && <button type="button" className="pg-edit" onClick={onEditProfile}><Icon name="pencil" />Edit profile</button>}
        {mode === "example" && <Link className="pg-edit" to="/profile"><Icon name="pencil" />Make yours</Link>}
        <nav className="pg-tabs" aria-label="Profile sections">
          {tabs.map((item) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => onTab(item.id)}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </button>)}
        </nav>
      </aside>
      <main className="pg-main" id="pg-main" tabIndex={-1}>
        {notice}
        {tab === "gallery" ? <>
          <figure className={`pg-banner height-${coverHeight}${banner ? "" : " is-empty"}`}>
            {banner ? (profileBanner(banner) && !profileBanner(banner)!.image
              ? <BannerArtwork value={banner} />
              : <FramedPhoto slot="cover" src={profileBanner(banner)?.image || banner} framing={framing.cover} controls={controls} label="your cover art" coverHeight={coverHeight} />)
              : empty("cover", "Add cover art", owner ? "Set the scene: a wide picture of your world or your table." : "")}
          </figure>
          {gallery.badgesFirst ? <>{lower}{upper}</> : <>{upper}{lower}</>}
        </> : tabContent}
      </main>
    </div>
    {toolbar}
    {overlay}
  </div>;
}

export function CharacterGrid({ characters, emptyText }: { characters: GalleryCharacter[]; emptyText: string }) {
  if (!characters.length) return <p className="pg-tab-empty">{emptyText}</p>;
  return <ul className="pg-character-grid">
    {characters.map((character) => <li key={character.id}>
      {character.portraitUrl ? <img src={character.portraitUrl} alt="" /> : <span className="pg-character-initial" aria-hidden="true">{character.name.slice(0, 1)}</span>}
      <strong>{character.name}</strong>
      {character.summary && <span>{character.summary}</span>}
      <small>{character.campaignName}</small>
    </li>)}
  </ul>;
}

export function CampaignList({ campaigns, linked, emptyText }: { campaigns: GalleryCampaign[]; linked: boolean; emptyText: string }) {
  if (!campaigns.length) return <p className="pg-tab-empty">{emptyText}</p>;
  const roleName = (role: string) => role === "dm" ? "Game master" : role === "co-dm" ? "Co-GM" : role === "spectator" ? "Spectator" : "Player";
  return <ul className="pg-campaign-list">
    {campaigns.map((campaign) => {
      const body = <><strong>{campaign.name}</strong><span>{campaign.system === "remnant" ? "Remnant" : "D&D 5e"} · {roleName(campaign.role)}</span></>;
      return <li key={campaign.id}>{linked ? <Link to={`/campaigns/${campaign.id}`}>{body}</Link> : <div>{body}</div>}</li>;
    })}
  </ul>;
}
