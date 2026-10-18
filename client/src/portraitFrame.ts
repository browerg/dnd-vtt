import type { CSSProperties } from "react";

/** How a character portrait sits in its round frame: focal point (percent) and zoom. */
export interface PortraitFrame { x: number; y: number; zoom: number }

export const DEFAULT_PORTRAIT_FRAME: PortraitFrame = { x: 50, y: 50, zoom: 1 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Reads a saved frame from sheet data, falling back to centred and unzoomed. */
export function readPortraitFrame(value: unknown): PortraitFrame {
  const frame = (value && typeof value === "object" ? value : {}) as Partial<PortraitFrame>;
  const n = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  return { x: clamp(n(frame.x, 50), 0, 100), y: clamp(n(frame.y, 50), 0, 100), zoom: clamp(n(frame.zoom, 1), 1, 3) };
}

/** Style for an <img> filling a round, overflow-hidden frame. */
export function portraitImageStyle(frame: PortraitFrame): CSSProperties {
  const origin = `${frame.x}% ${frame.y}%`;
  return { objectFit: "cover", objectPosition: origin, transform: frame.zoom !== 1 ? `scale(${frame.zoom})` : undefined, transformOrigin: origin };
}
