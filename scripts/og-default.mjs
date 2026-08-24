/**
 * Render the static default link-preview image using the app's own share card
 * renderer, so the generic preview looks like the product rather than a
 * placeholder. Run once; the output is committed.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
await p.goto(process.env.URL || 'http://127.0.0.1:4211/', { waitUntil: 'networkidle' });
for (let i = 0; i < 3; i++) {
  const s = p.locator('button[aria-label^="Lock "]').first();
  if (await s.count() === 0) break;
  await p.evaluate(() => window.scrollTo(0, 0));
  await s.click();
  await p.waitForTimeout(450);
}
await p.waitForSelector('h2:has-text("Beat my")', { timeout: 25000 });
const [dl] = await Promise.all([
  p.waitForEvent('download'),
  p.locator('button:has-text("Link preview")').click(),
]);
await dl.saveAs('public/og-default.png');
console.log('wrote public/og-default.png');
await b.close();
