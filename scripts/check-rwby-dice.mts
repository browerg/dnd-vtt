// Synthetic shop account; previews must never touch the player database.
import { BUNDLES, COSMETICS } from '../server/src/shopCatalog.ts';
import { RWBY_DICE } from '../shared/rwbyDice.ts';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const out = '.impeccable/review/rwby-dice'; await mkdir(out,{recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const errors:string[]=[]; const writes:string[]=[];
 page.on('pageerror', e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|dice animation|dice engine/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{sessionStorage.setItem('vivid-realms-entrance-v2','seen'); sessionStorage.setItem('vivid-realms-entrance-v1','seen');});
 await page.route('**/socket.io/**',r=>r.abort());
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(r.request().method()!=='GET')writes.push(path);
  const json=path==='/api/auth/me'?{user:{id:999,email:'preview@example.invalid',display_name:'Preview',diceTheme:'white'}}
   :path==='/api/shop'?{wallet:{balance:100,bypass:false},equipped:{},equippedEffects:{},bundles:BUNDLES,items:COSMETICS.map(i=>({...i,owned:false}))}
   :{items:[],rewards:[],balance:100};return r.fulfill({json});
 });
 await page.goto((process.env.QA_URL||'http://127.0.0.1:5184')+'/shop',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/Mystery dice/}).click();
 await page.getByRole('heading',{name:'Mystery dice',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.special-die-revealed img').length===3);
 await page.waitForTimeout(350);
 await page.screenshot({path:`${out}/catalogue.png`});
 const storage=await page.evaluate(()=>JSON.stringify(localStorage));
 for(const dice of RWBY_DICE){
  await page.getByRole('button',{name:`Preview ${dice.name}`,exact:true}).click();
  await page.locator('.special-dice-stage').waitFor();
  await page.waitForFunction(()=>!!document.querySelector('#dice-overlay canvas'));
  await page.waitForTimeout(600);
  await page.screenshot({path:`${out}/${dice.theme}.png`});
  await page.getByRole('heading',{name:'Mystery dice',exact:true}).waitFor({timeout:25000});
 }
 assert.equal(await page.getByRole('button',{name:'Preview Event Horizon',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),storage);
 assert.deepEqual(writes,[],'previews neither buy nor equip');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:`${out}/mobile.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(async()=>{const {previewDice}=await import('/src/dice3d.ts'); await previewDice('winters-reliquary','frost',true); await previewDice('white');});
 assert.deepEqual(errors,[],'no shader or runtime errors');
 console.log('PASS: three real previews, hidden older Mythics, no writes/preference changes, mobile, reduced motion and ordinary die restoration.');
} finally {await browser.close();}
