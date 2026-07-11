import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db } from "./db.js";

// The 15 handbook Grimm ship with every Remnant campaign as campaign-scoped
// custom monsters, so each DM can tweak or delete them for their own game.
let grimmCache: any[] | null = null;

function grimmData(): any[] {
  if (!grimmCache) {
    const p = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "srd", "grimm.json");
    grimmCache = JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) as any[];
  }
  return grimmCache;
}

// Threat (1-5) doubles as the cr sort column so list ordering stays sane.
export function seedGrimm(campaignId: number) {
  const insert = db.prepare(
    "INSERT INTO monsters (source, campaign_id, name, cr, data) VALUES ('custom', ?, ?, ?, ?)"
  );
  for (const g of grimmData()) {
    insert.run(campaignId, g.name, Number(g.threat) || 1, JSON.stringify(g));
  }
}

// Remnant campaigns created before Grimm seeding existed get theirs at boot.
export function backfillGrimm() {
  const rows = db
    .prepare(
      `SELECT id FROM campaigns WHERE system = 'remnant' AND id NOT IN (
         SELECT campaign_id FROM monsters
         WHERE campaign_id IS NOT NULL AND json_extract(data, '$.system') = 'remnant'
       )`
    )
    .all() as { id: number }[];
  for (const r of rows) {
    try {
      seedGrimm(r.id);
      console.log(`seeded Grimm bestiary for campaign ${r.id}`);
    } catch (e) {
      console.warn("Grimm seed skipped:", (e as Error).message);
    }
  }
}
