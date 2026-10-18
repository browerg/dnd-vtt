import { useEffect, useId, useRef } from "react";
import { DEFAULT_PORTRAIT_FRAME, portraitImageStyle, type PortraitFrame } from "../portraitFrame";
import "./PortraitFramer.css";

/** Drag the picture to choose what shows in the round frame; the slider zooms. Saves as you go. */
export default function PortraitFramer({ src, frame, onChange, onClose }: {
  src: string; frame: PortraitFrame; onChange: (frame: PortraitFrame) => void; onClose: () => void;
}) {
  const drag = useRef<{ x: number; y: number; frame: PortraitFrame } | null>(null);
  const zoomId = useId();
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    doneRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nudge = (dx: number, dy: number) => onChange({ ...frame, x: Math.min(100, Math.max(0, frame.x + dx)), y: Math.min(100, Math.max(0, frame.y + dy)) });

  return (
    <div className="portrait-framer" role="dialog" aria-label="Adjust portrait">
      <div
        className="portrait-framer-preview"
        tabIndex={0}
        aria-label="Portrait position. Drag, or use the arrow keys."
        onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, frame }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          // Dragging the picture right reveals more of its left side, so the focal point moves left.
          const size = event.currentTarget.clientWidth || 1;
          const scale = 100 / (size * start.frame.zoom);
          onChange({
            ...start.frame,
            x: Math.min(100, Math.max(0, start.frame.x - (event.clientX - start.x) * scale)),
            y: Math.min(100, Math.max(0, start.frame.y - (event.clientY - start.y) * scale)),
          });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 2;
          const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
          const move = moves[event.key];
          if (move) { event.preventDefault(); nudge(move[0], move[1]); }
        }}
      >
        <img src={src} alt="" draggable={false} style={portraitImageStyle(frame)} />
      </div>
      <label htmlFor={zoomId} className="portrait-framer-zoom">
        Zoom
        <input id={zoomId} type="range" min={1} max={3} step={0.05} value={frame.zoom}
          onChange={(event) => onChange({ ...frame, zoom: Number(event.target.value) })} />
      </label>
      <p className="muted small">Drag the picture to choose what shows in the circle.</p>
      <div className="portrait-framer-actions">
        <button type="button" className="ghost mini" onClick={() => onChange(DEFAULT_PORTRAIT_FRAME)}>Reset</button>
        <button ref={doneRef} type="button" className="primary mini" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
