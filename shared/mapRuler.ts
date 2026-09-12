export type RulerCalibration =
  | { kind: "bands"; close: number; mid: number; long: number }
  | { kind: "scale"; pixels: number; distance: number };

export interface RulerSegment { x1: number; y1: number; x2: number; y2: number }

const validDistance = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 10_000_000;

export function validateRulerCalibration(value: unknown): RulerCalibration {
  if (!value || typeof value !== "object") throw new Error("Set the ruler distances first.");
  const v = value as Record<string, unknown>;
  if (v.kind === "bands" && validDistance(v.close) && validDistance(v.mid) && validDistance(v.long)
    && v.close >= 5 && v.close < v.mid && v.mid < v.long) {
    return { kind: "bands", close: v.close, mid: v.mid, long: v.long };
  }
  if (v.kind === "scale" && validDistance(v.pixels) && v.pixels >= 5 && validDistance(v.distance)) {
    return { kind: "scale", pixels: v.pixels, distance: v.distance };
  }
  throw new Error("Use a span of at least 5 map pixels. Range limits must increase from Close to Mid to Long; distances must be positive.");
}

export function readRulerCalibration(raw: unknown): RulerCalibration | null {
  try { return validateRulerCalibration(typeof raw === "string" ? JSON.parse(raw) : raw); }
  catch { return null; }
}

export const rulerPixels = (line: RulerSegment) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1);

export function rulerLabel(line: RulerSegment, calibration: RulerCalibration | null): string {
  if (!calibration) return "GM calibration required";
  const pixels = rulerPixels(line);
  if (calibration.kind === "bands") {
    return pixels <= calibration.close ? "Close" : pixels <= calibration.mid ? "Mid" : pixels <= calibration.long ? "Long" : "Extreme";
  }
  const feet = pixels * calibration.distance / calibration.pixels;
  return `${Number(feet.toFixed(1))} ft`;
}
