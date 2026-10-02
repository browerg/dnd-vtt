import type { DiceCustomization } from "./diceCustomization";

interface DiceRecipe {
  name: string;
  description: string;
  settings: DiceCustomization;
}

export const DICE_RECIPES: DiceRecipe[] = [
  {
    name: "Emerald Relic",
    description: "Stained glass + copper ink",
    settings: {
      baseColor: "#0d5b46",
      textColor: "#ef9b6c",
      edgeColor: "#063126",
      outlineColor: "#3a160e",
      numberStyle: "outlined",
      finish: "glossy",
      pattern: "stainedglass",
      patternStrength: 0.9,
      patternScale: 1.2,
    },
  },
  {
    name: "Astral Gold",
    description: "Deep violet starfield",
    settings: {
      baseColor: "#2b1748",
      textColor: "#f3cf72",
      edgeColor: "#12091f",
      outlineColor: "#5e3908",
      numberStyle: "outlined",
      finish: "glossy",
      pattern: "astral",
      patternStrength: 0.95,
      patternScale: 1.2,
    },
  },
  {
    name: "Frostglass",
    description: "Ice crystal + pale ink",
    settings: {
      baseColor: "#8fcfe2",
      textColor: "#f7fbff",
      edgeColor: "#3d829c",
      outlineColor: "#315a68",
      numberStyle: "outlined",
      finish: "glossy",
      pattern: "ice",
      patternStrength: 0.82,
      patternScale: 1.1,
    },
  },
  {
    name: "Blood Marble",
    description: "Dark red polished stone",
    settings: {
      baseColor: "#721a25",
      textColor: "#f2d6b5",
      edgeColor: "#2d090e",
      outlineColor: "#4a080b",
      numberStyle: "outlined",
      finish: "metallic",
      pattern: "marble",
      patternStrength: 0.9,
      patternScale: 0.9,
    },
  },
  {
    name: "Obsidian Gold",
    description: "Black speckle + gold ink",
    settings: {
      baseColor: "#171719",
      textColor: "#e9be61",
      edgeColor: "#050506",
      outlineColor: "#5c3c0a",
      numberStyle: "outlined",
      finish: "metallic",
      pattern: "speckles",
      patternStrength: 0.75,
      patternScale: 1.5,
    },
  },
  {
    name: "Dragon Scale",
    description: "Forest metal + scale texture",
    settings: {
      baseColor: "#1a4a31",
      textColor: "#e6c873",
      edgeColor: "#07190f",
      outlineColor: "#4b3209",
      numberStyle: "outlined",
      finish: "metallic",
      pattern: "dragon",
      patternStrength: 0.95,
      patternScale: 1.3,
    },
  },
];

