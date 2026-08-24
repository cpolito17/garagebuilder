import { chromium } from 'playwright';

const OUT = '/tmp/claude-0/-home-user-garagebuilder/73adfb7a-063a-5e23-9226-f5c9be369bf4/scratchpad/shots';
const URL = process.env.URL || 'http://127.0.0.1:4179/';
const APP = `${URL}#build`;
const errors = [];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function page(opts) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return p;
}

// ---------- desktop, light
let p = await page({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
await p.goto(APP, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/01-desktop-light.png` });

// how many result cards rendered?
const cards = await p.locator('article').count();
console.log('result cards rendered:', cards);
const budget = await p.locator('#budget').inputValue();
console.log('budget field:', budget);

// ---------- drag the first allocation slider
const slider = p.locator('[role="slider"]').first();
const before = await slider.getAttribute('aria-valuenow');
const box = await slider.boundingBox();
await p.mouse.move(box.x + box.width * 0.32, box.y + box.height / 2);
await p.mouse.down();
for (let i = 32; i <= 62; i += 3) {
  await p.mouse.move(box.x + box.width * (i / 100), box.y + box.height / 2);
  await p.waitForTimeout(16);
}
await p.mouse.up();
await p.waitForTimeout(500);
const after = await slider.getAttribute('aria-valuenow');
console.log(`drag: slot 1 ${before} -> ${after}`);
const allSliders = await p.locator('[role="slider"]').evaluateAll((els) =>
  els.map((e) => Number(e.getAttribute('aria-valuenow'))));
console.log('all slots after drag:', allSliders, 'sum', allSliders.reduce((a, b) => a + b, 0));
await p.screenshot({ path: `${OUT}/02-after-drag.png` });

// ---------- star a car
const star = p.locator('button[aria-label^="Lock"]').first();
const starLabel = await star.getAttribute('aria-label');
await star.click();
await p.waitForTimeout(600);
const afterStar = await p.locator('[role="slider"]').evaluateAll((els) =>
  els.map((e) => Number(e.getAttribute('aria-valuenow'))));
console.log('starred:', starLabel);
console.log('all slots after star:', afterStar, 'sum', afterStar.reduce((a, b) => a + b, 0));
await p.screenshot({ path: `${OUT}/03-after-star.png` });

// ---------- keyboard path
await p.keyboard.press('Tab');
const focused = await p.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.id || document.activeElement?.tagName);
console.log('first tab focus:', focused);

// ---------- auto-allocate
await p.locator('button:has-text("Auto-allocate")').click();
await p.waitForTimeout(700);
const afterAuto = await p.locator('[role="slider"]').evaluateAll((els) =>
  els.map((e) => Number(e.getAttribute('aria-valuenow'))));
console.log('after auto-allocate:', afterAuto, 'sum', afterAuto.reduce((a, b) => a + b, 0));
await p.screenshot({ path: `${OUT}/04-auto-allocated.png`, fullPage: false });

// ---------- desktop dark
const pd = await page({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
await pd.goto(APP, { waitUntil: 'networkidle' });
await pd.waitForTimeout(400);
await pd.screenshot({ path: `${OUT}/05-desktop-dark.png` });

// ---------- mobile
const pm = await page({ viewport: { width: 390, height: 844 }, colorScheme: 'light', isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await pm.goto(APP, { waitUntil: 'networkidle' });
await pm.waitForTimeout(400);
await pm.screenshot({ path: `${OUT}/06-mobile-light.png` });
const railCount = await pm.locator('nav[aria-label="Slots"] button').count();
console.log('mobile slot rail chips:', railCount);
const horizontalOverflow = await pm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
console.log('mobile horizontal overflow:', horizontalOverflow);

// ---------- mobile dark, deeper scroll
const pmd = await page({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await pmd.goto(APP, { waitUntil: 'networkidle' });
await pmd.waitForTimeout(300);
await pmd.mouse.wheel(0, 500);
await pmd.waitForTimeout(300);
await pmd.screenshot({ path: `${OUT}/07-mobile-dark.png` });

// ---------- reduced motion
const pr = await page({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
await pr.goto(APP, { waitUntil: 'networkidle' });
await pr.waitForTimeout(300);
const rmCards = await pr.locator('article').count();
console.log('reduced-motion cards rendered:', rmCards);

console.log('\nERRORS:', errors.length ? errors.join('\n  ') : 'none');
await browser.close();
