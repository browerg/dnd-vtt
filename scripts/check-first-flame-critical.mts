import { SPECIAL_CRITICALS, isCacheCritical } from "../shared/specialCriticals.ts";
// Browser verification with synthetic accounts; no player database is opened.
import { BUNDLES, COSMETICS } from "../server/src/shopCatalog.ts";
import { isCacheTrail } from "../shared/specialTrails.ts";
import { CACHE_REWARDS, CACHE_COST, cacheRefunds } from "../server/src/vividCacheStore.ts";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const out = resolve(process.env.QA_OUTPUT ?? "../vtt-flame-crit-qa");
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
        items: COSMETICS.map(item => ({ ...item, owned, cacheExclusive: item.rarity === "mythic" || (isCacheTrail(item.id) || isCacheCritical(item.id)) })) }
      : {};
    return route.fulfill({ json: data });
  });
  await page.goto(process.env.QA_URL ?? "http://127.0.0.1:5176/shop");

  await page.getByRole("button", { name: /^Nat 20 effects/ }).click();
  for (const effect of [{name:"First Flame",effect:"first-flame"}]) {
    if (!(await page.getByRole("heading", {name:"Nat 20 effects",exact:true}).isVisible())) await page.getByRole("button", { name: /^Nat 20 effects/ }).click();
    const card = page.locator(".emporium-item").filter({ has: page.getByRole("heading", { name: effect.name, exact: true }) });
    assert.equal(await card.getByRole("button", { name: "Equip", exact: true }).count(),0);
    await card.getByRole("button", { name: "Preview", exact: true }).click();
    await page.locator('.effect-'+effect.effect+'.critical-roll-overlay').waitFor();
    await page.locator('.critical-roll-overlay').evaluate(el => { for (const animation of el.getAnimations({subtree:true})) { animation.pause(); animation.currentTime=1600; } });
    await page.screenshot({ path: out+'/'+effect.effect+'.png' });
    await page.locator('.critical-roll-overlay').waitFor({state:'detached'});
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tabletop:critical-roll',{detail:{kind:'nat20',effect:'first-flame',preview:true,userName:'Preview'}})));
  await page.locator('.flame-awakening').waitFor();
  await page.locator('.critical-roll-overlay').evaluate(el => { for (const animation of el.getAnimations({subtree:true})) { animation.pause(); animation.currentTime=1600; } });
  await page.screenshot({path:out+'/mobile-awakening.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tabletop:critical-roll',{detail:{kind:'nat20',effect:'first-flame',preview:true,userName:'Preview'}})));
  await page.locator('.flame-awakening').waitFor({state:'attached'});
  assert.equal(await page.locator('.flame-awakening').evaluate(el=>getComputedStyle(el).display),'none');
  await page.screenshot({path:out+'/mobile-reduced.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tabletop:critical-roll',{detail:{kind:'nat1',effect:'first-flame',preview:true,userName:'Preview'}})));
  await page.locator('.critical-roll-overlay.nat1.effect-first-flame').waitFor();
  assert.equal(await page.locator('.flame-awakening').count(),0,'Nat 1 retains its original spectacle');
  assert.equal(await page.locator('.flame-faults').count(),1);
  assert.deepEqual(errors,[]); assert.deepEqual(writes,[]);
  console.log('Critical previews, ownership, mobile, reduced motion: passed');
} finally { await browser.close(); }
