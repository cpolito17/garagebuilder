/**
 * Fetch vehicle photography from Wikimedia Commons, with a safe Openverse fallback.
 *
 * Run this where there is network access:
 *   npm run images                          all vehicles missing photos
 *   npm run images -- --force               re-fetch everything
 *   npm run images -- --only mazda-mx5-nc   one vehicle, or a comma-separated list
 *
 * Writes image files to public/vehicles/ and a manifest to
 * src/data/generated/images.json. The manifest is committed; the binaries are
 * not, because hundreds of vehicles of photography is too much binary data for
 * Git. The manifest preserves the chosen sources and credits, while this tool
 * can re-fetch candidates when needed. A build without images falls back to the
 * typographic identity band, so this never blocks anything.
 *
 * Selection and licence filtering live in scripts/lib/commons.ts and are unit
 * tested. Commons may supply CC0, public domain, CC BY or CC BY-SA. The
 * non-Wikimedia fallback is restricted to CC0/public domain so the untouched
 * site's attribution copy remains accurate.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { CATALOG } from '../src/data/catalog';
import type { ImageManifest, VehicleImage } from '../src/data/images';
import imageExclusions from './image-exclusions.json';
import {
  buildQueries, scoreCandidate, pickBest, altTextFor, fileNameFor,
  type CommonsPage, type VehicleKey,
} from './lib/commons';
import { openversePage, type OpenverseResponse } from './lib/openverse';
import {
  exclusionMatches, sourceIdentity, titleFromSourceUrl,
} from './lib/source-identity';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const OPENVERSE_API = 'https://api.openverse.org/v1/images/';
const OUT_DIR = 'public/vehicles';
const MANIFEST = 'src/data/generated/images.json';

/** Wikimedia asks for a descriptive agent with a contact. Edit before running. */
const USER_AGENT =
  'GarageChallenge/0.1 (https://github.com/cpolito17/garagebuilder; hobby project) node-fetch';

/**
 * Card slots are about 400 CSS px. Wikimedia now accepts direct thumbnail
 * downloads only at its standard width steps, so use the nearest useful 1x,
 * 2x and gallery sizes instead of constructing arbitrary-width URLs.
 */
const HERO_WIDTHS = [500, 960];
const GALLERY_WIDTH = 960;
const GALLERY_COUNT = 2;

const args = process.argv.slice(2);
const force = args.includes('--force');
const replaceRejected = args.includes('--replace-rejected');
const onlyIx = args.indexOf('--only');
// A list rather than one id, so scripts/reject-images.ts can replace a whole
// review pass in a single run instead of one process per vehicle.
const only = onlyIx >= 0
  ? new Set((args[onlyIx + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean))
  : null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function commonsApi(params: Record<string, string>): Promise<{ query?: { pages?: Record<string, CommonsPage> } }> {
  const url = `${COMMONS_API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Commons API ${res.status} ${res.statusText}`);
  return res.json() as never;
}

async function openverseApi(query: string): Promise<CommonsPage[]> {
  const url = `${OPENVERSE_API}?${new URLSearchParams({
    q: query,
    license: 'cc0,pdm',
    extension: 'jpg,png',
    page_size: '40',
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Openverse API ${res.status} ${res.statusText}`);
  const json = await res.json() as OpenverseResponse;
  return (json.results ?? []).map(openversePage).filter((page): page is CommonsPage => page !== null);
}

async function download(url: string, dest: string): Promise<{ ok: boolean; bytes: number }> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    console.warn(`    download failed: ${res.status} ${res.statusText} (${url})`);
    return { ok: false, bytes: 0 };
  }

  const type = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (type && type !== 'image/jpeg' && type !== 'image/png' && type !== 'application/octet-stream') {
    console.warn(`    download rejected: unexpected content type ${type} (${url})`);
    return { ok: false, bytes: 0 };
  }

  const maxBytes = 20 * 1024 * 1024;
  const announced = Number(res.headers.get('content-length') ?? 0);
  if (announced > maxBytes) {
    console.warn(`    download rejected: source is larger than 20 MB (${url})`);
    return { ok: false, bytes: 0 };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) {
    console.warn(`    download rejected: source is larger than 20 MB (${url})`);
    return { ok: false, bytes: 0 };
  }
  writeFileSync(dest, buf);
  return { ok: true, bytes: buf.length };
}

/** Commons thumb URLs carry their width in the path, so a second size is a
 *  string substitution rather than another API round trip. */
function thumbAt(thumburl: string, from: number, to: number): string {
  return thumburl.replace(`/${from}px-`, `/${to}px-`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync('src/data/generated', { recursive: true });

  const manifest: ImageManifest = existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as ImageManifest)
    : {};

  const targets = CATALOG.filter((v) => {
    if (only) return only.has(v.id);
    const installed = manifest[v.id] ?? [];
    const missingLocalFile = installed.some((image) =>
      !existsSync(`${OUT_DIR}/${image.file}`)
      || (image.file2x !== undefined && !existsSync(`${OUT_DIR}/${image.file2x}`)));
    return force || installed.length === 0 || missingLocalFile;
  });

  if (targets.length === 0) {
    console.log('Nothing to fetch. Use --force to re-fetch.');
    return;
  }
  console.log(`Fetching photography for ${targets.length} of ${CATALOG.length} vehicles.\n`);

  let found = 0;
  let missed = 0;

  for (const v of targets) {
    const key: VehicleKey = {
      id: v.id, make: v.make, model: v.model,
      generation: v.generation, years: v.years, bodyStyle: v.bodyStyle,
    };

    // Visual review can find problems that filenames cannot express. Existing
    // Commons-title exclusions and source-aware exclusions are both supported.
    const exclusions = (imageExclusions as Record<string, string[]>)[v.id] ?? [];
    const installed = manifest[v.id] ?? [];
    const isExcludedImage = (image: VehicleImage) =>
      exclusions.some((value) => exclusionMatches(
        value,
        titleFromSourceUrl(image.sourceUrl) ?? '',
        image.sourceUrl,
      ));
    const preserved = replaceRejected ? installed.filter((image) => !isExcludedImage(image)) : [];
    const previousIdentities = new Set(installed.map((image) => sourceIdentity(image.sourceUrl)));
    const needed = Math.max(0, 1 + GALLERY_COUNT - preserved.length);

    const eligiblePages = (pages: CommonsPage[]) =>
      pages.filter((page) => {
        const info = page.imageinfo?.[0];
        if (!info) return false;
        if (exclusions.some((value) => exclusionMatches(value, page.title, info.descriptionurl))) return false;
        return !replaceRejected || !previousIdentities.has(sourceIdentity(info.descriptionurl));
      });

    const pagesById = new Map<string, CommonsPage>();
    for (const query of buildQueries(key)) {
      if (needed === 0) break;
      try {
        const json = await commonsApi({
          action: 'query',
          generator: 'search',
          gsrsearch: query,
          gsrnamespace: '6',
          gsrlimit: '40',
          prop: 'imageinfo',
          iiprop: 'url|size|extmetadata',
          iiurlwidth: String(HERO_WIDTHS[1]),
        });
        for (const page of Object.values(json.query?.pages ?? {})) {
          page.provider = 'commons';
          pagesById.set(`commons:${page.pageid}`, page);
        }
        if (pickBest(eligiblePages([...pagesById.values()]), key, needed).length >= needed) break;
        await sleep(250);
      } catch (err) {
        console.log(`  ${v.id}: Commons query failed (${(err as Error).message})`);
        await sleep(1200);
      }
    }

    // Openverse broadens discovery beyond Commons. Only CC0/public-domain
    // non-Wikimedia results are admitted so the untouched site's credit copy
    // remains truthful.
    if (pickBest(eligiblePages([...pagesById.values()]), key, needed).length < needed) {
      for (const query of buildQueries(key)) {
        try {
          for (const page of await openverseApi(query)) {
            pagesById.set(String(page.pageid), page);
          }
          if (pickBest(eligiblePages([...pagesById.values()]), key, needed).length >= needed) break;
          await sleep(250);
        } catch (err) {
          console.log(`  ${v.id}: Openverse query failed (${(err as Error).message})`);
          await sleep(1200);
        }
      }
    }

    const pages = eligiblePages([...pagesById.values()]);

    const picked = pickBest(pages, key, needed);
    if (picked.length === 0 && needed > 0) {
      const reasons = new Map<string, number>();
      for (const page of pages) {
        const result = scoreCandidate(page, key);
        if ('rejected' in result) reasons.set(result.rejected, (reasons.get(result.rejected) ?? 0) + 1);
      }
      const summary = [...reasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([reason, count]) => `${reason}: ${count}`)
        .join('; ');
      console.log(`  ${v.id}: no new free, in-generation photo found among ${pages.length} results${summary ? ` (${summary})` : ''}`);
    }

    const occupiedSlots = new Set(preserved.map((image) => {
      const match = image.file.match(/-(\d+)\.(?:jpe?g|png)$/i);
      return match ? Number(match[1]) : -1;
    }));
    const freeSlots = Array.from({ length: 1 + GALLERY_COUNT }, (_, index) => index)
      .filter((index) => !occupiedSlots.has(index));
    const images: VehicleImage[] = [...preserved];

    for (let pickIndex = 0; pickIndex < picked.length; pickIndex++) {
      const c = picked[pickIndex]!;
      const info = c.page.imageinfo![0]!;
      const slot = freeSlots[pickIndex];
      if (slot === undefined) break;

      const isHero = slot === 0;
      const isOpenverse = c.page.provider === 'openverse';
      const width = isOpenverse ? info.width : (isHero ? HERO_WIDTHS[0]! : GALLERY_WIDTH);
      const height = isOpenverse ? info.height : Math.round((info.height / info.width) * width);
      const file = fileNameFor(key, slot, c.page.title);
      const src = isOpenverse
        ? info.url
        : info.thumburl
          ? thumbAt(info.thumburl, HERO_WIDTHS[1]!, width)
          : null;
      if (!src) continue;

      const r = await download(src, `${OUT_DIR}/${file}`);
      if (!r.ok) continue;

      const image: VehicleImage = {
        file,
        width,
        height,
        licence: c.licence,
        author: c.author,
        sourceUrl: info.descriptionurl,
        alt: altTextFor(key),
      };

      if (isHero && !isOpenverse && info.thumburl) {
        const file2x = file.replace(/(\.\w+)$/, '@2x$1');
        const r2 = await download(
          thumbAt(info.thumburl, HERO_WIDTHS[1]!, HERO_WIDTHS[1]!),
          `${OUT_DIR}/${file2x}`,
        );
        if (r2.ok) image.file2x = file2x;
      }

      images.push(image);
      await sleep(250);
    }

    images.sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }));
    const keptFiles = new Set(images.flatMap((image) =>
      image.file2x ? [image.file, image.file2x] : [image.file]));
    for (const previous of installed) {
      for (const file of previous.file2x ? [previous.file, previous.file2x] : [previous.file]) {
        const filePath = `${OUT_DIR}/${file}`;
        if (!keptFiles.has(file) && existsSync(filePath)) unlinkSync(filePath);
      }
    }

    if (images.length === 0) {
      delete manifest[v.id];
      missed++;
      console.log(`  ${v.id}: no usable images; using the identity-band fallback`);
    } else {
      manifest[v.id] = images;
      const added = images.filter((image) => !previousIdentities.has(sourceIdentity(image.sourceUrl))).length;
      if (added > 0) found++;
      if (images.length < 1 + GALLERY_COUNT) missed++;
      console.log(`  ${v.id}: ${images.length} image(s), ${added} new, hero by ${images[0]!.author || 'unknown'} (${images[0]!.licence})`);
    }

    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0));
    await sleep(600);
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0));
  const total = Object.keys(manifest).length;
  console.log(`\n${found} fetched, ${missed} without a usable photo. Manifest covers ${total} of ${CATALOG.length} vehicles.`);
  if (missed > 0) {
    console.log('Vehicles without photos render the typographic identity band, which is a designed state, not a gap.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
