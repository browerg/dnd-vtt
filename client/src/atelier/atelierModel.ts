import type { RollPayload } from "../api";
import type { Character, CharacterSummary } from "../sheet";
import { REMNANT_ATTRIBUTES, type RemnantData } from "../remnant";
import type { GridItem } from "../dashboard/layouts";

// View models for the Schnee Atelier dashboard. The panels are presentational:
// the live dashboard maps real campaign data into these shapes, and the
// Example page fills them with the approved comp's sample content.

export interface AtelierStat {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface AtelierCharacter {
  name: string;
  subtitle: string;
  portraitUrl: string;
  emblemUrl?: string;
  auraColor?: string;
  lines: string[];
  aura: number;
  auraMax: number;
  stats: AtelierStat[];
  weapon?: { name: string; subtitle: string; tags: string[]; imageUrl?: string };
  sheetHref?: string;
}

export interface AtelierMission {
  title: string;
  region: string;
  description: string;
  steps: { title: string; detail: string }[];
}

export interface AtelierTeamMember {
  id: number;
  name: string;
  portraitUrl: string;
  hp: number;
  maxHp: number;
  aura?: number;
  auraMax?: number;
  emblemUrl?: string;
  online?: boolean;
  href?: string;
}

export interface AtelierLogEntry {
  id: number;
  name: string;
  portraitUrl: string;
  rolled: string;
  total: string;
  tone: "rose" | "steel";
  detail: string;
  title?: string;
  time: string;
}

// Grid metrics for this theme: tighter gutters like the comp. 34 + 8 keeps the
// same 42px per row as the classic grid, so saved layouts keep their size.
export const ATELIER_GRID = {
  rowHeight: 34,
  margin: [8, 8] as [number, number],
  containerPadding: [28, 6] as [number, number],
};

// The comp's arrangement: character down the left, mission + dice in the
// middle, team + log on the right. Applied only when the player asks for it.
export const ATELIER_ARRANGEMENT: Record<string, Pick<GridItem, "x" | "y" | "w" | "h">> = {
  sheet: { x: 0, y: 0, w: 3, h: 17 },
  notes: { x: 3, y: 0, w: 6, h: 10 },
  dice: { x: 3, y: 10, w: 6, h: 7 },
  party: { x: 9, y: 0, w: 3, h: 10 },
  rolls: { x: 9, y: 10, w: 3, h: 7 },
};

export function arrangeLikeAtelier(layout: GridItem[]): GridItem[] {
  // The roster can take the team slot when the party panel isn't placed.
  const hasParty = layout.some((item) => item.i === "party");
  let y = 17;
  return layout.map((item) => {
    const slot = ATELIER_ARRANGEMENT[item.i] ?? (!hasParty && item.i === "roster" ? ATELIER_ARRANGEMENT.party : undefined);
    if (slot) return { ...item, ...slot };
    const placed = { ...item, x: 0, y };
    y += item.h;
    return placed;
  });
}

/**
 * Notes read as a mission brief: the first line is the title, "• " / "- " /
 * "1." lines become numbered steps (a plain line under a step is its detail),
 * "📍 Somewhere" or "Region: Somewhere" is the location tag, and anything
 * before the first step is the description.
 */
export function parseMission(body: string): AtelierMission {
  const mission: AtelierMission = { title: "", region: "", description: "", steps: [] };
  const description: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const region = line.match(/^(?:📍|@|(?:region|location)\s*:)\s*(.+)$/i);
    const step = line.match(/^(?:[•\-*–·]|\d+[.)])\s*(.+)$/);
    if (region) mission.region = region[1];
    else if (step) mission.steps.push({ title: step[1], detail: "" });
    else if (!mission.title) mission.title = line;
    else if (mission.steps.length) {
      const last = mission.steps[mission.steps.length - 1];
      last.detail = last.detail ? `${last.detail} ${line}` : line;
    } else description.push(line);
  }
  mission.description = description.join(" ");
  return mission;
}

const RANGE_TAG: Record<string, string> = { Close: "Melee", Mid: "Ranged", Long: "Ranged" };

export function characterCard(character: Character, campaignId: number): AtelierCharacter {
  const data = character.data as unknown as RemnantData;
  const forms = (data.weaponForms ?? []).filter((form) => form.type.trim());
  const tags = [...new Set(forms.map((form) => RANGE_TAG[form.range] ?? form.range).filter(Boolean))];
  if (forms.length > 1) tags.push("Transforming");
  const academy = data.academy ? `${data.academy} Academy${data.academyYear ? ` · Year ${data.academyYear}` : ""}` : "";
  return {
    name: character.name,
    subtitle: [data.rank, data.archetype].filter(Boolean).join(" "),
    portraitUrl: character.portraitUrl,
    auraColor: data.auraColor,
    lines: [data.teamName ? `Team ${data.teamName}` : "", academy].filter(Boolean),
    aura: Number(data.aura) || 0,
    auraMax: Number(data.auraMax) || 0,
    stats: REMNANT_ATTRIBUTES.map((attr) => ({
      label: attr.name,
      value: `d${data.attributes?.[attr.key] ?? 4}`,
      highlight: data.mainAttribute === attr.key,
    })),
    weapon: data.weaponName
      ? { name: data.weaponName, subtitle: forms.map((form) => form.type).join(" / "), tags }
      : undefined,
    sheetHref: `/campaigns/${campaignId}/characters/${character.id}`,
  };
}

export function teamMembers(
  characters: CharacterSummary[],
  opts: { campaignId: number; myId: number; isDM: boolean; online: Set<number> }
): AtelierTeamMember[] {
  return characters
    .filter((c) => !c.isNpc)
    .map((c) => ({
      id: c.id,
      name: c.name,
      portraitUrl: c.portraitUrl,
      hp: c.hp,
      maxHp: c.maxHp,
      aura: c.aura,
      auraMax: c.auraMax,
      online: opts.online.has(c.ownerId),
      href: opts.isDM || c.ownerId === opts.myId ? `/campaigns/${opts.campaignId}/characters/${c.id}` : undefined,
    }));
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function breakdown(roll: RollPayload): string {
  const kept = roll.detail?.kept;
  if (!kept) return "";
  let text = kept.groups.map((g) => `${g.count}d${g.sides} [${g.results.join(", ")}]`).join(" + ");
  if (kept.modifier) text += ` ${kept.modifier > 0 ? "+" : "−"} ${Math.abs(kept.modifier)}`;
  return text;
}

const MODE_WORD: Record<string, string> = { edge: "Edge", setback: "Setback", advantage: "Advantage", disadvantage: "Disadvantage" };

export function logEntries(rolls: RollPayload[], characters: CharacterSummary[]): AtelierLogEntry[] {
  const byOwner = new Map<number, CharacterSummary>();
  for (const c of characters) if (!c.isNpc && !byOwner.has(c.ownerId)) byOwner.set(c.ownerId, c);
  return rolls.map((roll) => {
    const pc = byOwner.get(roll.userId);
    const critical = roll.detail?.critical;
    const detail = [roll.label, MODE_WORD[roll.mode], roll.detail?.manual ? "rolled at the table" : ""]
      .filter(Boolean)
      .join(" · ");
    return {
      id: roll.id,
      name: pc?.name ?? roll.userName,
      portraitUrl: pc?.portraitUrl ?? "",
      rolled: `Rolled ${roll.formula}:`,
      total: roll.total == null ? "?" : String(roll.total),
      tone: critical ? "rose" : "steel",
      detail: detail || (roll.detail ? breakdown(roll) : "Blind roll — only the GM sees it"),
      title: breakdown(roll) || undefined,
      time: timeFormat.format(new Date(roll.createdAt)),
    };
  });
}
