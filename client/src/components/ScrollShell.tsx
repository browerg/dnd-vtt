import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { uploadImage, type ChatMessage, type Member } from "../api";
import { chatSoundEnabled, playChatSound, playScrollSound, setChatSoundEnabled } from "../chatSound";
import { Avatar } from "./Avatar";
import "./ScrollShell.css";

type App = "messages" | "contacts" | "rolls" | "settings";
type Preferences = { finish: string; accent: string; wallpaper: string; emblem: string; interfaceSound: boolean; vibration: boolean };
const DEFAULTS: Preferences = { finish: "graphite", accent: "rose", wallpaper: "moonrose", emblem: "rose", interfaceSound: true, vibration: true };
const ACCENTS: Record<string, [string, string]> = { rose: ["#e3a0ac", "#683442"], ice: ["#a5d7ef", "#294c61"], jade: ["#aad8be", "#305544"], gold: ["#ecd09a", "#614b27"] };
const WALLPAPERS: Record<string, string> = { moonrose: "/assets/scroll/moonrose.webp", citadel: "/assets/profile-gallery/example/banner.webp", midnight: "" };
export function readScrollPreferences(key: string): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return { finish: ["graphite", "ivory", "field"].includes(value.finish) ? value.finish : DEFAULTS.finish,
      accent: Object.hasOwn(ACCENTS, value.accent) ? value.accent : DEFAULTS.accent,
      wallpaper: Object.hasOwn(WALLPAPERS, value.wallpaper) || /^\/uploads\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp)$/.test(value.wallpaper) ? value.wallpaper : DEFAULTS.wallpaper,
      emblem: ["rose", "moon", "crest"].includes(value.emblem) ? value.emblem : DEFAULTS.emblem,
      interfaceSound: value.interfaceSound !== false, vibration: value.vibration !== false };
  } catch { return { ...DEFAULTS }; }
}
export function ScrollIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "reply" ? <path d="m9 5-6 6 6 6M3 11h10a7 7 0 0 1 7 7"/> : name === "messages" ? <path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a8 8 0 1 1 16 0Z" /> : name === "contacts" ? <><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></> : name === "rolls" ? <><path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m3 7 9 5 9-5M12 12v10M12 2v10"/></> : name === "settings" ? <><path d="m9 3 1-2h4l1 2 3 2 3 1 2 4-2 2v3l-1 3-4 2-2 3h-4l-1-3-4-2-2-3v-3L1 10l2-4 3-1Z" transform="translate(2 2) scale(.82)"/><circle cx="12" cy="12" r="3"/></> : name === "moon" ? <path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/> : name === "crest" ? <><path d="m12 2 8 4v7c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m12 6 4 6-4 5-4-5Z"/></> : name === "rose" ? <><path d="M12 2c3 0 3 3 6 3s4 4 2 6c3 3 0 7-3 7-1 5-7 5-9 1-4 1-7-3-5-6-3-4 0-8 4-8 0-2 3-3 5-3Z"/><path d="M8 8c5-4 10 4 5 7-4 3-8-3-4-5 3-2 5 2 2 3"/></> : <path d="m6 14 6-6 6 6"/>}
  </svg>;
}

export default function ScrollShell({ storageKey, characterName, aura, clock, members, messages, myId, canChat, onContact, onMessage, onVisibilityChange, onRolls, onTuck, children }: {
  storageKey: string; characterName: string; aura: number | null; clock: Date; members: Member[]; messages: ChatMessage[]; myId: number; canChat: boolean;
  onContact: (id: number, message?: ChatMessage) => void; onMessage: (message: ChatMessage) => void; onVisibilityChange: (visible: boolean) => void; onRolls: (open: boolean) => void; onTuck?: () => void; children: ReactNode;
}) {
  const [prefs, setPrefs] = useState(() => readScrollPreferences(storageKey));
  const [app, setApp] = useState<App>(() => { try {const saved=sessionStorage.getItem(`${storageKey}:app`);return saved === "contacts" || saved === "settings" || saved === "rolls" ? saved : "messages";}catch{return "messages";} });
  const [locked, setLocked] = useState(() => {try{return sessionStorage.getItem(`${storageKey}:unlocked`) !== "yes";}catch{return true;}});
  useEffect(()=>{onRolls(app === "rolls");try{sessionStorage.setItem(`${storageKey}:app`,app);sessionStorage.setItem(`${storageKey}:unlocked`,locked?"no":"yes");}catch{}},[app,locked,storageKey]);
  useEffect(()=>{onVisibilityChange(!locked && app === "messages");},[locked,app,onVisibilityChange]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const dragY = useRef<number | null>(null);
  const [sound, setSound] = useState(chatSoundEnabled);
  useEffect(() => { setPrefs(readScrollPreferences(storageKey)); }, [storageKey]);
  const patch = (change: Partial<Preferences>) => {
    const next = { ...prefs, ...change }; setPrefs(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); window.dispatchEvent(new Event("scroll:preferences")); }
    catch { setError("Your browser could not save this setting. It will last until you leave this page."); }
  };
  const go = (next: App) => { if (prefs.interfaceSound) playScrollSound("tap", true); setApp(next); setLocked(false); onRolls(next === "rolls"); };
  const wallpaper = WALLPAPERS[prefs.wallpaper] ?? prefs.wallpaper;
  const style = { "--signature-accent": ACCENTS[prefs.accent][0], "--signature-bubble": ACCENTS[prefs.accent][1], "--signature-wallpaper": wallpaper ? `url("${wallpaper}")` : "none" } as CSSProperties;
  const latest = messages.filter(m => m.userId !== myId).at(-1);
  const contacts = [...new Map(messages.filter(m => m.channel === "whisper" && m.userId !== myId && m.speaker).map(m => [`${m.userId}:${m.speaker}`, m])).values()];
  return <div className={`signature-shell finish-${prefs.finish}${locked ? " is-locked" : ""}`} style={style}>
    <img className="signature-casing" src="/assets/scroll/casing.webp" alt=""/><div className="signature-hardware" title="Drag down to put away" onPointerDown={e=>{dragY.current=e.clientY;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={e=>{if(dragY.current !== null && e.clientY-dragY.current>45)onTuck?.();dragY.current=null;}} onPointerCancel={()=>{dragY.current=null;}}><span/><i/><span/></div>
    <div className="signature-screen">
      <div className="signature-status"><span>CCT <span className="signature-signal" aria-hidden="true"><i/><i/><i/><i/></span></span><span>{clock.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit",hour12:false})}</span><span>{aura == null ? "Scroll" : `Aura ${aura}%`}</span></div>
      <div className="signature-tools">
        {!locked && <button type="button" aria-label="Lock Scroll" onClick={() => setLocked(true)}><ScrollIcon name={prefs.emblem}/></button>}
        {onTuck && <button type="button" className="signature-tuck" aria-label="Put your Scroll away" onClick={onTuck}><ScrollIcon name="up"/></button>}
      </div>
      {locked ? <section className="signature-lock" aria-label="Scroll lock screen">
        <time>{clock.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit",hour12:false})}</time><h2>{characterName}</h2>
        <div className="signature-emblem">{prefs.emblem === "rose" ? <img src="/assets/scroll/rose.webp" alt=""/> : <ScrollIcon name={prefs.emblem}/>}</div>
        {latest && <button className="signature-notification" type="button" onClick={() => { onMessage(latest); go("messages"); }}><Avatar name={latest.speaker || latest.userName} id={latest.userId} size={34}/><span><strong>{latest.speaker || latest.userName}</strong><span>{latest.body}</span></span></button>}
        <button type="button" className="signature-unlock" onClick={() => go("messages")}><ScrollIcon name="up"/><span>Open Scroll</span></button>
      </section> : null}
      <div className="signature-chat" hidden={locked || app === "contacts" || app === "settings"}>{children}</div>
      {!locked && app === "contacts" && <section className="signature-panel" aria-label="Scroll contacts"><h2>Contacts</h2><p>Your party and the people who have contacted you.</p>
        {contacts.map(m => <button type="button" className="signature-contact" key={`${m.userId}:${m.speaker}`} disabled={!canChat} onClick={() => {onContact(m.userId,m);go("messages");}}><Avatar name={m.speaker || m.userName} id={m.userId} size={38}/><span><strong>{m.speaker}</strong><small>Contact · Reply privately</small></span><ScrollIcon name="messages"/></button>)}
        {members.filter(m=>m.id!==myId).map(m=><button type="button" className="signature-contact" key={m.id} disabled={!canChat} onClick={()=>{onContact(m.id);go("messages");}}><Avatar name={m.display_name} src={m.avatar_path} id={m.id} size={38}/><span><strong>{m.display_name}</strong><small>{m.role === "dm" ? "Game Master" : "Party member"}</small></span><ScrollIcon name="messages"/></button>)}
        {members.length < 2 && !contacts.length && <p>No contacts yet. Party members appear here when they join.</p>}
      </section>}
      {!locked && app === "settings" && <section className="signature-panel signature-settings" aria-label="Scroll settings"><h2>Make it yours</h2><p>Saved on this browser for this account and campaign.</p>
        <fieldset><legend>Case finish</legend><div className="signature-choices">{["graphite","ivory","field"].map(f=><button type="button" key={f} aria-pressed={prefs.finish===f} onClick={()=>patch({finish:f})}>{f}</button>)}</div></fieldset>
        <fieldset><legend>Accent colour</legend><div className="signature-choices">{Object.entries(ACCENTS).map(([name,colours])=><button type="button" key={name} aria-pressed={prefs.accent===name} onClick={()=>patch({accent:name})}><i style={{background:colours[0]}}/>{name}</button>)}</div></fieldset>
        <fieldset><legend>Wallpaper</legend><div className="signature-wallpapers">{Object.entries(WALLPAPERS).map(([name,url])=><button type="button" key={name} aria-pressed={prefs.wallpaper===name} onClick={()=>patch({wallpaper:name})}><span style={{backgroundImage:url?`url(${url})`:"none"}}/>{name}</button>)}</div>
          <label className="signature-upload">{uploading ? "Uploading…" : "Upload your own"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;setUploading(true);setError("");try{patch({wallpaper:await uploadImage(file)});}catch(err){setError(err instanceof Error?err.message:"Upload failed. Try again.");}finally{setUploading(false);}}}/></label>
        </fieldset>
        <fieldset><legend>Personal emblem</legend><div className="signature-choices">{["rose","moon","crest"].map(e=><button type="button" key={e} aria-label={`${e} emblem`} aria-pressed={prefs.emblem===e} onClick={()=>patch({emblem:e})}><ScrollIcon name={e}/>{e}</button>)}</div></fieldset>
        <fieldset><legend>Sound &amp; touch</legend>
          <label><input type="checkbox" checked={sound} onChange={e=>{setSound(e.target.checked);setChatSoundEnabled(e.target.checked);}}/> Notification sounds</label>
          <label><input type="checkbox" checked={prefs.interfaceSound} onChange={e=>patch({interfaceSound:e.target.checked})}/> Interface sounds</label>
          <label><input type="checkbox" checked={prefs.vibration} onChange={e=>patch({vibration:e.target.checked})}/> Vibration when supported</label>
          <button type="button" disabled={!sound} onClick={()=>playChatSound("whisper",true)}>Preview notification</button>
        </fieldset>{error&&<p role="alert">{error}</p>}
      </section>}
      {!locked && <nav className="signature-apps" aria-label="Scroll apps">{(["messages","contacts","rolls","settings"] as App[]).map(name=><button type="button" key={name} aria-current={app===name?"page":undefined} onClick={()=>go(name)}><ScrollIcon name={name}/><span>{name}</span></button>)}</nav>}
    </div><div className="signature-chin"><ScrollIcon name={prefs.emblem}/><span>SCROLL</span></div>
  </div>;
}
