import type { AtelierCharacter, AtelierLogEntry, AtelierMission, AtelierTeamMember } from "./atelierModel";

// Sample content from the approved Schnee Atelier comp. Art is cut straight
// from the comp (see assets/themes/schnee-atelier/example/PROVENANCE.json).
const ART = "/assets/themes/schnee-atelier/example";

export const EXAMPLE_ASSETS = { diceStage: `${ART}/dice-stage.webp` };

export const EXAMPLE_CHARACTER: AtelierCharacter = {
  name: "Ruby Rose",
  subtitle: "Huntress",
  portraitUrl: `${ART}/ruby-card.webp`,
  emblemUrl: `${ART}/emblem-ruby-card.webp`,
  lines: ["Team RWBY", "Vale Academy Alum"],
  aura: 42,
  auraMax: 50,
  stats: [
    { label: "STR", value: "12" },
    { label: "DEX", value: "18", highlight: true },
    { label: "WIS", value: "14" },
  ],
  weapon: {
    name: "Crescent Rose",
    subtitle: "High-caliber Sniper Scythe",
    tags: ["Ranged", "Melee", "Transforming"],
    imageUrl: `${ART}/weapon.webp`,
  },
};

export const EXAMPLE_MISSION: AtelierMission = {
  title: "Investigate the Emerald Forest",
  region: "Mistral Region",
  description:
    "Unusual Grimm activity has been reported in the Emerald Forest. The Council wants eyes on the area and any signs of organized movement.",
  steps: [
    { title: "Locate the source of the Grimm activity", detail: "Track the increased Grimm presence and identify its origin." },
    { title: "Search for evidence of organized forces", detail: "Look for signs of coordination, equipment, or human involvement." },
    { title: "Report back to the Council", detail: "Compile your findings and return to Mistral with a full report." },
  ],
};

export const EXAMPLE_TEAM: AtelierTeamMember[] = [
  { id: 1, name: "Ruby Rose", portraitUrl: `${ART}/ruby.webp`, hp: 28, maxHp: 32, aura: 42, auraMax: 50, emblemUrl: `${ART}/emblem-ruby.webp` },
  { id: 2, name: "Weiss Schnee", portraitUrl: `${ART}/weiss.webp`, hp: 26, maxHp: 30, aura: 38, auraMax: 50, emblemUrl: `${ART}/emblem-weiss.webp` },
  { id: 3, name: "Blake Belladonna", portraitUrl: `${ART}/blake.webp`, hp: 24, maxHp: 28, aura: 40, auraMax: 50, emblemUrl: `${ART}/emblem-blake.webp` },
  { id: 4, name: "Yang Xiao Long", portraitUrl: `${ART}/yang.webp`, hp: 30, maxHp: 34, aura: 46, auraMax: 50, emblemUrl: `${ART}/emblem-yang.webp` },
];

export const EXAMPLE_LOG: AtelierLogEntry[] = [
  { id: 1, name: "Ruby Rose", portraitUrl: `${ART}/ruby.webp`, rolled: "Rolled d20:", total: "18", tone: "rose", detail: "Athletics check — cleared the collapsed tree.", time: "10:24 PM" },
  { id: 2, name: "Weiss Schnee", portraitUrl: `${ART}/weiss.webp`, rolled: "Rolled d20:", total: "14", tone: "steel", detail: "Investigation check — found a trail of tracks.", time: "10:27 PM" },
  { id: 3, name: "Blake Belladonna", portraitUrl: `${ART}/blake.webp`, rolled: "Rolled d20:", total: "20", tone: "rose", detail: "Perception check — spotted movement in the trees.", time: "10:31 PM" },
];
