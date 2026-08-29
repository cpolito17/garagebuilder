import type { ImageLicence } from '../../src/data/images';

/**
 * Wikimedia Commons selection logic, kept pure so it can be tested without a
 * network. Choosing the wrong file is the failure mode that matters: an NA
 * Miata photograph on the NC record is worse than no photograph at all.
 */

export type CommonsPage = {
  pageid: number | string;
  title: string;
  /** Which downloader supplied this candidate. Commons when omitted. */
  provider?: 'commons' | 'openverse';
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

/**
 * Cars that are not the car the catalog describes.
 *
 * A modified, liveried or service-bodied example is a different object from
 * the vehicle a buyer would be shopping for, so these are hard rejections
 * rather than penalties. Rejecting too much only costs a photograph, and the
 * typographic identity band is a designed state; showing a widebody drift car
 * as a stock Silvia is a false statement about what the money buys.
 */
const REJECT_ALTERED = [
  'modified', 'modded', 'tuning', 'tuned', 'custom', 'restomod', 'widebody',
  'wide body', 'body kit', 'bodykit', 'stance', 'stanced', 'slammed', 'lowered',
  'lifted', 'swap', 'swapped', 'drift', 'drifting', 'livery', 'wrapped',
  'wrap ', 'replica', 'kit car', 'race car', 'racecar', 'rally car', 'racing',
  'race ', 'spec miata', 'time attack', 'autocross', 'rallycross', 'nascar',
  'police', 'polizei', 'sheriff', 'taxi', 'ambulance', 'hearse', 'fire dept',
  'tuner', 'showcar', 'show car', 'prototype', 'concept', 'camouflage',
  'camouflaged', 'spy', 'artcar', 'art car',
];

/**
 * Signals that the frame is not one clean car.
 *
 * Penalised rather than rejected: the title is weak evidence about framing, so
 * a heavy penalty demotes these behind anything better while still allowing
 * one through when a vehicle has no other free photograph at all.
 */
const PENALTY_TITLE: [phrase: string, penalty: number][] = [
  // A crowd, a stand, a hall. Also where most modified cars are photographed.
  // "motor show" is absent because REJECT_TITLE's "motor" already takes it.
  ['auto show', 40], ['autoshow', 40],
  ['car show', 40], ['carshow', 40], ['autosalon', 40], ['salon', 30],
  ['messe', 35], ['expo', 30], ['exposition', 30], ['iaa', 35], ['sema', 40],
  ['geneva', 30], ['genf', 30], ['goodwood', 35], ['concours', 35],
  ['festival', 30], ['meeting', 30], ['meet ', 30], ['rally', 25],
  ['cars and coffee', 35], ['paddock', 35], ['grid', 30], ['pit lane', 35],
  ['museum', 30], ['dealership', 30], ['showroom', 25],
  // More than one car in the frame.
  [' and ', 25], [' vs ', 35], ['versus', 35], ['lineup', 40], ['line up', 35],
  ['group of', 40], ['row of', 40], ['pair of', 35], ['convoy', 40],
  ['parking lot', 30], ['car park', 30], ['collection', 30], ['fleet', 35],
  // People in the frame.
  ['driver', 25], ['owner', 25], ['crowd', 40], ['people', 35],
  ['presentation', 30], ['unveiling', 35], ['press', 25], ['launch', 25],
  // Too far away, or too close.
  ['aerial', 40], ['drone', 35], ['from above', 30], ['panorama', 35],
  ['street scene', 35], ['traffic', 35], ['parade', 40],
  ['detail', 35], ['close up', 35], ['closeup', 35], ['close-up', 35], ['macro', 40],
];

/**
 * Angles worth having, in descending preference.
 *
 * A quarter view is the shot that shows a car's proportions, and Commons
 * titles name it as a pair: "front right", "front left". Those score far above
 * a bare "front", which is usually a flat head-on view.
 */
const PREFER_TITLE = [
  'front right', 'front left', 'three-quarter', 'three quarter', '3 4', '3q',
  'front three quarter', 'front', 'frontal', 'side', 'profile',
];

const REAR_TITLE = ['rear', 'back'];

/**
 * Words that say nothing about which photograph this is: the car's own name,
 * how it was framed, and the date. What remains is the place, the event and
 * the occasion, which is what makes two photographs the same photograph.
 */
const NON_DISTINCTIVE = new Set([
  'the', 'a', 'an', 'of', 'in', 'at', 'on', 'and', 'with', 'de', 'la', 'le',
  'front', 'rear', 'back', 'side', 'left', 'right', 'profile', 'view', 'quarter',
  'photo', 'image', 'picture', 'jpg', 'jpeg', 'png', 'car', 'auto', 'automobile',
  'usa', 'us', 'uk', 'germany', 'deutschland', 'america',
]);

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
  for (const bad of REJECT_ALTERED) if (hasPhrase(bad)) return { rejected: `not a stock car ("${bad.trim()}")` };

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

  // A quarter view is worth far more than a bare head-on shot, so the first
  // entries are weighted heavily rather than linearly down the list.
  PREFER_TITLE.forEach((word, i) => {
    if (hasPhrase(word)) score += Math.max(6, 40 - i * 4);
  });
  if (REAR_TITLE.some(hasPhrase)) score -= 20;

  // Shows, crowds, several cars, and frames too far out or too close in.
  // Penalties rather than rejections: the title is weak evidence about what is
  // actually in the frame, so these demote rather than disqualify.
  for (const [phrase, penalty] of PENALTY_TITLE) if (hasPhrase(phrase)) score -= penalty;

  // "Tesla Model 3 & Chevy Bolt EV" is two cars. Checked against the raw
  // title because the ampersand is gone by the time phrases are matched.
  if (/\s&\s/.test(page.title)) score -= 30;

  // Prefer a natural landscape crop and a large original.
  score += aspect >= 1.3 && aspect <= 1.85 ? 12 : 4;
  score += Math.min(12, Math.log2(info.width / 800) * 6);

  return { page, score, licence, author: normaliseArtist(info.extmetadata?.Artist?.value) };
}

/**
 * What is left of a title once the car's own name, the framing words and the
 * dates are removed: the place, the event, the occasion.
 */
export function distinctiveTokens(title: string, v: VehicleKey): Set<string> {
  const identity = new Set(
    `${v.make} ${v.model} ${v.generation}`
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean),
  );
  const words = title
    .replace(/^File:/i, '')
    .replace(/\.\w+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/);

  const out = new Set<string>();
  for (const word of words) {
    if (word.length < 3) continue;              // initials, single digits
    if (/^\d+$/.test(word)) continue;           // years, dates, upload ids
    if (identity.has(word)) continue;
    if (NON_DISTINCTIVE.has(word)) continue;
    out.add(word);
  }
  return out;
}

/**
 * Whether two files are the same photograph in all but name.
 *
 * Two people at the same stand upload two frames of the same car, and the
 * existing one-per-author rule lets both through. What actually gives them
 * away is the leftover of the title: "Tesla Model 3 Genf 2018" and "Tesla
 * Model 3 Back Genf 2018" both reduce to the show they were taken at.
 *
 * Containment rather than Jaccard, because one title is often the other plus a
 * word or two. Both sides must have something distinctive left: two titles
 * that reduce to nothing are unknown, not identical.
 */
export function isNearDuplicate(a: Set<string>, b: Set<string>, threshold = 0.6): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / Math.min(a.size, b.size) >= threshold;
}

/**
 * Pick up to `limit` files: at most one per author, and never two that reduce
 * to the same occasion, so a gallery is three photographs of the car rather
 * than three angles on one afternoon at one show.
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
  const taken: Set<string>[] = [];
  for (const c of scored) {
    const key = c.author.toLowerCase();
    if (key && authors.has(key)) continue;
    const tokens = distinctiveTokens(c.page.title, v);
    if (taken.some((t) => isNearDuplicate(tokens, t))) continue;
    authors.add(key);
    taken.push(tokens);
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
