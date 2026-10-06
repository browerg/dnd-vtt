// Synthetic campaign fixture. No real account or campaign data is changed.
import { pathToFileURL } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
await mkdir('.impeccable/review', { recursive: true });
const characterSource = await readFile('server/src/characters.ts', 'utf8');
const defaultFunction = characterSource.slice(characterSource.indexOf('function remnantDefaultData()'), characterSource.indexOf('function defaultData()'));
const data = new Function(`${defaultFunction}; return remnantDefaultData();`)();
Object.assign(data, { teamName: 'RWBY', weaponName: 'Crescent Rose', aura: 42, hp: 12 });
const browser = await chromium.launch({ channel: 'msedge', headless: true, timeout: 20000 });
try {
  const page = await browser.newPage({ viewport: { width: 1586, height: 992 } });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const members = ['Ruby Rose', 'Weiss Schnee', 'Blake Belladonna', 'Yang Xiao Long'].map((display_name, i) => ({ id: i + 1, display_name, role: 'player' }));
  const characters = members.map(m => ({ id: m.id, name: m.display_name, ownerId: m.id, ownerName: m.display_name, hp: 12, maxHp: 14, aura: 42, auraMax: 45, isNpc: false, portraitUrl: '', summary: 'Team RWBY', data }));
  let layout = [
    { i: 'sheet', x: 0, y: 0, w: 4, h: 18, minW: 4, minH: 8 },
    { i: 'notes', x: 4, y: 0, w: 5, h: 9, minW: 3, minH: 5 },
    { i: 'dice', x: 4, y: 9, w: 5, h: 9, minW: 3, minH: 6 },
    { i: 'roster', x: 9, y: 0, w: 3, h: 8, minW: 3, minH: 4 },
    { i: 'rolls', x: 9, y: 8, w: 3, h: 10, minW: 3, minH: 5 },
  ];
  const rolls = members.slice(0, 3).map((m, i) => ({ id: i + 1, campaignId: 99, userId: m.id, userName: m.display_name, formula: '2d10', label: 'Perception', mode: 'normal', visibility: 'public', total: 18 - i, createdAt: new Date().toISOString(), detail: { kept: { groups: [{ count: 2, sides: 10, results: [8, 10 - i] }], modifier: 0, total: 18 - i } } }));
  let campaignTheme = 'huntsman-network', role = 'player', savedNotes;
  await page.addInitScript(() => sessionStorage.setItem('vivid-realms-entrance-v2', 'seen'));
  await page.route('**/socket.io/**', r => r.abort());
  await page.route('**/api/**', async r => {
    const path = new URL(r.request().url()).pathname, method = r.request().method();
    if (path.endsWith('/dashboard-layout') && method === 'PUT') { layout = r.request().postDataJSON().layout; return r.fulfill({ json: {} }); }
    if (path === '/api/campaigns/99' && method === 'PUT') { campaignTheme = r.request().postDataJSON().theme; return r.fulfill({ json: {} }); }
    if (path.endsWith('/notes') && method === 'PUT') { savedNotes = r.request().postDataJSON().body; return r.fulfill({ json: {} }); }
    const json = path === '/api/auth/me' ? { user: { id: 1, display_name: 'Ruby Rose', diceTheme: 'white' } }
      : path === '/api/campaigns/99' ? { campaign: { id: 99, name: 'Shadows of Remnant', system: 'remnant', theme: campaignTheme, description: '', session_number: 12, chapter: '' }, yourRole: role, members }
      : path.endsWith('/dashboard-layout') ? { layout }
      : path.endsWith('/characters/1') ? { character: characters[0], canEdit: true }
      : path.endsWith('/characters') ? { characters }
      : path.endsWith('/rolls') ? { rolls }
      : path.endsWith('/messages') ? { messages: [] }
      : path.endsWith('/notes') ? { body: savedNotes ?? 'Investigate the Emerald Forest\n\n• Follow the trail beyond the eastern ruins.\n\n• Identify the source of Grimm activity.\n\n• Report our findings to Professor Ozpin.' }
      : { items: [], recaps: [], handouts: [], events: [], entries: [], sessions: [], rewards: [], balance: 100 };
    return r.fulfill({ json });
  });
  // Schnee Atelier keeps Theme inside its gear menu; other themes show it in the top bar.
  const openTheme = async () => {
    if (await page.locator('.atelier-topbar').count()) await page.getByRole('button', { name: 'Campaign menu' }).click();
    await page.getByRole('button', { name: 'Theme', exact: true }).click();
  };
  const closeTheme = async () => {
    const close = page.getByRole('button', { name: 'Close theme picker' });
    if (await close.count()) await close.click();
  };
  const url = (process.env.QA_URL || 'http://127.0.0.1:5182') + '/campaigns/99';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.panel-sheet .sheet-view').waitFor();
  const original = structuredClone(layout);
  await openTheme();
  await page.getByRole('button', { name: /Schnee Atelier Ivory palace/ }).click();
  await closeTheme();
  await page.locator('[data-theme="schnee-atelier"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.atelier-dice img').waitFor({ timeout: 15000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.deepEqual(layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })), original.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })));
  await page.screenshot({ path: '.impeccable/review/schnee-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Edit layout|Edit panels/ }).click();
  const before = structuredClone(layout.find(p => p.i === 'notes'));
  const handle = await page.locator('.panel-notes .panel-head').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 15);
  await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 - 125, handle.y + 99, { steps: 10 }); await page.mouse.up();
  await page.waitForFunction(({ x, y }) => { const p = JSON.parse(localStorage.getItem('dash:v1:99:1')).find(p => p.i === 'notes'); return p.x !== x || p.y !== y; }, before);
  const beforeResize = await page.locator('.panel-notes').boundingBox();
  const resize = await page.locator('.panel-notes .react-resizable-handle-n').boundingBox();
  await page.mouse.move(resize.x + resize.width / 2, resize.y + 4); await page.mouse.down(); await page.mouse.move(resize.x + resize.width / 2, resize.y - 60, { steps: 10 }); await page.mouse.up();
  const afterResize = await page.locator('.panel-notes').boundingBox();
  assert.ok(afterResize.width > beforeResize.width || afterResize.height > beforeResize.height, 'panel resizes');
  await page.getByRole('button', { name: 'Remove Mission notes panel' }).click();
  assert.equal(await page.locator('.panel-notes').count(), 0);
  await page.getByRole('button', { name: /＋ Panel/ }).click();
  await page.locator('.add-panel-item').filter({ hasText: 'Notes' }).click();
  await page.locator('.panel-notes').waitFor();
  await page.getByRole('button', { name: /Done/ , exact: false }).first().click();
  const changed = JSON.stringify(layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })));
  await page.reload(); await page.locator('[data-theme="schnee-atelier"] .panel-notes').waitFor();
  assert.equal(JSON.stringify(layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))), changed);
  await openTheme();
  await page.getByRole('button', { name: /Huntsman Network Tactical academy/ }).click();
  await closeTheme();
  assert.equal(await page.locator('.atelier-masthead').count(), 0);
  assert.equal(await page.locator('.atelier-dice').count(), 0);
  assert.equal(JSON.stringify(layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))), changed);
  // Campaign default uses the same new identifier. Keep the review layout compact.
  role = 'dm'; layout = [...original, { i: 'vcoins', x: 0, y: 20, w: 4, h: 7 }];
  await page.reload();
  await page.getByRole('button', { name: 'Close guide', exact: true }).click();
  await openTheme();
  await page.locator('.campaign-default-section').getByRole('button', { name: /Schnee Atelier/ }).click();
  await page.waitForFunction(() => document.querySelector('.campaign-default-section .campaign-selected')?.textContent.includes('Schnee Atelier'));
  assert.equal(campaignTheme, 'schnee-atelier');
  await page.getByRole('button', { name: /Campaign default Schnee Atelier/ }).click();
  await closeTheme();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.impeccable/review/schnee-mobile.png' });
  await openTheme();
  const picker = await page.locator('.theme-picker-popover').boundingBox();
  assert.ok(picker.x >= 0 && picker.x + picker.width <= 390, 'theme picker fits mobile');
  await page.screenshot({ path: '.impeccable/review/schnee-mobile-picker.png' });
  assert.match(await page.locator('.theme-makeover-group').first().innerText(), /Schnee Atelier/, 'makeover group holds Schnee Atelier');
  await page.locator('.theme-makeover-group').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.impeccable/review/schnee-mobile-makeovers.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: theme selection/default, no layout reset, drag/resize, remove/add, reload, incumbent restoration and mobile picker. Synthetic API fixture.');
} finally { await browser.close(); }
