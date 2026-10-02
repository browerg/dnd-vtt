import { useEffect, useRef, useState } from "react";
import DiceBox from "@3d-dice/dice-box-threejs";
import { applyDiceBoxCustomization, decodeDiceCustomization } from "../diceCustomization";
import { applyDiceCosmetic, DICE_COSMETICS, type CosmeticAnimation } from "../diceCosmetics";

// The engine's declaration omits its public scene and factory APIs.
type StudioBox = DiceBox & { [key: string]: any };
let nextId = 0;
async function appearance(box: StudioBox, theme: string) {
  const custom = decodeDiceCustomization(theme);
  if (DICE_COSMETICS[theme]) return applyDiceCosmetic(box, DICE_COSMETICS[theme]);
  if (custom) await applyDiceBoxCustomization(box, custom);
  else await box.updateConfig({ theme_customColorset: null, theme_colorset: theme || "white" });
}
function makeBox(id: string) {
  const engine = new DiceBox(`#${id}`, { assetPath: "/assets/dice/", sounds: false, shadows: false, light_intensity: 1.05, baseScale: 100, theme_colorset: "white" }) as StudioBox;
  engine.resizeWorld = () => {}; // ResizeObserver owns resizing and cleanup.
  return engine;
}
function meshFor(box: StudioBox, sides: number) {
  const mesh = box.DiceFactory.create(`d${sides}`);
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(-.35, .58, .08);
  mesh.castShadow = false;
  box.scene.add(mesh);
  return mesh;
}
function cleanBox(box: StudioBox) {
  try { box.clearDice(); box.renderer?.dispose(); box.renderer?.forceContextLoss(); } catch { /* Initialization may have been interrupted. */ }
}

/** One live renderer, shared by the collection inspector and the workshop. */
export default function CollectionDicePreview({ theme, sides, onSides }: { theme: string; sides: number; onSides: (sides: number) => void }) {
  const [id] = useState(() => `collection-die-${++nextId}`);
  const host = useRef<HTMLDivElement>(null);
  const box = useRef<StudioBox>();
  const mesh = useRef<any>();
  const score = useRef<CosmeticAnimation>();
  const sequence = useRef(Promise.resolve());
  const version = useRef(0);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  useEffect(() => {
    let disposed = false, frame = 0, last = 0;
    const engine = makeBox(id); box.current = engine;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => {
      if (!engine.camera || !host.current) return;
      engine.setDimensions({ x: host.current.clientWidth, y: host.current.clientHeight });
      engine.camera.position.z = 850; engine.desk.visible = false; engine.camera.zoom = 1; engine.camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    void engine.initialize().then(() => {
      if (disposed) { cleanBox(engine); return; }
      if (engine.desk) engine.desk.visible = false;
      resize(); observer.observe(host.current!); setReady(true);
      const animate = (now: number) => {
        const delta = Math.min((now - last) / 1000, .04); last = now;
        if (mesh.current && !drag.current && !pausedRef.current && !reduced.matches && !document.hidden) mesh.current.rotation.y += delta * .24;
        engine.renderer.render(engine.scene, engine.camera);
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    }).catch(() => { if (!disposed) setError("3D preview unavailable. You can still choose and equip dice."); });
    return () => { disposed = true; version.current++; observer.disconnect(); cancelAnimationFrame(frame); score.current?.dispose(); if (mesh.current) engine.scene?.remove(mesh.current); cleanBox(engine); box.current = undefined; };
  }, [id]);
  useEffect(() => {
    if (!ready) return;
    const request = ++version.current;
    const timer = setTimeout(() => {
      sequence.current = sequence.current.catch(() => {}).then(async () => {
        const engine = box.current;
        if (!engine || request !== version.current) return;
        score.current?.dispose(); score.current = undefined;
        if (mesh.current) { engine.scene.remove(mesh.current); mesh.current = undefined; }
        const animation = await appearance(engine, theme);
        if (request !== version.current) { animation?.dispose(); return; }
        score.current = animation;
        mesh.current = meshFor(engine, sides);
        setError("");
      }).catch(() => setError("Couldn't load this preview. Select another die to try again."));
    }, 80);
    return () => { clearTimeout(timer); version.current++; };
  }, [theme, sides, ready]);
  return <div className="collection-live-dice">
    <div ref={host} id={id} className="collection-die-stage" tabIndex={0} role="img" aria-label={`Live D${sides}. Drag or use arrow keys to rotate.`}
      onKeyDown={e => { if (mesh.current && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); mesh.current.rotation[e.key === "ArrowLeft" || e.key === "ArrowRight" ? "y" : "x"] += e.key === "ArrowLeft" || e.key === "ArrowUp" ? -.2 : .2; } }}
      onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (!drag.current || !mesh.current) return; mesh.current.rotation.y += (e.clientX - drag.current.x) * .01; mesh.current.rotation.x += (e.clientY - drag.current.y) * .01; drag.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {error ? <p className="preview-status">{error}</p> : !ready ? <p className="preview-status">Loading your die…</p> : null}
    </div>
    <div className="collection-spin"><span>Drag to rotate · arrow keys work too</span><button onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? "Rotate" : "Pause"}</button></div>
    <div className="collection-shapes" aria-label="Preview die shape">{[4, 6, 8, 10, 12, 20].map(value => <button key={value} aria-pressed={sides === value} onClick={() => onSides(value)}>D{value}</button>)}</div>
  </div>;
}

// A single offscreen renderer makes genuine material thumbnails sequentially.
// Never allocate one WebGL context per inventory tile.
const thumbnails = new Map<string, Promise<string>>();
let thumbnailQueue = Promise.resolve();
let thumbnailBox: StudioBox | undefined;
let thumbnailHost: HTMLDivElement | undefined;
let thumbnailExpiry: ReturnType<typeof setTimeout> | undefined;
function thumbnail(theme: string): Promise<string> {
  const cached = thumbnails.get(theme); if (cached) return cached;
  const result = new Promise<string>((resolve, reject) => {
    thumbnailQueue = thumbnailQueue.catch(() => {}).then(async () => {
      clearTimeout(thumbnailExpiry);
      let animation: CosmeticAnimation | undefined, mesh: any;
      try {
        if (!thumbnailBox) {
          thumbnailHost = document.createElement("div"); thumbnailHost.id = `collection-thumb-${++nextId}`;
          thumbnailHost.style.cssText = "position:fixed;left:-10000px;top:0;width:256px;height:256px;pointer-events:none";
          document.body.appendChild(thumbnailHost);
          thumbnailBox = makeBox(thumbnailHost.id); await thumbnailBox.initialize();
          if (thumbnailBox.desk) thumbnailBox.desk.visible = false;
          thumbnailBox.camera.position.z = 850; thumbnailBox.camera.zoom = 1; thumbnailBox.camera.updateProjectionMatrix();
        }
        animation = await appearance(thumbnailBox, theme); mesh = meshFor(thumbnailBox, 20);
        thumbnailBox.renderer.render(thumbnailBox.scene, thumbnailBox.camera);
        resolve(thumbnailBox.renderer.domElement.toDataURL("image/png"));
      } catch (error) { thumbnails.delete(theme); reject(error); }
      finally {
        animation?.dispose(); if (mesh) thumbnailBox?.scene.remove(mesh);
        thumbnailExpiry = setTimeout(() => { if (thumbnailBox) cleanBox(thumbnailBox); thumbnailBox = undefined; thumbnailHost?.remove(); thumbnailHost = undefined; }, 2000);
      }
    });
  });
  thumbnails.set(theme, result);
  return result;
}
export function DiceThumbnail({ theme }: { theme: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { let active = true; setSrc(""); void thumbnail(theme).then(url => { if (active) setSrc(url); }).catch(() => {}); return () => { active = false; }; }, [theme]);
  return src ? <img src={src} alt="" loading="lazy" /> : <span className="dice-thumbnail-loading" aria-hidden="true">D20</span>;
}
