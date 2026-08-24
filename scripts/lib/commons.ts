import type { ImageLicence } from '../../src/data/images';

/**
 * Wikimedia Commons selection logic, kept pure so it can be tested without a
 * network. Choosing the wrong file is the failure mode that matters: an NA
 * Miata photograph on the NC record is worse than no photograph at all.
 */

export type CommonsPage = {
  pageid: number;
  title: string;
  imageinfo?: {
    url: string;
    descriptionurl: string;
    width: number;
    height: number;
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    extmetadata?: Record<string, { value: string }>;
  }[];
};

export type VehicleKey = {
  id: string;
  make: string;
  model: string;
  generation: string;
  years: [number, number];
  bodyStyle: string;
};

/**
 * Files that are photographs of a part, an event, or a wreck rather than of
 * the car. Matched against the file title.
 */
const REJECT_TITLE = [
  'interior', 'dashboard', 'dash ', 'cockpit', 'engine', 'motor', 'bay',
  'badge', 'emblem', 'logo', 'wheel', 'tyre', 'tire', 'brake', 'caliper',
  'headlight', 'taillight', 'tail light', 'head light', 'seat', 'gauge',
  'gearbox', 'transmission', 'chassis', 'suspension', 'exhaust', 'boot',
  'trunk', 'bonnet', 'hood ', 'crash', 'wreck', 'accident', 'burn', 'fire',
  'junk', 'scrap', 'rust', 'graveyard', 'diagram', 'blueprint', 'drawing',
  'poster', 'brochure', 'advert', 'model car', 'toy', 'diecast', 'miniature',
  'lego', 'assembly', 'factory', 'production line',
];

/** Angles worth having, in descending preference. */
const PREFER_TITLE = [
  'front', 'three-quarter', 'three quarter', '3q', 'frontal', 'side', 'profile',
];

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png'];

export function buildQuery(v: VehicleKey): string {
  // Generation codes help on some marques and hurt on others, so they are a
  // scoring signal rather than part of the query.
  return `${v.make} ${v.model}`.replace(/\s+/g, ' ').trim();
}

export function extractYear(title: string): number | null {
  const m = title.match(/\b(19[89]\d|20[0-4]\d)\b/);
  return m ? Number(m[1]) : null;
}

/** Strip the HTML Commons returns in the Artist field. */
export function normaliseArtist(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * Map Commons licence identifiers onto the set we can actually honour.
 * Anything not recognised as free is rejected: an unclear licence on an image
 * this app will redistribute is not a risk worth taking.
 */
export function classifyLicence(meta: Record<string, { value: string }> | undefined): ImageLicence | null {
  const raw = (meta?.License?.value ?? meta?.LicenseShortName?.value ?? '').toLowerCase();
  if (!raw) return null;

  if (raw.includes('cc0') || raw.includes('zero')) return 'cc0';
  if (raw.includes('cc-by-sa') || raw.includes('cc by-sa') || raw.includes('cc by sa')) return 'cc-by-sa';
  if (raw.includes('cc-by') || raw.includes('cc by')) return 'cc-by';
  if (raw.includes('public domain') || raw.startsWith('pd') || raw.includes('pd-')) return 'pd';

  // GFDL alone is free but share-alike in a way that is awkward to honour in a
  // rendered image, and non-free tags must never pass.
  return null;
}

export type Candidate = {
  page: CommonsPage;
  score: number;
  licence: ImageLicence;
  author: string;
  reason?: string;
};

export function scoreCandidate(page: CommonsPage, v: VehicleKey): Candidate | { rejected: string } {
  const info = page.imageinfo?.[0];
  if (!info) return { rejected: 'no imageinfo' };

  const title = page.title.replace(/^File:/, '').toLowerCase();

  if (!ALLOWED_EXT.some((e) => title.endsWith(e))) return { rejected: 'unsupported format' };
  for (const bad of REJECT_TITLE) if (title.includes(bad)) return { rejected: `title contains "${bad.trim()}"` };

  const licence = classifyLicence(info.extmetadata);
  if (!licence) return { rejected: 'licence not recognised as free' };

  if (info.width < 800) return { rejected: 'source too small' };
  const aspect = info.width / info.height;
  if (aspect < 1.15) return { rejected: 'not landscape enough' };

  // The make and the model must both appear, or it is a different car.
  const makeTokens = v.make.toLowerCase().split(/[\s-]+/).filter((t) => t.length > 2);
  const modelTokens = v.model.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 1);
  const hasMake = makeTokens.length === 0 || makeTokens.some((t) => title.includes(t));
  const hasModel = modelTokens.some((t) => title.includes(t));
  if (!hasMake) return { rejected: 'make not in title' };
  if (!hasModel) return { rejected: 'model not in title' };

  let score = 0;

  // Generation is the thing most likely to go wrong. A year inside the
  // generation is a strong signal; one outside it disqualifies the file.
  const year = extractYear(page.title);
  if (year !== null) {
    if (year < v.years[0] || year > v.years[1]) {
      return { rejected: `year ${year} outside ${v.years[0]}-${v.years[1]}` };
    }
    score += 30;
  }

  const gen = v.generation.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (gen.length >= 2 && title.replace(/[^a-z0-9]/g, '').includes(gen)) score += 18;

  PREFER_TITLE.forEach((word, i) => {
    if (title.includes(word)) score += 12 - i;
  });

  // Prefer a natural landscape crop and a large original.
  score += aspect >= 1.3 && aspect <= 1.85 ? 12 : 4;
  score += Math.min(12, Math.log2(info.width / 800) * 6);

  return { page, score, licence, author: normaliseArtist(info.extmetadata?.Artist?.value) };
}

/**
 * Pick up to `limit` files, at most one per author so a gallery is not four
 * photographs of the same car at the same meet.
 */
export function pickBest(pages: CommonsPage[], v: VehicleKey, limit: number): Candidate[] {
  const scored: Candidate[] = [];
  for (const p of pages) {
    const r = scoreCandidate(p, v);
    if ('rejected' in r) continue;
    scored.push(r);
  }
  scored.sort((a, b) => b.score - a.score);

  const out: Candidate[] = [];
  const authors = new Set<string>();
  for (const c of scored) {
    const key = c.author.toLowerCase();
    if (key && authors.has(key)) continue;
    authors.add(key);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

export function altTextFor(v: VehicleKey): string {
  return `${v.make} ${v.model}, ${v.generation} generation, ${v.years[0]} to ${v.years[1]}`;
}

export function fileNameFor(v: VehicleKey, index: number, sourceTitle: string): string {
  const ext = sourceTitle.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  return `${v.id}-${index}.${ext}`;
}
