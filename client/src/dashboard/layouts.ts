// Grid layout model + per-user, per-campaign persistence for the dashboard.
// Free drag/resize on a 12-column grid; each item's `i` is a panel id.

export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export const GRID_COLS = 12;

// Players land sheet-first: the character sheet dominates, tools flank it.
const PLAYER_LAYOUT: GridItem[] = [
  { i: "sheet", x: 0, y: 0, w: 8, h: 18, minW: 4, minH: 8 },
  { i: "party", x: 8, y: 0, w: 4, h: 6, minW: 2, minH: 4 },
  { i: "dice", x: 8, y: 6, w: 4, h: 10, minW: 3, minH: 6 },
  { i: "rolls", x: 8, y: 16, w: 4, h: 12, minW: 3, minH: 5 },
  { i: "notes", x: 0, y: 18, w: 8, h: 9, minW: 3, minH: 5 },
];

// The DM lands control-first: party/roster/rolls up top, codex + dice below.
const DM_LAYOUT: GridItem[] = [
  { i: "party", x: 0, y: 0, w: 3, h: 6, minW: 2, minH: 4 },
  { i: "roster", x: 3, y: 0, w: 5, h: 6, minW: 3, minH: 4 },
  { i: "rolls", x: 8, y: 0, w: 4, h: 12, minW: 3, minH: 5 },
  { i: "npcs", x: 0, y: 6, w: 8, h: 16, minW: 4, minH: 8 },
  { i: "dice", x: 8, y: 12, w: 4, h: 10, minW: 3, minH: 6 },
  { i: "codex", x: 0, y: 22, w: 8, h: 14, minW: 4, minH: 6 },
  { i: "hub", x: 8, y: 22, w: 4, h: 7, minW: 3, minH: 4 },
];

export function defaultLayout(role: string): GridItem[] {
  const isDM = role === "dm" || role === "co-dm";
  // clone so callers can mutate freely
  return (isDM ? DM_LAYOUT : PLAYER_LAYOUT).map((it) => ({ ...it }));
}

const key = (campaignId: number, userId: number) => `dash:v1:${campaignId}:${userId}`;

export function loadLayout(campaignId: number, userId: number): GridItem[] | null {
  try {
    const raw = localStorage.getItem(key(campaignId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLayout(campaignId: number, userId: number, layout: GridItem[]): void {
  try {
    localStorage.setItem(key(campaignId, userId), JSON.stringify(layout));
  } catch {
    /* private mode / quota — layout just won't persist */
  }
}

export function clearLayout(campaignId: number, userId: number): void {
  try {
    localStorage.removeItem(key(campaignId, userId));
  } catch {
    /* ignore */
  }
}
