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
  await page.goto(process.env.QA_URL ?? "http://127.0.0.1:5176/shop");
  await page.getByRole("button", { name: /^Dice trails/ }).click();
  await page.getByRole("heading", { name: "Dice trails", exact: true }).waitFor();
  await page.screenshot({ path: `${out}/catalogue-desktop.png` });
  for (const trail of [{ name: "First Flame Trail", effect: "first-flame" }]) {
    const card = page.locator(".emporium-item").filter({ has: page.getByRole("heading", { name: trail.name, exact: true }) });
    assert.equal(await card.getByRole("button", { name: "Equip", exact: true }).count(), 0);
    await card.getByRole("button", { name: "Preview", exact: true }).click();
    await page.waitForFunction(() => !!document.querySelector("#dice-trail-overlay"));
    await page.waitForTimeout(450);
    assert.equal(await page.locator("main").evaluate(el => el.inert), true);
    await page.screenshot({ path: `${out}/${trail.effect}.png` });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${trail.effect}-late.png` });
    try { await page.getByRole("heading", { name: "Dice trails", exact: true }).waitFor({ timeout: 20000 }); }
    catch (error) {
      await page.screenshot({ path: `${out}/failure.png` });
      console.log(JSON.stringify({ trail: trail.effect, errors, body: await page.locator("body").innerText() }));
      throw error;
    }
    assert.equal(await page.evaluate(() => localStorage.getItem("vivid:diceTrailStyle")), "ember", "preview preserves saved trail");
    assert.equal(await page.locator("main").evaluate(el => el.inert), false);
  }
  assert.deepEqual(writes, [], "preview cannot purchase or equip");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/catalogue-mobile.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(async () => {
    const { previewDice } = await import("/src/dice3d.ts");
    await previewDice("black", "first-flame", true);
    const canvas = document.querySelector<HTMLCanvasElement>("#dice-trail-overlay");
    if (canvas) {
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      if (pixels.some((value, i) => i % 4 === 3 && value !== 0)) throw new Error("reduced motion left visible trails");
    }
  });
  owned = true;
  await page.reload();
  await page.getByRole("button", { name: /^Dice trails/ }).click();
  const earned = page.locator(".emporium-item").filter({ has: page.getByRole("heading", { name: "First Flame Trail", exact: true }) });
  await earned.getByRole("button", { name: "Equip", exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem("vivid:diceTrailStyle")), "first-flame");
  assert.equal(await earned.getByRole("button", { name: "Equipped", exact: true }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "passed", trails: 1, desktop: true, mobile: true, reducedMotion: true, ownership: true, preferencesPreserved: true, errors, screenshots: out }));
} finally { await browser.close(); }
