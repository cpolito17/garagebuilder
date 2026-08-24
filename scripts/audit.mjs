import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:4200/';
// The bare origin is the landing page now, so the builder checks address it
// explicitly. docs/SPEC.md section 7.
const APP = `${URL}#build`;
const fails = [], warns = [], passes = [];
const ok = (m) => passes.push(m);
const bad = (m) => fails.push(m);
const warn = (m) => warns.push(m);

function lum(rgb) {
  const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
  const p = await ctx.newPage();
  await p.goto(APP, { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);

  // --- contrast on real rendered text
  const samples = await p.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('span,div,p,button,label,option')) {
      if (!el.textContent?.trim() || el.children.length > 0) continue;
      const cs = getComputedStyle(el);
      // Composite every translucent layer down to an opaque colour. Treating a
      // 9% wash as if it were solid reports 1.00:1 on text that is actually fine.
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const m = (getComputedStyle(n).backgroundColor || '').match(/\d+(\.\d+)?/g);
        if (!m || m.length < 3) continue;
        const a = m[3] === undefined ? 1 : Number(m[3]);
        if (a === 0) continue;
        layers.push({ rgb: m.slice(0, 3).map(Number), a });
        if (a === 1) break;
      }
      let comp = [255, 255, 255];
      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i];
        comp = comp.map((c, k) => l.rgb[k] * l.a + c * (1 - l.a));
      }
      const bg = `rgb(${comp.map(Math.round).join(', ')})`;
      const key = `${cs.color}|${bg}|${cs.fontSize}`;
      if (seen.has(key)) continue; seen.add(key);
      out.push({ color: cs.color, bg, size: parseFloat(cs.fontSize), weight: cs.fontWeight, text: el.textContent.trim().slice(0, 28) });
    }
    return out;
  });
  for (const s of samples) {
    const r = ratio(parse(s.color), parse(s.bg));
    const large = s.size >= 18.66 || (s.size >= 14 && Number(s.weight) >= 700);
    const need = large ? 3 : 4.5;
    if (r < need) bad(`[${scheme}] contrast ${r.toFixed(2)}:1 (needs ${need}) on "${s.text}" ${s.size}px`);
  }
  ok(`[${scheme}] checked ${samples.length} distinct text/background pairs for WCAG AA`);

  // --- touch targets
  const small = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button,[role="slider"],input,select,a')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      // A small checkbox inside a tall label has the label's hit area.
      const lbl = el.closest('label');
      const eff = lbl ? lbl.getBoundingClientRect() : r;
      const h = Math.max(r.height, eff.height);
      if (h < 44 || Math.max(r.width, eff.width) < 24) out.push(`${el.tagName}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  if (small.length) bad(`[${scheme}] targets under 44px tall: ${small.join(', ')}`);
  else ok(`[${scheme}] every interactive target is at least 44px tall`);

  // --- duplicate ids
  const dupes = await p.evaluate(() => {
    const seen = {}, dup = [];
    for (const el of document.querySelectorAll('[id]')) { seen[el.id] = (seen[el.id] || 0) + 1; }
    for (const [k, v] of Object.entries(seen)) if (v > 1) dup.push(`${k} x${v}`);
    return dup;
  });
  if (dupes.length) bad(`[${scheme}] duplicate element ids: ${dupes.join(', ')}`);
  else ok(`[${scheme}] no duplicate element ids`);

  // --- dashes in visible copy
  const dashes = await p.evaluate(() => {
    const t = document.body.innerText;
    const hits = [];
    for (const ch of ['—', '–']) if (t.includes(ch)) hits.push(ch === '—' ? 'em-dash' : 'en-dash');
    return hits;
  });
  if (dashes.length) bad(`[${scheme}] banned dashes in visible copy: ${dashes.join(', ')}`);
  else ok(`[${scheme}] zero em-dashes and en-dashes in visible copy`);

  // --- backdrop-filter only on fixed/sticky
  const blurs = await p.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => { const c = getComputedStyle(el); return c.backdropFilter && c.backdropFilter !== 'none'; })
      .map((el) => `${el.tagName}.${el.className.toString().slice(0, 20)}:${getComputedStyle(el).position}`));
  const scrolling = blurs.filter((b) => !b.endsWith(':fixed') && !b.endsWith(':sticky'));
  if (scrolling.length) bad(`[${scheme}] backdrop-filter on non-fixed element: ${scrolling.join(', ')}`);
  else ok(`[${scheme}] backdrop-filter appears only on fixed or sticky chrome (${blurs.length} element(s))`);

  // --- slider semantics
  const sliders = await p.evaluate(() =>
    [...document.querySelectorAll('[role="slider"]')].map((el) => ({
      valuenow: el.getAttribute('aria-valuenow'), valuetext: el.getAttribute('aria-valuetext'),
      label: el.getAttribute('aria-label'), tabindex: el.getAttribute('tabindex'),
    })));
  const badSliders = sliders.filter((s) => !s.valuenow || !s.valuetext || !s.label);
  if (badSliders.length) bad(`[${scheme}] slider missing aria-valuenow/valuetext/label`);
  else ok(`[${scheme}] all ${sliders.length} allocation sliders expose valuenow, valuetext and label`);

  // --- one accent: collect saturated colours actually painted
  const hues = await p.evaluate(() => {
    const set = new Set();
    for (const el of document.querySelectorAll('*')) {
      const c = getComputedStyle(el);
      for (const v of [c.color, c.backgroundColor, c.borderTopColor, c.accentColor]) {
        const m = (v || '').match(/\d+(\.\d+)?/g);
        if (!m || m.length < 3) continue;
        const [r, g, b] = m.slice(0, 3).map(Number);
        if (m[3] !== undefined && Number(m[3]) === 0) continue;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (mx - mn > 45) set.add(`${r},${g},${b}`);
      }
    }
    return [...set];
  });
  ok(`[${scheme}] saturated colours painted: ${hues.join(' | ') || 'none'}`);

  await ctx.close();
}

// --- the surfaces added after Phase 1, which the default view does not cover
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const pg = await c.newPage();
  const surfaceFails = [];

  const checkTargets = async (label) => {
    const small = await pg.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button,[role="slider"],input,select,a')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const lbl = el.closest('label');
        const eff = lbl ? lbl.getBoundingClientRect() : r;
        if (Math.max(r.height, eff.height) < 44) {
          out.push(`${el.tagName}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return out;
    });
    if (small.length) surfaceFails.push(`${label}: targets under 44px: ${small.join(', ')}`);
    const dashes = await pg.evaluate(() => ['\u2014', '\u2013'].filter((d) => document.body.innerText.includes(d)));
    if (dashes.length) surfaceFails.push(`${label}: banned dashes in copy`);
  };

  await pg.goto(APP, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(300);

  await pg.locator('button:has-text("Filters")').first().click();
  await pg.waitForTimeout(300);
  await checkTargets('filters open');
  await pg.locator('button:has-text("Filters")').first().click();

  await pg.locator('button[aria-label^="Details for"]').first().click();
  await pg.waitForSelector('[role="dialog"]', { timeout: 6000 });
  await pg.waitForTimeout(600);
  await checkTargets('detail modal');
  const modalLabelled = await pg.locator('[role="dialog"][aria-modal="true"]').count();
  if (modalLabelled !== 1) surfaceFails.push('detail modal missing role/aria-modal');
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(400);

  for (let i = 0; i < 3; i++) {
    const star = pg.locator('button[aria-label^="Lock "]').first();
    if (await star.count() === 0) break;
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.waitForTimeout(120);
    await star.click();
    await pg.waitForTimeout(420);
  }
  await pg.waitForSelector('h2:has-text("Beat my")', { timeout: 8000 });
  await pg.waitForTimeout(600);
  await checkTargets('garage summary and share panel');

  await pg.goto(URL + '#credits', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(400);
  await checkTargets('credits page');
  const h1 = await pg.locator('h1').count();
  if (h1 !== 1) surfaceFails.push(`credits page has ${h1} h1 elements`);

  if (surfaceFails.length) surfaceFails.forEach(bad);
  else ok('filters, detail modal, share panel and credits page all pass targets and copy checks');
  await c.close();
}

// --- keyboard path
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
await p.goto(APP, { waitUntil: 'networkidle' });
const order = [];
for (let i = 0; i < 14; i++) {
  await p.keyboard.press('Tab');
  order.push(await p.evaluate(() => {
    const a = document.activeElement;
    if (!a) return 'none';
    const ring = getComputedStyle(a).outlineWidth;
    return `${a.tagName}${a.getAttribute('aria-label') ? `[${a.getAttribute('aria-label')}]` : a.id ? `#${a.id}` : ''}${ring === '0px' ? ' NO-FOCUS-RING' : ''}`;
  }));
}
const noRing = order.filter((o) => o.includes('NO-FOCUS-RING'));
if (noRing.length) bad(`focusable elements without a visible ring: ${noRing.join(', ')}`);
else ok('every element in the tab order paints a focus ring');

// slider is keyboard operable
await p.locator('[role="slider"]').first().focus();
const v0 = await p.locator('[role="slider"]').first().getAttribute('aria-valuenow');
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(150);
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(250);
const v1 = await p.locator('[role="slider"]').first().getAttribute('aria-valuenow');
if (Number(v1) > Number(v0)) ok(`allocation slider is keyboard operable (${v0} -> ${v1} with two arrow presses)`);
else bad(`allocation slider did not respond to arrow keys (${v0} -> ${v1})`);

await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
await p.waitForTimeout(250);
const v2 = await p.locator('[role="slider"]').first().getAttribute('aria-valuenow');
if (Number(v2) - Number(v1) > Number(v1) - Number(v0)) ok(`shift+arrow takes a larger step (${v1} -> ${v2})`);
else warn(`shift+arrow step not clearly larger (${v1} -> ${v2})`);

// --- landing page, governed by design-taste-frontend in full (DESIGN.md 1.2).
// The checkable half of that skill's pre-flight list, run mechanically because
// a checklist nobody executes is a checklist that silently rots.
for (const scheme of ['light', 'dark']) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
  const pg = await c.newPage();
  await pg.goto(URL, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(500);

  const L = await pg.evaluate(() => {
    const text = (el) => (el?.innerText || '').trim();
    const product = [...document.querySelectorAll('[data-product]')];
    const inProduct = (el) => product.some((p) => p.contains(el));

    // An eyebrow is an uppercase wide-tracked micro-label. Field labels inside
    // the embedded product widget are controls, not decoration.
    const eyebrows = [...document.querySelectorAll('span,p,div,h2,h3')].filter((el) => {
      if (!el.textContent?.trim() || el.children.length > 0 || inProduct(el)) return false;
      const cs = getComputedStyle(el);
      const track = parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize);
      return cs.textTransform === 'uppercase' && track >= 0.05;
    }).map(text);

    const accentButtons = [...document.querySelectorAll('button')].filter((b) => {
      const bg = getComputedStyle(b).backgroundColor.match(/\d+/g);
      if (!bg) return false;
      const [r, g, bl] = bg.slice(0, 3).map(Number);
      return Math.max(r, g, bl) - Math.min(r, g, bl) > 45;
    }).map(text);

    const header = document.querySelector('header');
    const h1 = document.querySelector('h1');

    // The hero's own CTA, not the nav's: the nav button is always in view and
    // proves nothing about whether the hero fits.
    const cta = [...document.querySelectorAll('main button')].find((b) => text(b).length > 0);
    const heroSub = h1?.parentElement?.querySelector('p');

    // Line count from the text's own line boxes. Dividing a fixed-height
    // button by its line-height counts padding as a second line.
    const lineCount = (el) => {
      if (!el) return 0;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node, lines = 0;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        lines += range.getClientRects().length;
      }
      return lines;
    };

    const radii = new Set();
    for (const el of document.querySelectorAll('*')) {
      const r = getComputedStyle(el).borderTopLeftRadius;
      if (r && r !== '0px' && !r.includes('%')) radii.add(r);
    }

    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const sectionBgs = [...document.querySelectorAll('section')]
      .map((el) => getComputedStyle(el).backgroundColor)
      .filter((v) => v && !v.endsWith(', 0)'));

    return {
      dashes: ['—', '–'].filter((d) => document.body.innerText.includes(d)),
      eyebrows,
      sections: document.querySelectorAll('main > section').length,
      accentButtons,
      headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
      // One line means every child shares a vertical centre, not a top edge:
      // a 24px wordmark and a 44px button never start at the same y.
      headerRows: header
        ? new Set([...header.querySelectorAll(':scope > div > *')].map((el) => {
            const r = el.getBoundingClientRect();
            return Math.round((r.top + r.bottom) / 20);
          })).size
        : 0,
      h1Lines: lineCount(h1),
      subWords: heroSub ? text(heroSub).split(/\s+/).length : 0,
      ctaBottom: cta ? Math.round(cta.getBoundingClientRect().bottom) : 0,
      ctaLines: lineCount(cta),
      marquees: document.querySelectorAll('.marquee-run').length / 2,
      scrollCue: /\bscroll\b/i.test(document.body.innerText),
      radii: [...radii],
      bodyBg,
      sectionBgs,
      ids: (() => {
        const seen = new Set(), dupes = [];
        for (const el of document.querySelectorAll('[id]')) {
          if (seen.has(el.id)) dupes.push(el.id);
          seen.add(el.id);
        }
        return dupes;
      })(),
      smallTargets: [...document.querySelectorAll('button,a,[role="slider"],input')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (r.width || r.height) && r.height < 44;
        })
        .map((el) => `${el.tagName} ${Math.round(el.getBoundingClientRect().height)}px`),
    };
  });

  const tag = `[landing ${scheme}]`;
  if (L.dashes.length) bad(`${tag} em or en dash in copy`);
  else ok(`${tag} zero em-dashes and en-dashes`);

  const eyebrowCap = Math.ceil(L.sections / 3);
  if (L.eyebrows.length > eyebrowCap) bad(`${tag} ${L.eyebrows.length} eyebrows over a cap of ${eyebrowCap}: ${L.eyebrows.join(', ')}`);
  else ok(`${tag} ${L.eyebrows.length} decorative eyebrows across ${L.sections} sections (cap ${eyebrowCap})`);

  const labels = new Set(L.accentButtons);
  if (labels.size > 1) bad(`${tag} more than one call to action: ${[...labels].join(' | ')}`);
  else ok(`${tag} one call to action, used ${L.accentButtons.length} times: "${[...labels][0] ?? 'none'}"`);

  if (L.headerHeight > 80 || L.headerRows > 1) bad(`${tag} nav is ${L.headerHeight}px over ${L.headerRows} row(s)`);
  else ok(`${tag} nav is ${L.headerHeight}px on one line`);

  if (L.h1Lines > 2) bad(`${tag} hero headline runs to ${L.h1Lines} lines`);
  else if (L.subWords > 20) bad(`${tag} hero subtext is ${L.subWords} words`);
  else if (L.ctaBottom > 1000) bad(`${tag} hero CTA is below the fold at ${L.ctaBottom}px`);
  else if (L.ctaLines > 1) bad(`${tag} CTA label wraps to ${L.ctaLines} lines`);
  else ok(`${tag} hero fits: ${L.h1Lines}-line headline, ${L.subWords}-word subtext, CTA ends at ${L.ctaBottom}px`);

  if (L.marquees > 1) bad(`${tag} ${L.marquees} marquees`);
  else ok(`${tag} ${L.marquees} marquee`);

  if (L.scrollCue) bad(`${tag} scroll cue in copy`);
  else ok(`${tag} no scroll cues`);

  // Tailwind v4 renders rounded-full as calc(infinity * 1px), which computes
  // to 2^25 px. Anything past a few hundred is a pill.
  const allowed = new Set(['4px', '10px', '12px', '14px', '16px', '18px', '20px', '24px']);
  const stray = L.radii.filter((r) => !allowed.has(r) && parseFloat(r) < 999);
  if (stray.length) bad(`${tag} radii outside the shape system: ${stray.join(', ')}`);
  else ok(`${tag} radii all inside the shape system`);

  const lumOf = (v) => lum(parse(v));
  const off = L.sectionBgs.filter((v) => Math.abs(lumOf(v) - lumOf(L.bodyBg)) > 0.25);
  if (off.length) bad(`${tag} section inverts the page theme: ${off.join(', ')}`);
  else ok(`${tag} every section stays in the page theme`);

  if (L.ids.length) bad(`${tag} duplicate ids: ${L.ids.join(', ')}`);
  else ok(`${tag} no duplicate element ids`);

  if (L.smallTargets.length) bad(`${tag} targets under 44px: ${L.smallTargets.join(', ')}`);
  else ok(`${tag} every interactive target is at least 44px tall`);

  // Contrast on the landing's own text, composited over its real backdrop.
  const pairs = await pg.evaluate(() => {
    const out = [], seen = new Set();
    const opaque = (el) => {
      let node = el;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        const m = (bg || '').match(/[\d.]+/g);
        if (m && (m.length < 4 || Number(m[3]) === 1)) return bg;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    for (const el of document.querySelectorAll('span,p,h1,h2,h3,button,a')) {
      if (!el.textContent?.trim() || el.children.length > 0) continue;
      const cs = getComputedStyle(el);
      const key = `${cs.color}|${opaque(el)}|${cs.fontSize}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ fg: cs.color, bg: opaque(el), size: parseFloat(cs.fontSize), weight: cs.fontWeight });
    }
    return out;
  });
  const fails2 = pairs.filter((s) => {
    const large = s.size >= 24 || (s.size >= 18.66 && Number(s.weight) >= 700);
    return ratio(parse(s.fg), parse(s.bg)) < (large ? 3 : 4.5);
  });
  if (fails2.length) bad(`${tag} contrast below AA: ${fails2.map((f) => `${f.fg} on ${f.bg} @${f.size}px`).join(', ')}`);
  else ok(`${tag} checked ${pairs.length} text/background pairs for WCAG AA`);

  await c.close();
}

console.log('\n=== PASS ===');   passes.forEach((m) => console.log('  ' + m));
if (warns.length) { console.log('\n=== WARN ==='); warns.forEach((m) => console.log('  ' + m)); }
console.log('\n=== FAIL ===');   fails.length ? fails.forEach((m) => console.log('  ' + m)) : console.log('  none');
await browser.close();
process.exit(fails.length ? 1 : 0);
