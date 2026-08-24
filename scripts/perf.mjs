import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:4210/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const p0 of [
  { name: 'Fast 4G, mid-tier phone', down: 9_000_000, lat: 60, cpu: 4 },
  { name: 'Slow 4G, low-end phone', down: 1_600_000, lat: 150, cpu: 6 },
]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, downloadThroughput: p0.down / 8, uploadThroughput: 750000 / 8, latency: p0.lat });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: p0.cpu });
  await p.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  const t0 = Date.now();
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForSelector('article', { timeout: 40000 });
  const firstResult = Date.now() - t0;
  await p.waitForTimeout(2500);
  const m = await p.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0 }));
  console.log(`${p0.name} (${p0.cpu}x CPU)`);
  console.log(`  FCP ${m.fcp.toFixed(0)}ms · LCP ${m.lcp.toFixed(0)}ms · CLS ${m.cls.toFixed(4)} · first card ${firstResult}ms`);
  await ctx.close();
}
await b.close();
