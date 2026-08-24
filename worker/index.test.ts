import { describe, it, expect } from 'vitest';
import worker, { type Env } from './index';
import { encodeGarage } from '../src/lib/urlState';
import { initialGarage, pinSlot } from '../src/state/garage';

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>Garage Challenge</title>
    <meta name="description" content="placeholder" />
    <script type="module" src="/assets/index-abc.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

/**
 * Stands in for the static asset binding. The etag and content-length describe
 * the untransformed document on purpose: forwarding either one is the bug this
 * suite exists to catch.
 */
function env(): Env {
  return {
    ASSETS: {
      async fetch(request: Request) {
        const path = new URL(request.url).pathname;
        if (path.endsWith('.css')) {
          return new Response('body{color:red}', {
            headers: { 'content-type': 'text/css; charset=utf-8', etag: '"css"' },
          });
        }
        // Single-page-application handling: every other path serves index.html.
        return new Response(HTML, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'content-length': String(HTML.length),
            etag: '"index"',
            'content-encoding': 'gzip',
          },
        });
      },
    },
  };
}

const get = (url: string) => worker.fetch(new Request(url), env());

function finishedGarage() {
  let g = initialGarage(50_000, 3);
  g = pinSlot(g, g.slots[0]!.id, 'mazda-mx5-nc', 18_000);
  g = pinSlot(g, g.slots[1]!.id, 'toyota-4runner-n280', 20_000);
  return g;
}

describe('worker', () => {
  it('rewrites the preview for a shared garage', async () => {
    const res = await get(`https://garage.test/?g=${encodeGarage(finishedGarage())}`);
    const body = await res.text();
    expect(body).toContain('<meta property="og:title" content="Beat my $50,000 garage" />');
    expect(body).toContain('Mazda MX-5 Miata');
  });

  it('serves the generic preview for a bare visit', async () => {
    const body = await (await get('https://garage.test/')).text();
    expect(body).toContain('<meta property="og:title" content="Garage Challenge" />');
  });

  it('still serves a working page when the state is unreadable', async () => {
    const res = await get('https://garage.test/?g=%%%broken');
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain('/assets/index-abc.js');
    expect((body.match(/property="og:title"/g) ?? []).length).toBe(1);
  });

  it('points the canonical url at the link that was shared', async () => {
    const param = encodeGarage(finishedGarage());
    const body = await (await get(`https://garage.test/?g=${param}`)).text();
    expect(body).toContain(`content="https://garage.test/?g=${param}"`);
    expect(body).toContain('content="https://garage.test/og-default.png"');
  });

  it('drops asset headers that describe the untransformed document', async () => {
    // A forwarded etag lets a cache answer one garage's link with another
    // garage's preview; a forwarded content-length or content-encoding
    // truncates or garbles the body outright.
    const res = await get(`https://garage.test/?g=${encodeGarage(finishedGarage())}`);
    expect(res.headers.get('etag')).toBeNull();
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('content-length')).toBeNull();
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
  });

  it('passes non-html straight through untouched', async () => {
    const res = await get('https://garage.test/assets/index-abc.css');
    expect(await res.text()).toBe('body{color:red}');
    expect(res.headers.get('etag')).toBe('"css"');
  });
});
