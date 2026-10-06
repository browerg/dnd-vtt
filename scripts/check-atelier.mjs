// Schnee Atelier capture + checks against a synthetic API (no real data).
// Run with Vite on QA_URL (default http://127.0.0.1:5182) and PLAYWRIGHT_MODULE
// pointing at a playwright install. Writes .impeccable/review/atelier-*.png.
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
await mkdir('.impeccable/review', { recursive: true });
const base = process.env.QA_URL || 'http://127.0.0.1:5182';
const only = process.argv[2];

const browser = await chromium.launch({ channel: 'msedge', headless: true, timeout: 20000 });
try {
  const page = await browser.newPage({ viewport: { width: 1586, height: 992 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => sessionStorage.setItem('vivid-realms-entrance-v2', 'seen'));
  await page.route('**/socket.io/**', (r) => r.abort());

  const members = ['Ruby Rose', 'Weiss Schnee', 'Blake Belladonna', 'Yang Xiao Long'].map((display_name, i) => ({ id: i + 1, display_name, role: i ? 'player' : 'player' }));
  const pools = [[28, 32, 42, 50], [26, 30, 38, 50], [24, 28, 40, 50], [30, 34, 46, 50]];
  const characters = members.map((m, i) => ({ id: m.id, name: m.display_name, ownerId: m.id, ownerName: m.display_name, hp: pools[i][0], maxHp: pools[i][1], aura: pools[i][2], auraMax: pools[i][3], isNpc: false, portraitUrl: '', summary: 'Team RWBY' }));
  const sheet = {
    id: 1, campaignId: 99, ownerId: 1, ownerName: 'Ruby Rose', name: 'Ruby Rose', portraitUrl: '', updatedAt: '',
    data: { system: 'remnant', academy: 'Beacon', academyYear: '2', teamName: 'RWBY', archetype: 'Bladesman', rank: 'Initiate', mainAttribute: 'finesse',
      attributes: { brawn: 6, finesse: 10, resolve: 6, wit: 8, aura: 6, grit: 4 }, aura: 42, auraMax: 50, auraColor: '#d9364a', hp: 28, maxHp: 32,
      weaponName: 'Crescent Rose', weaponForms: [{ type: 'Scythe', range: 'Close', damage: 8 }, { type: 'Sniper Rifle', range: 'Long', damage: 8 }] },
  };
  const at = (min) => new Date(Date.UTC(2026, 9, 6, 5, min)).toISOString();
  const rolls = [
    { id: 1, campaignId: 99, userId: 1, userName: 'Ruby Rose', formula: '2d10', label: 'Athletics', mode: 'normal', visibility: 'public', total: 18, createdAt: at(24), detail: { mode: 'normal', critical: null, kept: { groups: [{ count: 2, sides: 10, results: [8, 10] }], modifier: 0, total: 18 } } },
    { id: 2, campaignId: 99, userId: 2, userName: 'Weiss Schnee', formula: '2d10', label: 'Investigation', mode: 'edge', visibility: 'public', total: 14, createdAt: at(27), detail: { mode: 'edge', critical: null, kept: { groups: [{ count: 2, sides: 10, results: [6, 8] }], modifier: 0, total: 14 } } },
    { id: 3, campaignId: 99, userId: 3, userName: 'Blake Belladonna', formula: '2d10', label: 'Perception', mode: 'normal', visibility: 'public', total: 20, createdAt: at(31), detail: { mode: 'normal', critical: 'nat20', kept: { groups: [{ count: 2, sides: 10, results: [10, 10] }], modifier: 0, total: 20 } } },
  ];
  let layout = [
    { i: 'sheet', x: 0, y: 0, w: 8, h: 18 }, { i: 'party', x: 8, y: 0, w: 4, h: 6 }, { i: 'dice', x: 8, y: 6, w: 4, h: 10 },
    { i: 'rolls', x: 8, y: 16, w: 4, h: 12 }, { i: 'notes', x: 0, y: 18, w: 8, h: 9 },
  ];
  let notes = 'Investigate the Emerald Forest\n📍 Mistral Region\nUnusual Grimm activity has been reported in the Emerald Forest. The Council wants eyes on the area and any signs of organized movement.\n• Locate the source of the Grimm activity\nTrack the increased Grimm presence and identify its origin.\n• Search for evidence of organized forces\nLook for signs of coordination, equipment, or human involvement.\n• Report back to the Council\nCompile your findings and return to Mistral with a full report.';
  const posted = [];
  await page.route('**/api/**', async (r) => {
    const path = new URL(r.request().url()).pathname, method = r.request().method();
    if (path.endsWith('/dashboard-layout') && method === 'PUT') { layout = r.request().postDataJSON().layout; return r.fulfill({ json: {} }); }
    if (path.endsWith('/notes') && method === 'PUT') { notes = r.request().postDataJSON().body; return r.fulfill({ json: {} }); }
    if (path.endsWith('/rolls') && method === 'POST') { posted.push(r.request().postDataJSON()); return r.fulfill({ json: {} }); }
    const json = path === '/api/auth/me' ? { user: { id: 1, display_name: 'Ruby Rose', diceTheme: 'white' } }
      : path === '/api/campaigns/99' ? { campaign: { id: 99, name: 'Shadows of Remnant', system: 'remnant', theme: 'schnee-atelier', description: '', session_number: 12, chapter: '' }, yourRole: 'player', members }
      : path.endsWith('/dashboard-layout') ? { layout }
      : path.endsWith('/characters/1') ? { character: sheet, canEdit: true }
      : path.endsWith('/characters') ? { characters }
      : path.endsWith('/rolls') ? { rolls }
      : path.endsWith('/messages') ? { messages: [] }
      : path.endsWith('/notes') ? { body: notes }
      : { items: [], recaps: [], handouts: [], events: [], entries: [], sessions: [], rewards: [], balance: 100 };
    return r.fulfill({ json });
  });

  const settle = async () => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
  };

  // 1. The Example page, at the comp's exact size, for side-by-side review.
  if (!only || only === 'example') {
    await page.goto(`${base}/themes/schnee-atelier/example`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('.atelier-character').waitFor();
    await settle();
    await page.screenshot({ path: '.impeccable/review/atelier-example.png' });
  }

  // 2. The live dashboard with synthetic data.
  if (!only || only === 'live') {
    await page.goto(`${base}/campaigns/99`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('.atelier-topbar').waitFor();
    await page.locator('.atelier-character').waitFor();
    await settle();
    await page.screenshot({ path: '.impeccable/review/atelier-live-own-layout.png' });
    // Dragging a panel to the bottom edge scrolls the page and the panel follows.
    await page.setViewportSize({ width: 1586, height: 700 });
    await page.getByRole('button', { name: 'Edit panels' }).click();
    const startY = layout.find((p) => p.i === 'dice').y;
    const grip = await page.locator('.panel-dice .panel-head').boundingBox();
    await page.mouse.move(grip.x + 40, grip.y + 20);
    await page.mouse.down();
    await page.mouse.move(grip.x + 60, 690, { steps: 12 });
    await page.waitForTimeout(1200);
    const scrolled = await page.evaluate(() => window.scrollY);
    await page.mouse.up();
    await page.waitForTimeout(200);
    assert.ok(scrolled > 100, `page auto-scrolls while dragging (scrollY ${scrolled})`);
    assert.ok(layout.find((p) => p.i === 'dice').y > startY + 5, 'dragged panel travels with the scroll');
    await page.setViewportSize({ width: 1586, height: 992 });
    await page.evaluate(() => window.scrollTo(0, 0));
    // Atelier layout puts the comp's panels on the page even if they were removed.
    await page.getByRole('button', { name: 'Remove Mission notes panel' }).click();
    await page.getByRole('button', { name: 'Remove Session log panel' }).click();
    assert.equal(layout.some((p) => p.i === 'notes' || p.i === 'rolls'), false);
    await page.getByRole('button', { name: /Atelier layout/ }).click();
    const pick = (id) => { const { x, y, w, h } = layout.find((p) => p.i === id); return { x, y, w, h }; };
    assert.deepEqual(pick('sheet'), { x: 0, y: 0, w: 3, h: 17 });
    assert.deepEqual(pick('notes'), { x: 3, y: 0, w: 6, h: 10 });
    assert.deepEqual(pick('rolls'), { x: 9, y: 10, w: 3, h: 7 });
    assert.deepEqual(pick('dice'), { x: 3, y: 10, w: 6, h: 7 });
    await page.getByRole('button', { name: 'Done' }).click();
    await settle();
    await page.screenshot({ path: '.impeccable/review/atelier-live.png' });
    assert.match(await page.locator('.atelier-mission h2').innerText(), /Emerald Forest/);
    assert.equal(await page.locator('.atelier-steps li').count(), 3);
    // Press R rolls the selected die.
    await page.locator('body').click({ position: { x: 800, y: 70 } });
    await page.keyboard.press('r');
    await page.waitForTimeout(300);
    assert.equal(posted.at(-1)?.formula, '2d10');
    await page.getByRole('radio', { name: 'd20' }).click();
    await page.getByRole('button', { name: 'Roll', exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal(posted.at(-1)?.formula, '1d20');
    // Notes edit round trip.
    await page.getByRole('button', { name: 'Mission notes options' }).click();
    await page.getByRole('menuitem', { name: 'Edit notes' }).click();
    await page.locator('.atelier-notes-edit textarea').fill('Escort the Dust shipment\n• Meet at the docks');
    await page.getByRole('button', { name: 'Done', exact: true }).last().click();
    await page.waitForTimeout(900);
    assert.match(notes, /Dust shipment/);
    assert.match(await page.locator('.atelier-mission h2').innerText(), /Dust shipment/);
    // Gear menu holds the rest of the campaign links.
    await page.getByRole('button', { name: 'Campaign menu' }).click();
    await page.locator('.atelier-gear-menu').getByRole('link', { name: 'Handbook' }).waitFor();
    await page.screenshot({ path: '.impeccable/review/atelier-live-menu.png' });
    await page.keyboard.press('Escape');
    // Phone width.
    await page.setViewportSize({ width: 390, height: 844 });
    await settle();
    await page.screenshot({ path: '.impeccable/review/atelier-mobile.png' });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: atelier example + live dashboard checks.');
} finally {
  await browser.close();
}
