import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";

// Monster lookups and homebrew. SRD monsters are global (campaign_id NULL);
// custom monsters belong to a campaign and are managed by its DM.

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";

const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const ABILITY_KEYS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const FEROCITY_DICE = [4, 6, 8, 10, 12];
const REMNANT_ATTRS = ["brawn", "finesse", "resolve", "wit", "aura", "grit"];
// vivid-monster-library-completion-v1

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Normalize a submitted stat block into the same shape the SRD data uses,
// so the map's stat block panel works identically for both.
function sanitizeStatblock(b: any): { data: Record<string, unknown>; cr: number; name: string } | string {
  const name = String(b?.name ?? "").trim();
  if (!name) return "The monster needs a name.";
  const cr = num(b.cr, 0, 0, 40);
  const data: Record<string, unknown> = {
    name,
    size: SIZES.includes(b.size) ? b.size : "Medium",
    type: String(b.type ?? "").trim() || "monstrosity",
    challenge_rating: String(cr),
    armor_class: num(b.armorClass, 10, 1, 40),
    hit_points: num(b.hitPoints, 10, 1, 2000),
    hit_dice: String(b.hitDice ?? "").trim(),
    speed: { walk: num(b.speedWalk, 30, 0, 300), ...(num(b.speedFly, 0, 0, 300) ? { fly: num(b.speedFly, 0, 0, 300) } : {}) },
    senses: String(b.senses ?? "").trim(),
    languages: String(b.languages ?? "").trim(),
  };
  for (const k of ABILITY_KEYS) data[k] = num(b[k], 10, 1, 40);
  const list = (v: unknown, mapFn: (x: any) => any) =>
    Array.isArray(v) ? v.map(mapFn).filter((x) => x.name) : [];
  data.special_abilities = list(b.specialAbilities, (a) => ({
    name: String(a?.name ?? "").trim(),
    desc: String(a?.desc ?? "").trim(),
  }));
  data.actions = list(b.actions, (a) => {
    const attackBonus = Number(a?.attack_bonus);
    const damageBonus = Number(a?.damage_bonus);
    return {
      name: String(a?.name ?? "").trim(),
      desc: String(a?.desc ?? "").trim(),
      ...(Number.isFinite(attackBonus) ? { attack_bonus: Math.round(attackBonus) } : {}),
      ...(String(a?.damage_dice ?? "").trim() ? { damage_dice: String(a.damage_dice).trim() } : {}),
      ...(Number.isFinite(damageBonus) && damageBonus !== 0 ? { damage_bonus: Math.round(damageBonus) } : {}),
    };
  });
  return { data, cr, name };
}

// Remnant Grimm are a different shape: Threat 1-5, a Ferocity die, flat Armor,
// HP and freeform traits. Threat doubles as the cr sort column.
function sanitizeGrimm(b: any): { data: Record<string, unknown>; cr: number; name: string } | string {
  const name = String(b?.name ?? "").trim();
  if (!name) return "The monster needs a name.";
  const threat = num(b.threat, 1, 1, 10);
  const stringList = (value: unknown) => Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean).slice(0, 50)
    : [];
  const attributes: Record<string, number> = {};
  for (const key of REMNANT_ATTRS) attributes[key] = FEROCITY_DICE.includes(Number(b?.attributes?.[key])) ? Number(b.attributes[key]) : 6;
  const actions = Array.isArray(b.actions) ? b.actions.map((action: any) => ({
    name: String(action?.name ?? "").trim(),
    desc: String(action?.desc ?? "").trim(),
    kind: String(action?.kind ?? "Attack").trim(),
    attribute: String(action?.attribute ?? "ferocity").trim(),
    rollMode: ["normal", "edge", "setback"].includes(action?.rollMode) ? action.rollMode : "normal",
    damageDice: String(action?.damageDice ?? "").trim(),
    damageBonus: num(action?.damageBonus, 0, -100, 100),
    range: String(action?.range ?? "").trim(),
    targets: String(action?.targets ?? "").trim(),
    auraCost: num(action?.auraCost, 0, 0, 999),
    maxUses: num(action?.maxUses, 0, 0, 999),
    recharge: String(action?.recharge ?? "").trim(),
  })).filter((action: any) => action.name).slice(0, 50) : [];
  const data: Record<string, unknown> = {
    system: "remnant",
    name,
    subtitle: String(b.subtitle ?? "").trim(),
    threat,
    ferocity: FEROCITY_DICE.includes(Number(b.ferocity)) ? Number(b.ferocity) : 6,
    armor: num(b.armor, 0, 0, 30),
    hit_points: num(b.hitPoints, 10, 1, 5000),
    aura: num(b.aura, 0, 0, 5000),
    defense: num(b.defense, 8, 1, 100),
    movement: num(b.movement, 30, 0, 1000),
    size: SIZES.includes(b.size) ? b.size : "Medium",
    type: String(b.type ?? "").trim() || "Creature of Grimm",
    category: String(b.category ?? "").trim() || "Grimm",
    tags: stringList(b.tags),
    initiativeAttribute: REMNANT_ATTRS.includes(b.initiativeAttribute) ? b.initiativeAttribute : "finesse",
    mainAttribute: b.mainAttribute === "ferocity" || REMNANT_ATTRS.includes(b.mainAttribute) ? b.mainAttribute : "ferocity",
    attributes,
    trainedSkills: stringList(b.trainedSkills),
    resistances: stringList(b.resistances),
    immunities: stringList(b.immunities),
    vulnerabilities: stringList(b.vulnerabilities),
    conditionImmunities: stringList(b.conditionImmunities),
    description: String(b.description ?? "").trim(),
    gmNotes: String(b.gmNotes ?? "").trim(),
    tokenImageUrl: /^\/uploads\/[A-Za-z0-9._-]+$/.test(String(b.tokenImageUrl ?? "")) ? String(b.tokenImageUrl) : "",
    portraitUrl: /^\/uploads\/[A-Za-z0-9._-]+$/.test(String(b.portraitUrl ?? "")) ? String(b.portraitUrl) : "",
    tokenScale: num(b.tokenScale, 1, 0.5, 2.5),
    tokenMode: b.tokenMode === "cover" ? "cover" : "contain",
    traits: Array.isArray(b.traits)
      ? b.traits.map((t: any) => ({ name: String(t?.name ?? "").trim(), desc: String(t?.desc ?? "").trim() })).filter((t: any) => t.name).slice(0, 50)
      : [],
    actions,
  };
  return { data, cr: threat, name };
}

function monsterRow(id: number): any | null {
  return db.prepare("SELECT id, source, campaign_id, name, cr, data FROM monsters WHERE id = ?").get(id) ?? null;
}

function requireCampaignDM(req: Request, res: any, campaignId: number): boolean {
  if (!Number.isInteger(campaignId)) {
    res.status(400).json({ error: "Missing campaign." });
    return false;
  }
  const role = memberRole(campaignId, user(req).id);
  if (!role) {
    res.status(404).json({ error: "Campaign not found." });
    return false;
  }
  if (!isDMRole(role)) {
    res.status(403).json({ error: "Only the DM manages homebrew monsters." });
    return false;
  }
  return true;
}

export const monstersRouter = Router();
monstersRouter.use(requireAuth);

monstersRouter.get("/", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const campaignId = req.query.campaignId ? Number(req.query.campaignId) : null;
  const includeCustom = campaignId !== null && memberRole(campaignId, user(req).id) !== null;

  let sql = `SELECT id, source, campaign_id, name, cr, data FROM monsters
             WHERE (campaign_id IS NULL${includeCustom ? " OR campaign_id = ?" : ""})`;
  const params: (string | number)[] = includeCustom ? [campaignId!] : [];
  if (q) {
    sql += " AND name LIKE ? COLLATE NOCASE";
    params.push(`%${q}%`);
  }
  sql += " ORDER BY (campaign_id IS NULL), name LIMIT 60";
  const rows = db.prepare(sql).all(...params) as any[];
  res.json({
    monsters: rows.map((r) => {
      const d = JSON.parse(r.data);
      return {
        id: r.id,
        source: r.source,
        system: d.system ?? "dnd5e",
        name: r.name,
        cr: r.cr,
        type: d.type ?? "",
        size: d.size ?? "",
        hp: d.hit_points ?? 0,
        ac: d.armor_class ?? 10,
        // Remnant-only stats; undefined for 5e blocks.
        threat: d.threat,
        armor: d.armor,
        ferocity: d.ferocity,
        category: d.category,
        tags: d.tags,
        tokenImageUrl: d.tokenImageUrl,
        portraitUrl: d.portraitUrl,
      };
    }),
  });
});

monstersRouter.get("/:id", (req, res) => {
  const row = monsterRow(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Monster not found." });
  if (row.campaign_id && !memberRole(row.campaign_id, user(req).id)) {
    return res.status(404).json({ error: "Monster not found." });
  }
  res.json({
    monster: { id: row.id, source: row.source, campaignId: row.campaign_id, cr: row.cr, ...JSON.parse(row.data) },
  });
});

monstersRouter.post("/", (req, res) => {
  const campaignId = Number(req.body?.campaignId);
  if (!requireCampaignDM(req, res, campaignId)) return;
  const parsed = req.body?.system === "remnant" ? sanitizeGrimm(req.body) : sanitizeStatblock(req.body);
  if (typeof parsed === "string") return res.status(400).json({ error: parsed });
  const info = db
    .prepare("INSERT INTO monsters (source, campaign_id, name, cr, data) VALUES ('custom', ?, ?, ?, ?)")
    .run(campaignId, parsed.name, parsed.cr, JSON.stringify(parsed.data));
  res.json({ id: Number(info.lastInsertRowid) });
});

monstersRouter.put("/:id", (req, res) => {
  const row = monsterRow(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Monster not found." });
  if (row.source !== "custom") return res.status(400).json({ error: "SRD monsters can't be edited — clone one instead." });
  if (!requireCampaignDM(req, res, row.campaign_id)) return;
  // The stored shape decides the schema so a Grimm can't be mangled into a 5e block.
  const parsed =
    JSON.parse(row.data).system === "remnant" ? sanitizeGrimm(req.body) : sanitizeStatblock(req.body);
  if (typeof parsed === "string") return res.status(400).json({ error: parsed });
  db.prepare("UPDATE monsters SET name = ?, cr = ?, data = ? WHERE id = ?").run(
    parsed.name,
    parsed.cr,
    JSON.stringify(parsed.data),
    row.id
  );
  res.json({ ok: true });
});

monstersRouter.delete("/:id", (req, res) => {
  const row = monsterRow(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Monster not found." });
  if (row.source !== "custom") return res.status(400).json({ error: "SRD monsters can't be deleted." });
  if (!requireCampaignDM(req, res, row.campaign_id)) return;
  db.prepare("DELETE FROM monsters WHERE id = ?").run(row.id);
  res.json({ ok: true });
});

monstersRouter.post("/:id/clone", (req, res) => {
  const row = monsterRow(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Monster not found." });
  if (row.campaign_id && !memberRole(row.campaign_id, user(req).id)) {
    return res.status(404).json({ error: "Monster not found." });
  }
  const campaignId = Number(req.body?.campaignId);
  if (!requireCampaignDM(req, res, campaignId)) return;
  const data = JSON.parse(row.data);
  const name = `${row.name} (custom)`;
  data.name = name;
  const info = db
    .prepare("INSERT INTO monsters (source, campaign_id, name, cr, data) VALUES ('custom', ?, ?, ?, ?)")
    .run(campaignId, name, row.cr, JSON.stringify(data));
  res.json({ id: Number(info.lastInsertRowid) });
});
