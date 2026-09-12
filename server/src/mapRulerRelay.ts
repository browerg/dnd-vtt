import type { DatabaseSync } from "node:sqlite";
import { readRulerCalibration, type RulerSegment } from "../../shared/mapRuler.js";

export function canRelayRuler(db: DatabaseSync, campaignId: number, mapId: number, line: RulerSegment) {
  if (!Number.isSafeInteger(campaignId) || !Number.isSafeInteger(mapId)) return false;
  if (![line.x1, line.y1, line.x2, line.y2].every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 10_000_000)) return false;
  const map = db.prepare("SELECT ruler_calibration FROM maps WHERE id = ? AND campaign_id = ? AND active = 1").get(mapId, campaignId);
  return !!map && !!readRulerCalibration(map.ruler_calibration);
}
