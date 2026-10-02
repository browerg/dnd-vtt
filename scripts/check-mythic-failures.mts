// Synthetic shop accounts only. This never opens the player database.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MYTHIC_FAILURES } from "../shared/mythicCriticals.ts";
import { COSMETICS, BUNDLES, isCacheExclusive } from "../server/src/shopCatalog.ts";
import { CACHE_COST, CACHE_REWARDS, cacheRefunds } from "../server/src/vividCacheStore.ts";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const out = resolve(process.env.QA_OUTPUT ?? "../vtt-failure-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [], writes: { path: string; body: any }[] = [];
  const owned = new Set<string>();
  let equipped = ""; const balance = 0;
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem("vivid-realms-entrance-v1", "seen");
    (window as any).__criticalContexts = 0;
    const Context = window.AudioContext;
    window.AudioContext = new Proxy(Context, { construct(target, args) {
      // The Emporium also owns music/coin contexts. Count only effect scores.
      if (/criticalSounds|CriticalRollOverlay/.test(new Error().stack ?? "")) (window as any).__criticalContexts++;
      return Reflect.construct(target, args);
    } });
  });
  await page.route("**/socket.io/**", route => route.abort());
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      if (path === "/api/shop/purchase") throw new Error("Cache Mythics cannot be purchased");
      if (path === "/api/shop/equip") equipped = body.cosmeticId;
      return route.fulfill({ json: {} });
    }
    const data = path === "/api/auth/me" ? { user: { id: 999, email: "mythic@example.invalid", display_name: "Preview" } }
      : path === "/api/shop/cache" ? { cost: CACHE_COST, balance, refunds: cacheRefunds(CACHE_COST), pending: null, rewards: CACHE_REWARDS.map(item => ({ ...item, owned: false })) }
      : path === "/api/shop" ? { wallet: { balance, bypass: false }, equipped: { nat1: equipped }, equippedEffects: {}, bundles: BUNDLES,
        items: COSMETICS.map(item => ({ ...item, owned: owned.has(item.id), cacheExclusive: isCacheExclusive(item) })) }
      : {};
    return route.fulfill({ json: data });
  });
  await page.goto(process.env.QA_URL ?? "http://127.0.0.1:5182/shop");
  await page.getByRole("button", { name: /^Nat 1 effects/ }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const contexts = await page.evaluate(() => (window as any).__criticalContexts);
  async function trigger(effect: string, preview = true) {
    await page.evaluate(({ effect, preview }) => window.dispatchEvent(new CustomEvent("tabletop:critical-roll", {
      detail: { kind: "nat1", effect, preview, userName: "Ruby Rose" },
    })), { effect, preview });
    await page.locator(`.critical-roll-overlay.effect-${effect}`).waitFor();
  }
  async function frame(ms: number, name: string) {
    await page.locator(".critical-roll-overlay").evaluate((el, ms) => {
      for (const animation of el.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = ms; }
    }, ms);
    await page.screenshot({ path: resolve(out, name + ".png") });
  }
  for (const item of MYTHIC_FAILURES) {
    await page.getByRole("button", { name: /^Nat 1 effects/ }).click();
    const card = page.locator(".emporium-item").filter({ has: page.getByRole("heading", { name: item.name, exact: true }) });
    assert.match(await card.innerText(), /Mythic/);
    assert.match(await card.innerText(), /Vivid Cache exclusive/);
    assert.equal(await card.getByRole("button", { name: "Equip", exact: true }).count(), 0);
    assert.equal(await card.getByRole("button", { name: "Unlock", exact: true }).count(), 0);
    await card.getByRole("button", { name: "Preview", exact: true }).click();
    await page.locator(`.effect-${item.effect} .mythic-stage`).waitFor();
    assert.equal(await page.locator(".mythic-scene-title").evaluate(el => getComputedStyle(el).color), item.effect === "nevermore" ? "rgb(216, 201, 189)" : "rgb(208, 164, 238)");
    for (const time of [900, 2200, 3500]) await frame(time, `${item.effect}-${time}`);
    await page.locator(".critical-roll-overlay").waitFor({ state: "detached", timeout: 6500 });
  }
  assert.deepEqual(writes, [], "previews never purchase or change equipment");
  assert.equal(await page.evaluate(() => (window as any).__criticalContexts), contexts, "all shop previews are silent");

  await page.getByRole("button", { name: /^Nat 1 effects/ }).click();
  const first = page.locator(".emporium-item").filter({ has: page.getByRole("heading", { name: MYTHIC_FAILURES[0].name, exact: true }) });
  // Model the persisted entitlement returned after a Cache win. Store tests
  // below the UI verify the actual transactional grant and account isolation.
  owned.add(MYTHIC_FAILURES[0].id);
  await page.reload();
  await page.getByRole("button", { name: /^Nat 1 effects/ }).click();
  await first.getByRole("button", { name: "Equip", exact: true }).click();
  await first.getByRole("button", { name: "Equipped", exact: true }).waitFor();
  assert.deepEqual(writes.map(write => write.path), ["/api/shop/equip"]);
  assert.equal(writes[0].body.cosmeticId, MYTHIC_FAILURES[0].id);
  await page.getByRole("button", { name: "Close Nat 1 effects" }).click();

  // Replacement cancels the prior visual and starts a fresh scene.
  await trigger("aura-break");
  await trigger("nevermore");
  assert.equal(await page.locator(".aura-break-scene").count(), 0);
  assert.equal(await page.locator(".nevermore-scene").count(), 1);
  for (const item of MYTHIC_FAILURES) {
    await page.setViewportSize({ width: 390, height: 844 });
    await trigger(item.effect);
    await frame(3500, `${item.effect}-mobile`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await trigger(item.effect);
    assert.equal(await page.locator(".mythic-number").evaluate(el => getComputedStyle(el).opacity), "1");
    assert.equal(await page.locator(".critical-roll-overlay").evaluate(el => el.getAnimations({ subtree: true }).length), 0);
    await page.screenshot({ path: resolve(out, `${item.effect}-reduced.png`) });
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
  await page.evaluate(() => localStorage.setItem("critical-roll-sound", "off"));
  await trigger("shadow-snare", false);
  await page.locator(".critical-roll-overlay").waitFor({ state: "detached", timeout: 12000 });
  assert.equal(await page.evaluate(() => (window as any).__criticalContexts), contexts);
  await page.evaluate(() => localStorage.removeItem("critical-roll-sound"));
  for (const item of MYTHIC_FAILURES) {
    await trigger(item.effect, false);
    await page.locator(".critical-roll-overlay").waitFor({ state: "detached", timeout: 6500 });
  }
  assert.equal(await page.evaluate(() => (window as any).__criticalContexts), contexts + 3);
  assert.deepEqual(errors, []);
  console.log("Three Mythics: Cache exclusivity, previews, earned equip, replacement, sound/mute, cleanup, mobile and reduced motion passed.");
} finally { await browser.close(); }
