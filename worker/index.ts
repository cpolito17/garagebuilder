import { previewFor, injectMeta, DEFAULT_PREVIEW, canonicalFor } from './meta';
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

/**
 * Send www to the apex, permanently.
 *
 * Both hostnames are attached to this Worker as Custom Domains, so without
 * this every shared garage has two addresses that render identically. The
 * canonical link tag is built from the request origin further down, so a
 * garage shared from www would advertise itself as www and split its own
 * preview cache. One origin, decided here, before anything else runs.
 */
function apexRedirect(url: URL): Response | null {
  if (!url.hostname.startsWith('www.')) return null;
  const target = new URL(url);
  target.hostname = url.hostname.slice(4);
  return Response.redirect(target.toString(), 301);
}

function secureHtmlHeaders(asset: Response): Headers {
  const headers = new Headers(asset.headers);
  for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified']) headers.delete(name);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=0, s-maxage=3600');
  headers.set('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD', 'cache-control': 'no-store' },
      });
    }

    const redirect = apexRedirect(url);
    if (redirect) return redirect;

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

    const canonical = canonicalFor(url.toString(), stateParam, preview.specific);
    const image = `${url.origin}/og-default.png`;

    const html = injectMeta(await asset.text(), preview, canonical, image);

    // Headers are built fresh rather than copied from the asset. The asset's
    // etag, content-length and content-encoding all describe the untransformed
    // index.html: forwarding them would let a cache serve one garage's preview
    // for another garage's link, or truncate the body outright.
    return new Response(request.method === 'HEAD' ? null : html, {
      status: asset.status,
      headers: secureHtmlHeaders(asset),
    });
  },
};
