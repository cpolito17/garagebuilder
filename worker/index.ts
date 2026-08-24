import { previewFor, injectMeta, DEFAULT_PREVIEW } from './meta';
import { STATE_PARAM } from '../src/lib/urlState';

/**
 * Cloudflare Worker sitting in front of the static site.
 *
 * It does one job: give every shared garage its own link preview. Everything
 * else passes straight through to the static assets.
 *
 * Deliberately does not render the preview image. Rendering per-garage PNGs at
 * the edge needs a WebAssembly SVG rasteriser and an embedded font, which
 * measured at 1,359 kB gzipped against a 1,024 kB free tier limit, to reproduce
 * an image the client already renders. The title and description carry the
 * specifics, which is where most of the value is and which every platform
 * renders as text. See docs/SPEC.md section 6.4.
 */

export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const asset = await env.ASSETS.fetch(request);

    const contentType = asset.headers.get('content-type') ?? '';
    if (!HTML_TYPES.some((t) => contentType.includes(t))) return asset;

    const stateParam = url.searchParams.get(STATE_PARAM);

    let preview = DEFAULT_PREVIEW;
    try {
      preview = previewFor(stateParam);
    } catch {
      // A malformed link must still serve a working page. The generic preview
      // is a worse preview, never a broken one.
    }

    const canonical = `${url.origin}${url.pathname}${url.search}`;
    const image = `${url.origin}/og-default.png`;

    const html = injectMeta(await asset.text(), preview, canonical, image);

    // Headers are built fresh rather than copied from the asset. The asset's
    // etag, content-length and content-encoding all describe the untransformed
    // index.html: forwarding them would let a cache serve one garage's preview
    // for another garage's link, or truncate the body outright.
    return new Response(html, {
      status: asset.status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Previews are deterministic for a given link and cheap to recompute.
        'cache-control': 'public, max-age=0, s-maxage=3600',
      },
    });
  },
};
