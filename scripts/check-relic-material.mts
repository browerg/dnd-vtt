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
  page.on("console", msg => { if (msg.type() === "error" && /shader|dice animation|dice engine|WebGL/i.test(msg.text())) errors.push(msg.text()); });
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

  await page.evaluate(async () => {
    const source=await (await fetch('/src/dice3d.ts')).text();
    const url=source.match(/import DiceBox from "([^"]+)"/)[1];
    const {default:DiceBox}=await import(url);
    const {applyDiceCosmetic,FIRST_FLAME}=await import('/src/diceCosmetics.ts');
    const tray=document.createElement('div');tray.id='relic-material-qa';tray.style.cssText='position:fixed;inset:0;width:700px;height:600px;background:#09070d;z-index:99999';document.body.append(tray);
    const box=new DiceBox('#relic-material-qa',{assetPath:'/assets/dice/',sounds:false,shadows:false,baseScale:100,light_intensity:.9});
    await box.initialize();if(box.desk)box.desk.visible=false;
    await applyDiceCosmetic(box,FIRST_FLAME);
    const mesh=box.DiceFactory.create('d20');mesh.rotation.set(.35,.5,.1);mesh.scale.setScalar(2.2);box.scene.add(mesh);box.renderer.render(box.scene,box.camera);
  });
  await page.waitForTimeout(300);
  await page.screenshot({path:out+'/material-closeup.png'});
  assert.deepEqual(errors,[]);console.log('Relic material render passed');
} finally { await browser.close(); }
