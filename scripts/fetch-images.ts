/**
 * Fetch vehicle photography from Wikimedia Commons.
 *
 * Run this where there is network access:
 *   npm run images              all vehicles missing photos
 *   npm run images -- --force   re-fetch everything
 *   npm run images -- --only mazda-mx5-nc
 *
 * Writes image files to public/vehicles/ and a manifest to
 * src/data/generated/images.json. The manifest is committed; the binaries are
 * not, because 250 vehicles of photography is a hundred megabytes of git that
 * is reproducible from the manifest at any time. A build without images falls
 * back to the typographic identity band, so this never blocks anything.
 *
 * Selection and licence filtering live in scripts/lib/commons.ts and are unit
 * tested. Only files under CC0, public domain, CC BY or CC BY-SA are accepted.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { CATALOG } from '../src/data/catalog';
import type { ImageManifest, VehicleImage } from '../src/data/images';
import {
  buildQuery, pickBest, altTextFor, fileNameFor,
  type CommonsPage, type VehicleKey,
} from './lib/commons';

const API = 'https://commons.wikimedia.org/w/api.php';
const OUT_DIR = 'public/vehicles';
const MANIFEST = 'src/data/generated/images.json';

/** Wikimedia asks for a descriptive agent with a contact. Edit before running. */
const USER_AGENT =
  'GarageChallenge/0.1 (https://github.com/cpolito17/garagebuilder; hobby project) node-fetch';

/** Card slot is about 400 CSS px, so 1x and 2x land here. */
const HERO_WIDTHS = [640, 1280];
const GALLERY_WIDTH = 1000;
const GALLERY_COUNT = 2;

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyIx = args.indexOf('--only');
const only = onlyIx >= 0 ? args[onlyIx + 1] : null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(params: Record<string, string>): Promise<{ query?: { pages?: Record<string, CommonsPage> } }> {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Commons API ${res.status} ${res.statusText}`);
  return res.json() as never;
}

async function download(url: string, dest: string): Promise<{ ok: boolean; bytes: number }> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return { ok: false, bytes: 0 };
  const buf = Buffer.from(await res.arrayBuffer());
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
    if (only) return v.id === only;
    return force || !manifest[v.id]?.length;
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

    let pages: CommonsPage[] = [];
    try {
      const json = await api({
        action: 'query',
        generator: 'search',
        gsrsearch: buildQuery(key),
        gsrnamespace: '6',
        gsrlimit: '40',
        prop: 'imageinfo',
        iiprop: 'url|size|extmetadata',
        iiurlwidth: String(HERO_WIDTHS[1]),
      });
      pages = Object.values(json.query?.pages ?? {});
    } catch (err) {
      console.log(`  ${v.id}: API error, skipped (${(err as Error).message})`);
      missed++;
      await sleep(1200);
      continue;
    }

    const picked = pickBest(pages, key, 1 + GALLERY_COUNT);
    if (picked.length === 0) {
      console.log(`  ${v.id}: no free, in-generation photo found among ${pages.length} results`);
      missed++;
      await sleep(400);
      continue;
    }

    const images: VehicleImage[] = [];
    for (let i = 0; i < picked.length; i++) {
      const c = picked[i]!;
      const info = c.page.imageinfo![0]!;
      if (!info.thumburl) continue;

      const isHero = i === 0;
      const width = isHero ? HERO_WIDTHS[0]! : GALLERY_WIDTH;
      const file = fileNameFor(key, i, c.page.title);
      const src = thumbAt(info.thumburl, HERO_WIDTHS[1]!, width);

      const r = await download(src, `${OUT_DIR}/${file}`);
      if (!r.ok) continue;

      const image: VehicleImage = {
        file,
        width,
        height: Math.round((info.height / info.width) * width),
        licence: c.licence,
        author: c.author,
        sourceUrl: info.descriptionurl,
        alt: altTextFor(key),
      };

      if (isHero) {
        const file2x = file.replace(/(\.\w+)$/, '@2x$1');
        const r2 = await download(thumbAt(info.thumburl, HERO_WIDTHS[1]!, HERO_WIDTHS[1]!), `${OUT_DIR}/${file2x}`);
        if (r2.ok) image.file2x = file2x;
      }

      images.push(image);
      await sleep(250);
    }

    if (images.length === 0) {
      console.log(`  ${v.id}: candidates found but downloads failed`);
      missed++;
      continue;
    }

    manifest[v.id] = images;
    found++;
    console.log(`  ${v.id}: ${images.length} image(s), hero by ${images[0]!.author || 'unknown'} (${images[0]!.licence})`);

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
