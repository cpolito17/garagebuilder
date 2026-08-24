import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:4195/';
const APP = `${URL}#build`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(APP, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);

const check = (name, ok) => console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);

// card click opens details
await p.locator('button[aria-label^="Details for"]').first().click();
await p.waitForSelector('[role="dialog"]', { timeout: 5000 });
check('card opens detail modal', true);
await p.keyboard.press('Escape');
await p.waitForTimeout(400);

// caution disclosure still operable
const caution = p.locator('button[aria-expanded]').filter({ hasText: /known issue/ }).first();
if (await caution.count()) {
  await caution.click();
  await p.waitForTimeout(250);
  check('caution disclosure expands', (await caution.getAttribute('aria-expanded')) === 'true');
  const stillClosed = await p.locator('[role="dialog"]').count();
  check('caution click does not open the modal', stillClosed === 0);
  await caution.click();
}

// star pins and redistributes
const before = await p.locator('[role="slider"]').evaluateAll((e) => e.map((x) => +x.getAttribute('aria-valuenow')));
await p.evaluate(() => window.scrollTo(0, 0));
await p.locator('button[aria-label^="Lock "]').first().click();
await p.waitForTimeout(600);
const after = await p.locator('[role="slider"]').evaluateAll((e) => e.map((x) => +x.getAttribute('aria-valuenow')));
check('star pins and redistributes', before[0] !== after[0] && after.reduce((a, x) => a + x, 0) === 50000);
check('star click does not open the modal', (await p.locator('[role="dialog"]').count()) === 0);

// drag still works
const slider = p.locator('[role="slider"]').nth(1);
const box = await slider.boundingBox();
await p.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
await p.mouse.down();
await p.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(500);
const dragged = await p.locator('[role="slider"]').evaluateAll((e) => e.map((x) => +x.getAttribute('aria-valuenow')));
check('slider drag redistributes and books balance', dragged.reduce((a, x) => a + x, 0) === 50000);

// Finish the garage. A slot can legitimately run out of options after a drag,
// and the app offers the remedy, so take it the way a user would.
for (let round = 0; round < 8; round++) {
  const star = p.locator('button[aria-label^="Lock "]').first();
  if (await star.count() > 0) {
    await p.evaluate(() => window.scrollTo(0, 0));
    await star.click();
    await p.waitForTimeout(450);
    continue;
  }
  const raise = p.locator('button').filter({ hasText: /Raise the mileage limit/ }).first();
  if (await raise.count() > 0) {
    check('empty slot offers a concrete remedy', true);
    await raise.click();
    await p.waitForTimeout(450);
    continue;
  }
  break;
}
await p.waitForTimeout(2500);
const h2s = await p.locator('h2').allTextContents();
check('garage summary appears when complete', h2s.includes('Your garage'));
check('share panel appears when complete', h2s.some((t) => t.startsWith('Beat my')));
check('url carries the garage', p.url().includes('?g=1.'));

// credits page
await p.goto(URL + '#credits', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
check('credits page renders', (await p.locator('h1:has-text("Image credits")').count()) === 1);

// landing page and the two ways past it
{
  const lp = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  lp.on('pageerror', (e) => errs.push(e.message));
  lp.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await lp.goto(URL, { waitUntil: 'networkidle' });
  await lp.waitForTimeout(500);
  check('landing renders on a cold visit', (await lp.locator('h1:has-text("One budget")').count()) === 1);

  // The hero widget is the real allocation mechanic, not a picture of it.
  const before = await lp.locator('[role="slider"]').first().getAttribute('aria-valuenow');
  await lp.locator('[role="slider"]').first().focus();
  for (let i = 0; i < 3; i++) await lp.keyboard.press('ArrowRight');
  await lp.waitForTimeout(300);
  const after = await lp.locator('[role="slider"]').first().getAttribute('aria-valuenow');
  check('hero allocation is live', Number(after) > Number(before));

  await lp.locator('main button:has-text("Build your garage")').first().click();
  await lp.waitForSelector('article', { timeout: 8000 });
  check('cta opens the builder', lp.url().includes('#build'));

  // A shared link must never stop at the marketing page.
  await lp.goto(`${URL}?g=1.eyJ2IjoxLCJiIjo1MDAwMCwicyI6W3sidCI6MjUwMDAsInIiOjB9LHsidCI6MjUwMDAsInIiOjF9XX0`, { waitUntil: 'networkidle' });
  await lp.waitForSelector('article', { timeout: 8000 });
  check('a link with a garage skips the landing', (await lp.locator('h1:has-text("One budget")').count()) === 0);
  await lp.close();
}

console.log('ERRORS:', errs.length ? errs.slice(0, 3).join(' | ') : 'none');
await b.close();
