// App background ("add a background behind everything"). Per-user, stored
// client-side — no DB migration, instantly reversible. A single CSS custom
// property (--app-bg) drives the always-mounted .app-bg layer, so changing it
// anywhere updates the backdrop everywhere with no React state to thread.

export interface BgOption {
  key: string;
  name: string;
  /** value for the CSS `background` shorthand; "" = fall through to the theme */
  css: string;
}

// Curated moods that sit under the "academy after dark" palette. All are pure
// CSS gradients — self-contained, no external images, no network, no CSP worry.
export const BACKGROUNDS: BgOption[] = [
  { key: "", name: "None", css: "" },
  {
    key: "ember",
    name: "Ember Hall",
    css:
      "radial-gradient(120% 80% at 50% 120%, rgba(150,45,60,0.30), transparent 60%)," +
      "radial-gradient(90% 60% at 50% -15%, rgba(207,166,79,0.16), transparent 55%), #0c0a13",
  },
  {
    key: "forest",
    name: "Emerald Forest",
    css:
      "radial-gradient(120% 90% at 30% 110%, rgba(46,120,80,0.28), transparent 60%)," +
      "radial-gradient(90% 60% at 80% -10%, rgba(120,180,120,0.12), transparent 55%), #0a1310",
  },
  {
    key: "frost",
    name: "Atlas Frost",
    css:
      "radial-gradient(120% 90% at 50% 115%, rgba(42,111,176,0.30), transparent 60%)," +
      "radial-gradient(90% 60% at 50% -10%, rgba(191,230,255,0.14), transparent 55%), #0a0f1a",
  },
  {
    key: "void",
    name: "Grimm Void",
    css:
      "radial-gradient(120% 90% at 50% 120%, rgba(90,45,140,0.30), transparent 60%)," +
      "radial-gradient(80% 55% at 20% 0%, rgba(150,45,60,0.16), transparent 55%), #0a0810",
  },
  {
    key: "dusk",
    name: "Beacon Dusk",
    css:
      "linear-gradient(180deg, #1a1024 0%, #12101b 45%, #0c0a13 100%)," +
      "radial-gradient(90% 50% at 80% 0%, rgba(207,166,79,0.14), transparent 60%)",
  },
  {
    key: "aurora",
    name: "Aurora",
    css:
      "radial-gradient(80% 60% at 10% 100%, rgba(46,120,80,0.22), transparent 60%)," +
      "radial-gradient(80% 60% at 90% 100%, rgba(42,111,176,0.22), transparent 60%)," +
      "radial-gradient(70% 50% at 50% -10%, rgba(180,90,200,0.14), transparent 60%), #0b0912",
  },
];

const KEY = "app-background";

export function getBackground(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

// A stored value is either a preset key or "custom:<image-url>".
export const CUSTOM_PREFIX = "custom:";

export function applyBackground(value: string): void {
  let css = "transparent";
  if (value.startsWith(CUSTOM_PREFIX)) {
    const url = value.slice(CUSTOM_PREFIX.length);
    if (url) css = `center / cover no-repeat url("${url}")`;
  } else {
    const opt = BACKGROUNDS.find((b) => b.key === value);
    if (opt && opt.css) css = opt.css;
  }
  document.documentElement.style.setProperty("--app-bg", css);
}

export function setBackground(value: string): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* private mode — just apply for this session */
  }
  applyBackground(value);
}

export const customImageUrl = (value: string): string | null =>
  value.startsWith(CUSTOM_PREFIX) ? value.slice(CUSTOM_PREFIX.length) : null;
