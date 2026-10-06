import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
await mkdir('.impeccable/review', {recursive:true});
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true,timeout:15000});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('vivid-realms-entrance-v2','seen'));
 await page.route('**/socket.io/**',r=>r.abort());
 await page.route('**/socket__io-client.js*',r=>r.fulfill({contentType:'text/javascript',body:`export function io(){ const handlers={}; const listener=e=>{for(const fn of handlers[e.detail.type]||[])fn(e.detail.payload)};window.addEventListener('qa:socket',listener);return {on(type,fn){(handlers[type]||=[]).push(fn);return this},off(){return this},emit(){return this},disconnect(){window.removeEventListener('qa:socket',listener)}}}` }));

 const members=[{id:999,display_name:'Rowan',role:'player'},{id:2,display_name:'Game Master',role:'dm'}];
 const messages=[{id:1,campaignId:99,userId:2,userName:'Game Master',speaker:'Professor Ozpin',channel:'whisper',targetUserId:999,body:'Meet me at the tower. Bring your team.',createdAt:new Date().toISOString()}];
 let sent;
 await page.route('**/api/**',async r=>{
 const path=new URL(r.request().url()).pathname;
 if(r.request().method()==='POST'&&path.endsWith('/messages')){sent=r.request().postDataJSON();return r.fulfill({json:{}});}
 const json=path==='/api/auth/me'?{user:{id:999,display_name:'Rowan',diceTheme:'white'}}:path==='/api/campaigns/99'?{campaign:{id:99,name:'Beacon Academy',system:'remnant',theme:'rwby',description:'',session_number:1},yourRole:'player',members}:path.endsWith('/characters')?{characters:[{id:1,ownerId:999,name:'Rowan Ash',aura:82,auraMax:100,hp:10,maxHp:10,portraitUrl:'',teamName:'ASH'}]}:path.endsWith('/messages')?{messages}:path.endsWith('/rolls')?{rolls:[]}:path.endsWith('/dashboard-layout')?{layout:[]}: {items:[],recaps:[],handouts:[],events:[],entries:[],sessions:[],balance:100};
 return r.fulfill({json});
 });
 await page.goto((process.env.QA_URL || 'http://127.0.0.1:5182') + '/campaigns/99'); if(await page.getByRole('button',{name:'Skip Intro'}).isVisible()) await page.getByRole('button',{name:'Skip Intro'}).click();
 await page.getByRole('button',{name:'Open your Scroll',exact:true}).last().click();
 await page.getByRole('region',{name:'Scroll lock screen'}).waitFor();
 await page.locator('.pocket-scroll').screenshot({path:'.impeccable/review/scroll-lock.png'});
 await page.getByRole('button',{name:'Open Scroll',exact:true}).click();
 const apps=page.getByRole('navigation',{name:'Scroll apps'});
 await apps.getByRole('button',{name:'contacts',exact:true}).click();
 await page.getByRole('button',{name:/Professor Ozpin.*Reply privately/}).click();
 await page.locator('.signature-shell .chat-compose > input').fill('On our way. Is everything okay?');
 await page.locator('.pocket-scroll').screenshot({path:'.impeccable/review/scroll-messages.png'}); await page.screenshot({path:'.impeccable/review/scroll-desktop-viewport.png'});
 await page.reload();await page.locator('.signature-shell .chat-compose > input').waitFor();
 assert.equal(await page.locator('.signature-shell .chat-compose > input').inputValue(),'On our way. Is everything okay?');
 await page.locator('.signature-shell .chat-compose button.primary').click();
 assert.equal(sent.replyToId,1);assert.equal(sent.channel,'whisper');assert.equal(sent.targetUserId,2);
 await apps.getByRole('button',{name:'settings',exact:true}).click();
 await page.getByRole('button',{name:'ivory',exact:true}).click();await page.getByRole('button',{name:'jade',exact:true}).click();
 await page.getByRole('button',{name:'moon emblem',exact:true}).click();
 await page.reload();await page.locator('.signature-shell.finish-ivory').waitFor();
 assert.equal(await page.getByRole('button',{name:'jade',exact:true}).getAttribute('aria-pressed'),'true');
 await page.setViewportSize({width:390,height:844});await page.locator('.pocket-scroll').screenshot({path:'.impeccable/review/scroll-settings-mobile.png'});await page.screenshot({path:'.impeccable/review/scroll-mobile-viewport.png'});
 const rect=await page.locator('.pocket-scroll').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=390&&rect.y>=0&&rect.y+rect.height<=844);

 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('qa:socket',{detail:{type:'chat',payload:{id:99,campaignId:99,userId:2,userName:'Game Master',speaker:'Professor Ozpin',channel:'whisper',targetUserId:999,body:'A new private message while in Settings.'}}})));
 await page.getByRole('button',{name:'Put your Scroll away',exact:true}).first().click();
 await page.getByRole('button',{name:'Open your Scroll, 1 unread'}).waitFor();
 await page.getByRole('button',{name:'Open your Scroll, 1 unread'}).click();
 await apps.getByRole('button',{name:'messages',exact:true}).click();
 await page.getByText('A new private message while in Settings.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Put your Scroll away',exact:true}).first().click();
 await page.getByRole('button',{name:'Open your Scroll',exact:true}).last().click();
 await apps.getByRole('button',{name:'rolls',exact:true}).click();await page.getByText('No rolls yet.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Put your Scroll away',exact:true}).first().click();
 assert.deepEqual(errors,[]);console.log('PASS Scroll lock, contacts, private send, drafts, preferences, rolls and mobile bounds');
}finally{await browser.close();}


