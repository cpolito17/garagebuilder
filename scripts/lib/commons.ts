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

const REAR_TITLE = ['rear', 'back'];

/** Performance variants that must be named by the catalog record to pass. */
const EXCLUSIVE_TRIMS = [
  'type r', 'type s', 'gti', 'wrx', 'sti', 'raptor', 'shelby', 'z06', 'zr1',
  'hellcat', 'trx', 'amg',
];

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png'];

const GENERIC_MODEL_TOKENS = new Set([
  'model', 'series', 'class', 'grand', 'touring', 'cross', 'country',
]);

export function buildQueries(v: VehicleKey): string[] {
  const base = `${v.make} ${v.model}`.replace(/\s+/g, ' ').trim();
  // Search the generation first. If Commons uses a different name for it, the
  // first model year is a useful second route; the broad query is only a final
  // fallback and still has to pass the strict generation check below.
  return [...new Set([
    `${base} ${v.generation} ${v.bodyStyle}`.replace(/\s+/g, ' ').trim(),
    `${base} ${v.years[0]}`,
    base,
  ])];
}

export function extractYear(title: string): number | null {
  const m = title.match(/\b(19[89]\d|20[0-4]\d)\b/);
  return m ? Number(m[1]) : null;
}

const GENERATION_STOP_WORDS = new Set([
  'and', 'or', 'gen', 'generation', 'series', 'federal', 'facelift', 'pre',
]);

const ORDINAL_SIGNAL: Record<string, string> = {
  first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th',
};

/** Tokens that can prove a title names this generation when no year is given. */
export function generationSignals(generation: string): string[] {
  const words = generation.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
  const signals = words.flatMap((word) => {
    if (!word || GENERATION_STOP_WORDS.has(word)) return [];
    const ordinal = ORDINAL_SIGNAL[word];
    return ordinal ? [word, ordinal] : word.length >= 2 ? [word] : [];
  });
  return [...new Set(signals)];
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
  const titleWords = ` ${title.replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const hasPhrase = (phrase: string) => titleWords.includes(` ${phrase.trim().replace(/\s+/g, ' ')} `);

  if (!ALLOWED_EXT.some((e) => title.endsWith(e))) return { rejected: 'unsupported format' };
  for (const bad of REJECT_TITLE) if (hasPhrase(bad)) return { rejected: `title contains "${bad.trim()}"` };

  const licence = classifyLicence(info.extmetadata);
  if (!licence) return { rejected: 'licence not recognised as free' };

  if (info.width < 800) return { rejected: 'source too small' };
  const aspect = info.width / info.height;
  if (aspect < 1.15) return { rejected: 'not landscape enough' };

  // The make and the model must both appear, or it is a different car.
  const exactTitleTokens = new Set(titleWords.trim().split(/\s+/));
  const makeTokens = v.make.toLowerCase().split(/[\s-]+/).filter((t) => t.length > 2);
  const modelPhrase = v.model.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const modelTokens = modelPhrase.split(/\s+/).filter(Boolean);
  const distinctiveModelTokens = modelTokens
    .filter((token) => token.length > 1 && !GENERIC_MODEL_TOKENS.has(token));
  const hasMake = makeTokens.length === 0 || makeTokens.some((token) => exactTitleTokens.has(token));
  const hasModel = distinctiveModelTokens.length > 0
    ? distinctiveModelTokens.some((token) => exactTitleTokens.has(token))
    : hasPhrase(modelPhrase);
  if (!hasMake) return { rejected: 'make not in title' };
  if (!hasModel) return { rejected: 'model not in title' };

  const identityWords = ` ${`${v.make} ${v.model} ${v.generation}`
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  for (const trim of EXCLUSIVE_TRIMS) {
    const recordHasTrim = identityWords.includes(` ${trim} `);
    const titleHasTrim = hasPhrase(trim);
    if (titleHasTrim && !recordHasTrim) {
      return { rejected: `different trim (${trim})` };
    }
    if (recordHasTrim && !titleHasTrim) return { rejected: `trim not verified (${trim})` };
  }

  let score = 0;

  // Generation is the thing most likely to go wrong. A year inside the
  // generation is a strong signal; one outside it disqualifies the file. A
  // title with no year must name the generation explicitly. Guessing is worse
  // than leaving the designed typographic fallback in place.
  const year = extractYear(page.title);
  const titleTokens = new Set(title.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/));
  const genMatch = generationSignals(v.generation).some((signal) => titleTokens.has(signal));
  if (year !== null) {
    if (year < v.years[0] || year > v.years[1]) {
      return { rejected: `year ${year} outside ${v.years[0]}-${v.years[1]}` };
    }
    score += 30;
  } else if (!genMatch) {
    return { rejected: 'generation not verifiable from title' };
  }

  // A generation token is decisive when it is the only proof. When a valid
  // year already proves the generation, keep this as a small tie-breaker so a
  // mediocre coded shot does not outrank a strong front three-quarter view.
  if (genMatch) score += year === null ? 18 : 4;

  PREFER_TITLE.forEach((word, i) => {
    if (hasPhrase(word)) score += 24 - i * 2;
  });
  if (REAR_TITLE.some(hasPhrase)) score -= 20;

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
