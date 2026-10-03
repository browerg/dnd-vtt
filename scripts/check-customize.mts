import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COSMETICS, isCacheExclusive } from '../server/src/shopCatalog.ts';
import { DICE_RECIPES } from '../client/src/diceRecipes.ts';
import { encodeDiceCustomization } from '../client/src/diceCustomization.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const out=resolve(process.env.QA_OUTPUT ?? '../vtt-customize-qa'); await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
let user={id:999,display_name:'Ruby Rose',email:'preview@example.invalid',diceTheme:'first-flame',relicOwner:true,profileStyle:'astral'};
let presets=DICE_RECIPES.slice(0,2).map((r,i)=>({id:i+1,name:r.name,theme:encodeDiceCustomization(r.settings)}));
let equipped:Record<string,string>={nat20:'crit20-silver-requiem',nat1:'crit1-aura-break'};
let writes:any[]=[];let fail=false;
await page.addInitScript(()=>{sessionStorage.setItem('vivid-realms-entrance-v1','seen');localStorage.setItem('vivid:diceTrailStyle','shadow');(window as any).__previewEvents=[];window.addEventListener('tabletop:critical-roll',e=>(window as any).__previewEvents.push((e as CustomEvent).detail));});
await page.route('**/socket.io/**',r=>r.abort());
await page.route('**/api/**',r=>{
const path=new URL(r.request().url()).pathname, method=r.request().method();let body:any={};if(method!=='GET'){body=r.request().postDataJSON();writes.push({path,method,body});}
if(path==='/api/auth/me')return r.fulfill({json:{user}});
if(path==='/api/shop')return r.fulfill({json:{wallet:{balance:100,bypass:false,bypassReason:null},bundles:[],equippedEffects:{},items:COSMETICS.map(i=>({...i,owned:i.id!=='crit1-shadow-snare' && i.id!=='trail-shadow',cacheExclusive:isCacheExclusive(i)})),equipped,ownedDiceThemes:['first-flame','event-horizon','chronos-engine','prismatic-echo'],previewCharacter:{name:'Ruby',imageUrl:''}}});
if(path==='/api/auth/me/dice-presets'&&method==='GET')return r.fulfill({json:{presets}});
if(path==='/api/auth/me/dice'){if(fail)return r.fulfill({status:500,json:{error:'Synthetic equip failure'}});user={...user,diceTheme:body.theme};return r.fulfill({json:{ok:true}});}
if(path.includes('/dice-presets')){const id=Number(path.split('/').pop());if(method==='DELETE'){presets=presets.filter(p=>p.id!==id);return r.fulfill({json:{ok:true}});}const preset={id:method==='POST'?presets.length+10:id,...body};presets=method==='POST'?[...presets,preset]:presets.map(p=>p.id===id?preset:p);return r.fulfill({json:{preset}});}
if(path==='/api/shop/equip'){const item=COSMETICS.find(i=>i.id===body.cosmeticId)!;equipped={...equipped,[(item as any).slot]:item.id};return r.fulfill({json:{equipped}});}
if(path==='/api/shop/appearance/clear'){equipped={...equipped,[body.slot]:''};return r.fulfill({json:{ok:true}});}
if(path==='/api/auth/me/profile'){user={...user,profileStyle:body.profileStyle};return r.fulfill({json:{user}});}
return r.fulfill({json:{}});
});
await page.goto(process.env.QA_URL ?? 'http://127.0.0.1:5182/customize');
await page.getByRole('heading',{name:'Your dice',exact:true}).waitFor();
await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Emporium'}).click();
await page.getByRole('link',{name:/Customize/}).first().click();
await page.getByRole('heading',{name:'Your dice',exact:true}).waitFor();

await page.locator('.collection-tile-art img').first().waitFor({timeout:30000});
await page.waitForFunction(()=>document.querySelectorAll('.collection-tile-art img').length>=18,{},{timeout:60000});
if(await page.locator('.collection-die-stage').count()) await page.locator('.collection-die-stage[data-rendered=true]').waitFor(); await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"})); if(await page.locator(".collection-die-stage").count()) await page.locator(".collection-die-stage[data-rendered=true]").waitFor(); await page.screenshot({path:out+'/desktop.png',fullPage:true,timeout:60000});
assert.equal(await page.evaluate(()=>localStorage.getItem('vivid:diceTrailStyle')),'aura');
assert.equal(writes.length,0);
await page.locator('.collection-tile').filter({hasText:'Event Horizon'}).click();
assert.equal(writes.length,0,'selection must not equip');
await page.locator('.collection-inspector').getByRole('button',{name:'Equip dice',exact:true}).click();
await page.getByRole('status').filter({hasText:'Equipped Event Horizon'}).waitFor();
assert.equal(user.diceTheme,'event-horizon');
await page.getByRole('button',{name:'+ Create dice',exact:true}).click();
await page.getByText('Start with a quick look',{exact:true}).click();await page.getByRole('button',{name:'Emerald Relic',exact:true}).last().click();
await page.getByLabel('Design name',{exact:true}).fill('Emerald QA');
await page.waitForTimeout(800);
await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"})); if(await page.locator(".collection-die-stage").count()) await page.locator(".collection-die-stage[data-rendered=true]").waitFor(); await page.screenshot({path:out+'/workshop.png',fullPage:true,timeout:60000});
await page.getByRole('button',{name:'Save design',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved Emerald QA'}).waitFor();
assert.equal(presets.length,3);
await page.getByLabel('Design name',{exact:true}).fill('Renamed QA');
await page.getByRole('button',{name:'Update design',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved Renamed QA'}).waitFor();
assert.equal(presets.at(-1)!.name,'Renamed QA');
await page.getByRole('button',{name:'Back to collection',exact:true}).first().click();
const nav=page.getByRole('navigation',{name:'Cosmetic categories'});
await nav.getByRole('button',{name:/Nat 1 effects/}).click();
assert.equal(await page.getByRole('button',{name:/Shadow Snare/}).count(),0,'unowned cosmetics hidden');
await page.locator('.collection-tile').filter({hasText:'Aura Break'}).click();
const before=writes.length;await page.getByRole('button',{name:'Preview effect',exact:true}).click();
await page.locator('.effect-aura-break').waitFor();assert.equal(writes.length,before);assert.equal(await page.evaluate(()=>(window as any).__previewEvents.at(-1).preview),true);
await page.locator('.critical-roll-overlay').waitFor({state:'detached',timeout:7000});
await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"})); if(await page.locator(".collection-die-stage").count()) await page.locator(".collection-die-stage[data-rendered=true]").waitFor(); await page.screenshot({path:out+'/effects.png',fullPage:true,timeout:60000});
await nav.getByRole('button',{name:/Token borders/}).click();await page.getByRole('button',{name:'Equip',exact:true}).click();await page.getByRole('button',{name:'Remove border'}).click();
assert.equal(equipped.tokenBorder,'');
await nav.getByRole('button',{name:/Profile/}).click();await page.locator('.collection-tile').filter({hasText:'Ember rose'}).click();await page.getByRole('button',{name:'Equip',exact:true}).click();assert.equal(user.profileStyle,'ember');
await nav.getByRole('button',{name:/Table backdrop/}).click();await page.getByRole('button',{name:'Atlas Frost Starter',exact:true}).click();await page.getByRole('button',{name:'Use backdrop'}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('app-background')),'frost');
await nav.getByRole('button',{name:/Dice sets/}).click();await page.getByLabel('Search your collection').fill('no such dice');assert.equal(await page.locator('.collection-tile').count(),0);await page.getByRole('button',{name:'Clear filters'}).click();
await page.setViewportSize({width:390,height:844});await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"})); if(await page.locator(".collection-die-stage").count()) await page.locator(".collection-die-stage[data-rendered=true]").waitFor(); await page.screenshot({path:out+'/mobile.png',fullPage:true,timeout:60000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.locator('.collection-tile').filter({hasText:'Event Horizon'}).click();await page.waitForTimeout(300);await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"})); if(await page.locator(".collection-die-stage").count()) await page.locator(".collection-die-stage[data-rendered=true]").waitFor(); await page.screenshot({path:out+'/mobile-detail.png',fullPage:true,timeout:60000});
await page.getByRole('button',{name:'Back to collection',exact:true}).click();await page.getByRole('button',{name:'+ Create dice',exact:true}).click();await page.getByLabel('Design name',{exact:true}).fill('Mobile design');await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"})); if(await page.locator(".collection-die-stage").count()) await page.locator(".collection-die-stage[data-rendered=true]").waitFor(); await page.screenshot({path:out+'/mobile-workshop.png',fullPage:true,timeout:60000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"})); if(await page.locator(".collection-die-stage").count()) await page.locator(".collection-die-stage[data-rendered=true]").waitFor(); await page.screenshot({path:out+'/mobile-reduced.png',fullPage:true,timeout:60000});
await page.goBack();
assert.ok(page.url().endsWith('/emporium'));
await page.goForward();
await page.getByLabel('Design name',{exact:true}).waitFor();
assert.equal(await page.getByLabel('Design name',{exact:true}).inputValue(),'Mobile design','browser history restores unsaved draft');
page.once('dialog',dialog=>dialog.accept());
await page.getByRole('button',{name:'Back to collection',exact:true}).click();
assert.equal(await page.evaluate(()=>sessionStorage.getItem('vivid:workshop-draft:999')),null,'explicit discard clears draft');
await page.locator('.collection-tile').filter({hasText:'Event Horizon'}).click();
assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Event Horizon','mobile detail receives focus');
await page.getByRole('button',{name:'Back to collection',exact:true}).click();
await page.waitForFunction(()=>document.activeElement?.classList.contains('collection-tile'));
assert.ok((await page.evaluate(()=>document.activeElement?.textContent))?.includes('Event Horizon'),'Back restores card focus');
assert.deepEqual(errors,[]);console.log('PASS: owned collection, selection/equip separation, save/update, silent critical preview, appearance removal, profile palette, backdrop, search, mobile, draft recovery, mobile focus.');
} finally {await browser.close();}
