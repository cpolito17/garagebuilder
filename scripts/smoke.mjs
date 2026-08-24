import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:4195/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
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

console.log('ERRORS:', errs.length ? errs.slice(0, 3).join(' | ') : 'none');
await b.close();
