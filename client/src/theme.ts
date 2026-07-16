import { useEffect, useMemo, useState } from "react";

export type ThemeId =
  | "huntsman-network"
  | "beacon-academy"
  | "atlas-command"
  | "shade-academy"
  | "haven-academy"
  | "academy-after-dark"
  | "ancient-parchment"
  | "arcane-observatory"
  | "dungeon-stone"
  | "minimal-dark";

export type ThemeOverride = "campaign" | ThemeId;

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  system: "remnant" | "dnd5e";
  description: string;
  brand: string;
  glyph: string;
  preview: [string, string, string];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "huntsman-network",
    name: "Huntsman Network",
    system: "remnant",
    description: "Tactical academy terminal with Grimm alerts and luminous Aura readouts.",
    brand: "REMNANT // HUNTSMAN NETWORK",
    glyph: "\u2726",
    preview: ["#070b13", "#d4aa52", "#e33145"],
  },
  {
    id: "beacon-academy",
    name: "Beacon Academy",
    system: "remnant",
    description: "Warm ivory, deep crimson and ceremonial gold.",
    brand: "BEACON ACADEMY // FIELD JOURNAL",
    glyph: "\u25C6",
    preview: ["#221619", "#e7c77b", "#a92f42"],
  },
  {
    id: "atlas-command",
    name: "Atlas Command",
    system: "remnant",
    description: "Cold steel, ice-blue diagnostics and military precision.",
    brand: "ATLAS COMMAND // OPERATIONS",
    glyph: "\u2B21",
    preview: ["#07131d", "#dcecf4", "#4ba6d3"],
  },
  {
    id: "shade-academy",
    name: "Shade Academy",
    system: "remnant",
    description: "Sun-baked amber, rugged metal and expedition markings.",
    brand: "SHADE ACADEMY // EXPEDITION LOG",
    glyph: "\u25B3",
    preview: ["#17120d", "#d99b43", "#815733"],
  },
  {
    id: "haven-academy",
    name: "Haven Academy",
    system: "remnant",
    description: "Jade lacquer, dark wood and refined gold ornament.",
    brand: "HAVEN ACADEMY // ARCHIVES",
    glyph: "\u25C7",
    preview: ["#071712", "#c7a958", "#3f8c69"],
  },
  {
    id: "academy-after-dark",
    name: "Academy After Dark",
    system: "dnd5e",
    description: "The original night-ink tabletop with engraved gold.",
    brand: "TABLETOP // ACADEMY AFTER DARK",
    glyph: "\u2727",
    preview: ["#12101b", "#cfa64f", "#765b9e"],
  },
  {
    id: "ancient-parchment",
    name: "Ancient Parchment",
    system: "dnd5e",
    description: "A warm illustrated chronicle with inked borders and aged paper.",
    brand: "THE ADVENTURER'S CHRONICLE",
    glyph: "\u2756",
    preview: ["#d7c39a", "#70441f", "#a96832"],
  },
  {
    id: "arcane-observatory",
    name: "Arcane Observatory",
    system: "dnd5e",
    description: "Midnight constellations, violet glass and cyan spell-light.",
    brand: "ARCANE OBSERVATORY // CELESTIAL INDEX",
    glyph: "\u273A",
    preview: ["#070a1c", "#8c71e8", "#55d7df"],
  },
  {
    id: "dungeon-stone",
    name: "Dungeon Stone",
    system: "dnd5e",
    description: "Carved slate, iron edges and ember-red accents.",
    brand: "THE DUNGEON MASTER'S TABLE",
    glyph: "\u2B1F",
    preview: ["#111313", "#9c9686", "#b74a35"],
  },
  {
    id: "minimal-dark",
    name: "Minimal Dark",
    system: "dnd5e",
    description: "Quiet neutral surfaces with reduced texture and distraction.",
    brand: "VIVID REALMS",
    glyph: "\u25CF",
    preview: ["#0c0d10", "#e4e5e8", "#6e8ba4"],
  },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((theme) => [theme.id, theme])) as Record<
  ThemeId,
  ThemeDefinition
>;

export const themesForSystem = (system?: string) =>
  THEMES.filter((theme) => theme.system === (system === "dnd5e" ? "dnd5e" : "remnant"));

export const defaultThemeForSystem = (system?: string): ThemeId =>
  system === "dnd5e" ? "academy-after-dark" : "huntsman-network";

export const normalizeCampaignTheme = (theme: string | undefined, system?: string): ThemeId => {
  const candidate = theme as ThemeId;
  const match = THEME_BY_ID[candidate];
  return match && match.system === (system === "dnd5e" ? "dnd5e" : "remnant")
    ? candidate
    : defaultThemeForSystem(system);
};

const storageKey = (campaignId: number, userId?: number) =>
  `theme:v2:${campaignId}:${userId ?? "guest"}`;

export function useCampaignTheme(args: {
  campaignId: number;
  userId?: number;
  system?: string;
  campaignTheme?: string;
}) {
  const { campaignId, userId, system, campaignTheme } = args;
  const key = storageKey(campaignId, userId);
  const compatible = useMemo(() => themesForSystem(system), [system]);
  const campaignDefault = normalizeCampaignTheme(campaignTheme, system);
  const [override, setOverrideState] = useState<ThemeOverride>("campaign");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key) as ThemeOverride | null;
      if (saved !== null && (saved === "campaign" || compatible.some((theme) => theme.id === saved))) {
        setOverrideState(saved);
      } else {
        setOverrideState("campaign");
      }
    } catch {
      setOverrideState("campaign");
    }
  }, [key, compatible]);

  const setOverride = (next: ThemeOverride) => {
    const safe = next === "campaign" || compatible.some((theme) => theme.id === next) ? next : "campaign";
    setOverrideState(safe);
    try {
      localStorage.setItem(key, safe);
    } catch {
      // Private mode or a full storage quota should not prevent theming.
    }
  };

  const themeId =
    override !== "campaign" && compatible.some((theme) => theme.id === override) ? override : campaignDefault;

  return {
    themeId,
    theme: THEME_BY_ID[themeId],
    override,
    setOverride,
    campaignDefault,
    compatible,
  };
}

