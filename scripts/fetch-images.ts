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
  buildQueries, pickBest, altTextFor, fileNameFor,
  type CommonsPage, type ImageRole, type VehicleKey,
} from './lib/commons';
import { openversePage, type OpenverseResponse } from './lib/openverse';
import { exclusionMatches, sourceIdentity } from './lib/source-identity';
import { replacementPlan } from './lib/replacement-plan';
import { decisionFor, emptyReviewProgress, type ReviewProgress } from './lib/review-state';

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
const EXTERIOR_COUNT = 3;
const TOTAL_COUNT = 4;

const args = process.argv.slice(2);
const force = args.includes('--force');
const replaceRejected = args.includes('--replace-rejected');
const useReviewProgress = args.includes('--review-progress');
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
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Openverse API ${res.status} ${res.statusText}`);
  const json = await res.json() as OpenverseResponse;
  return (json.results ?? []).map(openversePage).filter((page): page is CommonsPage => page !== null);
}

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    last = res;
    if (res.ok || (res.status !== 429 && res.status < 500)) return res;
    const retryAfter = Number(res.headers.get('retry-after') ?? 0);
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 600 * (attempt + 1));
  }
  throw new Error(`request failed after ${attempts} attempts: ${last?.status} ${last?.statusText}`);
}

async function download(url: string, dest: string): Promise<{ ok: boolean; bytes: number }> {
  let res: Response;
  try { res = await fetchWithRetry(url); }
  catch (error) {
    console.warn(`    download failed: ${(error as Error).message} (${url})`);
    return { ok: false, bytes: 0 };
  }
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
  const reviewProgress: ReviewProgress = useReviewProgress && existsSync('scripts/image-review-progress.json')
    ? JSON.parse(readFileSync('scripts/image-review-progress.json', 'utf8')) as ReviewProgress
    : emptyReviewProgress();

  const targets = CATALOG.filter((v) => {
    if (only) return only.has(v.id);
    const installed = manifest[v.id] ?? [];
    const missingLocalFile = installed.some((image) =>
      !existsSync(`${OUT_DIR}/${image.file}`)
      || (image.file2x !== undefined && !existsSync(`${OUT_DIR}/${image.file2x}`)));
    return force || installed.length < TOTAL_COUNT || missingLocalFile;
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
    const plan = replacementPlan(installed, exclusions, TOTAL_COUNT);
    const allInstalledFilesExist = installed.every((image) =>
      existsSync(`${OUT_DIR}/${image.file}`)
      && (image.file2x === undefined || existsSync(`${OUT_DIR}/${image.file2x}`)));
    const preserveInstalled = replaceRejected || (!force && installed.length > 0 && allInstalledFilesExist);
    const preserved = preserveInstalled ? plan.preserved : [];
    const previousIdentities = plan.previousIdentities;
    const preservedEntries = preserved.map((image) => {
      const originalIndex = installed.indexOf(image);
      const decision = decisionFor(reviewProgress, v.id, image, originalIndex);
      return { image, role: decision === 'interior' ? 'interior' as const : 'exterior' as const, hero: decision === 'hero' };
    });
    const preservedExterior = preservedEntries.filter((entry) => entry.role === 'exterior');
    const preservedInterior = preservedEntries.filter((entry) => entry.role === 'interior');
    const neededExterior = Math.max(0, EXTERIOR_COUNT - preservedExterior.length);
    const neededInterior = Math.max(0, 1 - preservedInterior.length);
    const needed = neededExterior + neededInterior;

    const eligiblePages = (pages: CommonsPage[]) =>
      pages.filter((page) => {
        const info = page.imageinfo?.[0];
        if (!info) return false;
        if (exclusions.some((value) => exclusionMatches(value, page.title, info.descriptionurl))) return false;
        return !replaceRejected || !previousIdentities.has(sourceIdentity(info.descriptionurl));
      });

    const searchRole = async (role: ImageRole, count: number) => {
      const pagesById = new Map<string, CommonsPage>();
      if (count === 0) return [];
      for (const query of buildQueries(key, role)) {
        try {
          const json = await commonsApi({ action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6', gsrlimit: '40', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: String(HERO_WIDTHS[1]) });
          for (const page of Object.values(json.query?.pages ?? {})) { page.provider = 'commons'; pagesById.set(`commons:${page.pageid}`, page); }
          if (pickBest(eligiblePages([...pagesById.values()]), key, count, role).length >= count) break;
          await sleep(250);
        } catch (err) { console.log(`  ${v.id}: Commons ${role} query failed (${(err as Error).message})`); await sleep(1200); }
      }
      if (pickBest(eligiblePages([...pagesById.values()]), key, count, role).length < count) {
        for (const query of buildQueries(key, role)) {
          try {
            for (const page of await openverseApi(query)) pagesById.set(String(page.pageid), page);
            if (pickBest(eligiblePages([...pagesById.values()]), key, count, role).length >= count) break;
            await sleep(250);
          } catch (err) { console.log(`  ${v.id}: Openverse ${role} query failed (${(err as Error).message})`); await sleep(1200); }
        }
      }
      return pickBest(eligiblePages([...pagesById.values()]), key, count, role);
    };

    const pickedExterior = await searchRole('exterior', neededExterior);
    const selectedIds = new Set(pickedExterior.map((candidate) => sourceIdentity(candidate.page.imageinfo![0]!.descriptionurl)));
    const pickedInterior = (await searchRole('interior', neededInterior))
      .filter((candidate) => !selectedIds.has(sourceIdentity(candidate.page.imageinfo![0]!.descriptionurl)))
      .slice(0, neededInterior);
    const picked = [
      ...pickedExterior.map((candidate) => ({ candidate, role: 'exterior' as const })),
      ...pickedInterior.map((candidate) => ({ candidate, role: 'interior' as const })),
    ];
    if (picked.length === 0 && needed > 0) {
      console.log(`  ${v.id}: no new free, in-generation photo found for ${neededExterior ? 'exterior' : 'interior'} slots`);
    }

    const freeSlots = replaceRejected
      ? plan.freeSlots
      : Array.from({ length: TOTAL_COUNT }, (_, index) => index);
    const newEntries: { image: VehicleImage; role: ImageRole; hero: boolean }[] = [];

    for (let pickIndex = 0; pickIndex < picked.length; pickIndex++) {
      const { candidate: c, role } = picked[pickIndex]!;
      const info = c.page.imageinfo![0]!;
      const slot = freeSlots[pickIndex];
      if (slot === undefined) break;

      const isHero = role === 'exterior' && !preservedEntries.some((entry) => entry.hero) && !newEntries.some((entry) => entry.hero);
      const isOpenverse = c.page.provider === 'openverse';
      const width = isOpenverse ? info.width : (isHero ? HERO_WIDTHS[0]! : GALLERY_WIDTH);
      const height = isOpenverse ? info.height : Math.round((info.height / info.width) * width);
      const file = fileNameFor(key, slot, c.page.title);
      const src = isOpenverse
        ? (info.thumburl ?? info.url)
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

      newEntries.push({ image, role, hero: isHero });
      await sleep(250);
    }

    const entries = [...preservedEntries, ...newEntries];
    const hero = entries.find((entry) => entry.role === 'exterior' && entry.hero)
      ?? entries.find((entry) => entry.role === 'exterior');
    const interior = entries.find((entry) => entry.role === 'interior');
    const images = [
      ...(hero ? [hero.image] : []),
      ...entries.filter((entry) => entry.role === 'exterior' && entry !== hero).map((entry) => entry.image),
      ...(interior ? [interior.image] : []),
    ].slice(0, TOTAL_COUNT);
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
      if (images.length < TOTAL_COUNT) missed++;
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
