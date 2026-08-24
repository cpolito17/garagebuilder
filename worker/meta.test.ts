import { describe, it, expect } from 'vitest';
import { previewFor, injectMeta, escapeAttr, DEFAULT_PREVIEW } from './meta';
import { encodeGarage } from '../src/lib/urlState';
import { initialGarage, pinSlot } from '../src/state/garage';

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Garage Challenge</title>
    <meta name="description" content="placeholder" />
  </head>
  <body><div id="root"></div></body>
</html>`;

function finishedGarage() {
  let g = initialGarage(50_000, 3);
  g = pinSlot(g, g.slots[0]!.id, 'mazda-mx5-nc', 18_000);
  g = pinSlot(g, g.slots[1]!.id, 'ford-crown-victoria-p71', 12_000);
  g = pinSlot(g, g.slots[2]!.id, 'toyota-4runner-n280', 20_000);
  return g;
}

describe('preview generation', () => {
  it('falls back to the generic preview with no state', () => {
    expect(previewFor(null)).toEqual(DEFAULT_PREVIEW);
    expect(previewFor('')).toEqual(DEFAULT_PREVIEW);
  });

  it('falls back rather than throwing on a malformed link', () => {
    for (const junk of ['nonsense', '1.@@@', '....', '9.notbase64']) {
      expect(() => previewFor(junk)).not.toThrow();
      expect(previewFor(junk).specific).toBe(false);
    }
  });

  it('leads with the budget, which is the constraint the challenge inherits', () => {
    const p = previewFor(encodeGarage(finishedGarage()));
    expect(p.title).toBe('Beat my $50,000 garage');
    expect(p.specific).toBe(true);
  });

  it('names the actual cars in the description', () => {
    const p = previewFor(encodeGarage(finishedGarage()));
    expect(p.description).toContain('Mazda MX-5 Miata');
    expect(p.description).toContain('Ford Crown Victoria');
    expect(p.description).toContain('Toyota 4Runner');
  });

  it('carries the stats that make the preview worth clicking', () => {
    const p = previewFor(encodeGarage(finishedGarage()));
    expect(p.description).toMatch(/\$50,000 spent/);
    expect(p.description).toMatch(/\d+ hp/);
    expect(p.description).toMatch(/\d+ pedals/);
    expect(p.description).toContain('Do better');
  });

  it('summarises rather than listing every car in a five slot garage', () => {
    let g = initialGarage(80_000, 5);
    const ids = ['mazda-mx5-nc', 'ford-crown-victoria-p71', 'toyota-4runner-n280', 'honda-fit-gk', 'subaru-forester-sj'];
    g.slots.forEach((slot, i) => { g = pinSlot(g, slot.id, ids[i]!, 12_000); });
    const p = previewFor(encodeGarage(g));
    expect(p.description).toContain('and 2 more');
  });

  it('treats a garage with no picks as saved work rather than a challenge', () => {
    const p = previewFor(encodeGarage(initialGarage(35_000, 2)));
    expect(p.specific).toBe(true);
    expect(p.title).toBe('A $35,000 garage, 2 cars');
    expect(p.title).not.toContain('Beat my');
  });

  it('ignores a pick that is no longer in the catalog instead of breaking', () => {
    let g = initialGarage(30_000, 2);
    g = pinSlot(g, g.slots[0]!.id, 'retired-vehicle-id', 15_000);
    g = pinSlot(g, g.slots[1]!.id, 'mazda-mx5-nc', 15_000);
    const p = previewFor(encodeGarage(g));
    expect(p.description).toContain('Mazda MX-5 Miata');
    expect(p.description).not.toContain('retired-vehicle-id');
  });
});

describe('meta injection', () => {
  const preview = { title: 'Beat my $50,000 garage', description: 'Three cars.', specific: true };

  it('emits exactly one of each social tag', () => {
    const out = injectMeta(HTML, preview, 'https://example.test/?g=abc', 'https://example.test/og.png');
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'twitter:image']) {
      expect(out.split(`"${tag}"`).length - 1, tag).toBe(1);
    }
    expect(out.split('name="description"').length - 1).toBe(1);
  });

  it('replaces the placeholder description rather than adding a second one', () => {
    const out = injectMeta(HTML, preview, 'https://example.test/', 'https://example.test/og.png');
    expect(out).not.toContain('placeholder');
    expect(out).toContain('Three cars.');
  });

  it('keeps the document otherwise intact', () => {
    const out = injectMeta(HTML, preview, 'https://example.test/', 'https://example.test/og.png');
    expect(out).toContain('<div id="root">');
    expect(out).toContain('<title>Garage Challenge</title>');
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('</head>');
  });

  it('escapes attribute-breaking characters from user controlled state', () => {
    const hostile = { title: 'x" onload="alert(1)', description: "a<script>b</script>'&", specific: true };
    const out = injectMeta(HTML, hostile, 'https://example.test/?g=">', 'https://example.test/og.png');
    expect(out).not.toContain('onload="alert(1)"');
    expect(out).not.toContain('<script>b');
    expect(out).toContain('&quot;');
    expect(out).toContain('&lt;script&gt;');
  });
});

describe('escaping', () => {
  it('neutralises every character that can break out of an attribute', () => {
    expect(escapeAttr('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});
