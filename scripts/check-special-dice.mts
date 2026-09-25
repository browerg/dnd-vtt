// Local browser smoke test with mocked accounts/catalogue. Never opens the player DB.
// PLAYWRIGHT_MODULE may point to a bundled Playwright index.mjs.
import { BUNDLES, COSMETICS } from "../server/src/shopCatalog.ts";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const out = resolve(process.env.QA_OUTPUT ?? "../vtt-dice-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.addInitScript(() => sessionStorage.setItem("vivid-realms-entrance-v1", "seen"));
const errors: string[] = [];
const writes: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", msg => { if (msg.type() === "error" && /shader|WebGL|dice animation|dice engine/i.test(msg.text())) errors.push(msg.text()); });
await page.route("**/socket.io/**", route => route.abort());
await page.route("**/api/**", route => {
  const path = new URL(route.request().url()).pathname;
  if (route.request().method() !== "GET") writes.push(path);
  const data = path === "/api/auth/me" ? { user: { id: 999, email: "preview@example.invalid", display_name: "Preview", diceTheme: "white" } }
    : path === "/api/shop" ? { wallet: { balance: 1234, bypass: false }, equipped: {}, equippedEffects: {}, bundles: BUNDLES, items: COSMETICS.map(item => ({ ...item, owned: false })) }
    : {};
  return route.fulfill({ json: data });
});
await page.goto(process.env.QA_URL ?? "http://127.0.0.1:5175/shop");
await page.getByRole("button", { name: /Mystery dice/ }).click();
await page.getByRole("heading", { name: "Mystery dice", exact: true }).waitFor();
await page.screenshot({ path: `${out}/catalogue-desktop.png` });
const storage = await page.evaluate(() => JSON.stringify(localStorage));
for (const name of ["Event Horizon", "Chronos Engine", "Prismatic Echo"]) {
  await page.getByRole("button", { name: `Preview ${name}`, exact: true }).click();
  assert.equal(await page.locator(".emporium-shell > header").evaluate(el => el.inert), true, "hidden navigation must be inert");
  assert.equal(await page.locator("main").evaluate(el => el.inert), true, "hidden shop controls must be inert");
  await page.waitForFunction(() => !!document.querySelector("#dice-overlay canvas"));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/${name.toLowerCase().replaceAll(" ", "-")}.png` });
  await page.getByRole("heading", { name: "Mystery dice", exact: true }).waitFor({ timeout: 20000 });
  assert.equal(await page.locator("main").evaluate(el => el.inert), false, "shop interaction must be restored");
  assert.equal(await page.locator(".special-dice-catalogue + p + .error").count(), 0);
}
assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), storage, "preview must not change preferences");
assert.deepEqual(writes, [], "preview must not spend or equip");
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${out}/catalogue-mobile.png`, fullPage: true });
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "mobile horizontal overflow");
await page.keyboard.press("Escape");
await page.emulateMedia({ reducedMotion: "reduce" });
await page.evaluate(async () => {
  const { previewDice } = await import("/src/dice3d.ts");
  await previewDice("prismatic-echo", "frost", true);
  await previewDice("white");
  await previewDice("first-flame");
});
assert.deepEqual(errors, [], "no runtime or shader errors");
await browser.close();
console.log(JSON.stringify({ result: "passed", previews: 3, mobile: true, reducedMotion: true, ordinaryAndRelicRegression: true, writes, errors, screenshots: out }));
