import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const profile of [
  { name: 'Fast 4G, mid-tier phone', down: 9_000_000, up: 1_500_000, lat: 60, cpu: 4 },
  { name: 'Slow 4G, low-end phone', down: 1_600_000, up: 750_000, lat: 150, cpu: 6 },
]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, downloadThroughput: profile.down / 8, uploadThroughput: profile.up / 8, latency: profile.lat,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });

  await p.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  });

  const t0 = Date.now();
  await p.goto('http://127.0.0.1:4190/', { waitUntil: 'load' });
  await p.waitForSelector('article', { timeout: 30000 });
  const firstResult = Date.now() - t0;
  await p.waitForTimeout(2500);

  const m = await p.evaluate(() => ({
    lcp: window.__lcp, cls: window.__cls,
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0,
    transferKb: performance.getEntriesByType('resource')
      .filter((r) => r.name.endsWith('.js') || r.name.endsWith('.css'))
      .reduce((a, r) => a + (r.encodedBodySize || 0), 0) / 1024,
  }));

  // Interaction latency: drag the allocation slider and time the response
  const slider = p.locator('[role="slider"]').first();
  const box = await slider.boundingBox();
  const i0 = Date.now();
  await p.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  await p.mouse.up();
  await p.waitForTimeout(50);
  const interaction = Date.now() - i0;

  console.log(`${profile.name}  (${profile.cpu}x CPU throttle)`);
  console.log(`  FCP ${m.fcp.toFixed(0)}ms · LCP ${m.lcp.toFixed(0)}ms · CLS ${m.cls.toFixed(4)}`);
  console.log(`  first result card visible at ${firstResult}ms · JS+CSS transferred ${m.transferKb.toFixed(0)} kB`);
  console.log(`  slider drag round trip ${interaction}ms`);
  await ctx.close();
}
await b.close();
