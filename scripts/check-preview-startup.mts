// Browser verification with synthetic accounts; no player database is opened.
import { BUNDLES, COSMETICS } from "../server/src/shopCatalog.ts";
import { SPECIAL_TRAILS, isCacheTrail } from "../shared/specialTrails.ts";
import { CACHE_REWARDS, CACHE_COST, cacheRefunds } from "../server/src/vividCacheStore.ts";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const out = resolve(process.env.QA_OUTPUT ?? "../vtt-first-flame-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    sessionStorage.setItem("vivid-realms-entrance-v1", "seen");
    localStorage.setItem("vivid:diceTrailStyle", "ember");
  });
  const errors: string[] = [], writes: string[] = [];
  let owned = false;
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", msg => { if (msg.type() === "error" && /dice animation|dice engine|WebGL/i.test(msg.text())) errors.push(msg.text()); });
  await page.route("**/socket.io/**", route => route.abort());
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") writes.push(path);
    const data = path === "/api/auth/me" ? { user: { id: 999, email: "preview@example.invalid", display_name: "Trail Preview", diceTheme: "white" } }
      : path === "/api/shop/cache" ? { cost: CACHE_COST, balance: 0, refunds: cacheRefunds(CACHE_COST), pending: null, rewards: CACHE_REWARDS.map(item => ({ ...item, owned })) }
      : path === "/api/shop" ? { wallet: { balance: 0, bypass: false }, equipped: {}, equippedEffects: {}, bundles: BUNDLES,
        items: COSMETICS.map(item => ({ ...item, owned, cacheExclusive: item.rarity === "mythic" || isCacheTrail(item.id) })) }
      : {};
    return route.fulfill({ json: data });
  });

  let releaseAudio!: () => void;
  const audioGate = new Promise<void>(resolve => { releaseAudio = resolve; });
  let audioRequests = 0;
  let markRequested!: () => void;
  const requested = new Promise<void>(resolve => { markRequested = resolve; });
  await page.route("**/assets/dice/sounds/**", async route => { audioRequests++; markRequested(); await audioGate; await route.continue(); });
  await page.goto(process.env.QA_URL ?? "http://127.0.0.1:5176/shop", { waitUntil: "domcontentloaded" });
  const elapsed = await page.evaluate(async () => {
    const { preloadDice } = await import("/src/dice3d.ts");
    const start = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([preloadDice(), new Promise((_,reject) => { timer=setTimeout(()=>reject(new Error("Visual startup blocked on held audio")),5000); })]); }
    finally { clearTimeout(timer); }
    return performance.now()-start;
  });
  let requestTimer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([requested, new Promise((_,reject) => { requestTimer=setTimeout(()=>reject(new Error("No background audio request")),5000); })]); }
  finally { clearTimeout(requestTimer); }
  assert.ok(audioRequests > 0, "audio loads independently of visual readiness");
  releaseAudio();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({readyMs:Math.round(elapsed),visualReadyWhileAudioHeld:true,errors}));
} finally { await browser.close(); }
