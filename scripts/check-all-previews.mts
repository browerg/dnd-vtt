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
  const result = await page.evaluate(async () => {
    const source = await (await fetch('/src/dice3d.ts')).text();
    const url = source.match(/import DiceBox from "([^"]+)"/)[1];
    const {default: DiceBox} = await import(url);
    const results = []; let rehearsals=0; let audioRequests=0;
    const audioStart=performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/dice/sounds/')).length;
    for (const key of ['simulateThrow','updateConfig','roll']) {
      const original=DiceBox.prototype[key];
      DiceBox.prototype[key]=function(...args) {
        if(key==='simulateThrow') rehearsals++;
        const start=performance.now();const value=original.apply(this,args);
        results.push({key,sync:Math.round(performance.now()-start)});
        if(value?.then) value.then(()=>results.push({key,total:Math.round(performance.now()-start)}));
        return value;
      };
    }
    const {previewDice, getDiceTrailOptions, animateRoll}=await import('/src/dice3d.ts');
    const {DICE_COSMETICS}=await import('/src/diceCosmetics.ts');
    const {DEFAULT_DICE_CUSTOMIZATION,encodeDiceCustomization}=await import('/src/diceCustomization.ts');
    for(const trail of getDiceTrailOptions()) {
      await previewDice(trail.value==='first-flame'?'first-flame':'white',trail.value);
    }
    for(const theme of Object.keys(DICE_COSMETICS)) await previewDice(theme,undefined,true);
    await previewDice(encodeDiceCustomization(DEFAULT_DICE_CUSTOMIZATION));
    // A newer cosmetic preview replaces the active one instead of queuing.
    const first=previewDice('white','ember');
    await new Promise(resolve=>setTimeout(resolve,500));
    const second=previewDice('black','frost');
    await Promise.all([first,second]);
    if(rehearsals!==0) throw new Error('Preview rehearsed physics');
    const audioEnd=performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/dice/sounds/')).length;
    if(audioEnd!==audioStart) throw new Error('Previews loaded collision sounds');
    await animateRoll({kept:{groups:[{sides:20,count:1,results:[12]}]}},'white');
    if(rehearsals!==1) throw new Error('Gameplay no longer rehearses forced results');
    results.push({checkedTrails:getDiceTrailOptions().length,checkedDice:Object.keys(DICE_COSMETICS).length,rehearsals});
    return results;
  });
  console.log(JSON.stringify(result));
  assert.deepEqual(errors,[]);
  await page.evaluate(() => { window.dispatchEvent(new CustomEvent('tabletop:critical-roll',{detail:{kind:'nat20',effect:'golden',preview:true}})); });
  await page.locator('.critical-roll-overlay.effect-golden').waitFor();
  await page.evaluate(() => { window.dispatchEvent(new CustomEvent('tabletop:critical-roll',{detail:{kind:'nat1',effect:'mimic',preview:true}})); });
  await page.locator('.critical-roll-overlay.effect-mimic').waitFor({timeout:1000});
  console.log('Critical preview replacement passed');
} finally { await browser.close(); }
