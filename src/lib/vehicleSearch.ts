import type { Vehicle } from '../data/types';
import { estimatedPrice, plausibleOdometer } from './pricing';

/**
 * Catalog search for the slot's car picker. docs/SPEC.md section 4.4.
 *
 * Filters answer "what does this money buy"; search answers "is the car I
 * already have in mind in here, and can I afford it". Those are different
 * questions, so search deliberately ignores the slot's role and filters and
 * looks at the whole catalog. It does not ignore the slot's money: every
 * suggestion is priced at the slot's condition and the ones above its share
 * are marked out of budget rather than hidden, because a car that is missing
 * and a car that is too expensive are different answers and only one of them
 * tells the user what to change.
 */

export type Suggestion = {
  vehicle: Vehicle;
  /** Priced at the slot's condition, on an odometer this vehicle's age allows. */
  price: number;
  atMiles: number;
  /** Above the slot's current share. Selectable only after money moves. */
  overBudget: boolean;
  score: number;
};

/** Lowercased, punctuation flattened to spaces: "911 (996)" and "911 996" are the same query. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function tokenize(query: string): string[] {
  const n = normalize(query);
  return n === '' ? [] : n.split(' ');
}

/** Everything a query may legitimately name: identity, generation code, years, shape. */
export function haystack(v: Vehicle): string {
  return normalize(
    `${v.make} ${v.model} ${v.generation} ${v.years[0]} ${v.years[1]} ${v.bodyStyle}`,
  );
}

/** Every token must appear. An empty query matches everything. */
export function matchesQuery(v: Vehicle, query: string): boolean {
  const tokens = tokenize(query);
  if (tokens.length === 0) return true;
  const hay = haystack(v);
  return tokens.every((t) => hay.includes(t));
}

/**
 * Rank by where the query lands, not merely whether it lands. A token that
 * starts the name beats one that starts a word beats one buried mid-word, so
 * "mia" reaches the Miata before it reaches anything merely containing those
 * letters.
 */
function scoreOf(v: Vehicle, tokens: string[]): number {
  const hay = haystack(v);
  const name = normalize(`${v.make} ${v.model}`);
  let score = 0;
  for (const t of tokens) {
    if (name.startsWith(t)) score += 4;
    else if (new RegExp(`\\b${t}`).test(hay)) score += 2;
    else score += 1;
  }
  if (name.startsWith(tokens.join(' '))) score += 3;
  if (name === tokens.join(' ')) score += 3;
  return score;
}

export type SearchQuery = {
  /** The slot's current share, in dollars. */
  budget: number;
  /** The odometer the slot's condition prices at. */
  odometer: number;
  limit?: number;
};

/**
 * Suggestions for one query, best match first and cheapest first inside a tie.
 * Out-of-budget cars keep their place in the ranking: the point of showing
 * them is that the user asked for them by name.
 */
export function searchVehicles(
  catalog: Vehicle[],
  query: string,
  { budget, odometer, limit = 8 }: SearchQuery,
): Suggestion[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const hits: Suggestion[] = [];
  for (const vehicle of catalog) {
    if (!tokens.every((t) => haystack(vehicle).includes(t))) continue;
    const atMiles = plausibleOdometer(odometer, vehicle.years[0], vehicle.years[1]);
    const price = estimatedPrice(vehicle.pricing, atMiles);
    hits.push({
      vehicle,
      price,
      atMiles,
      overBudget: price > budget,
      score: scoreOf(vehicle, tokens),
    });
  }

  hits.sort((a, b) =>
    b.score - a.score
    || a.price - b.price
    || `${a.vehicle.make} ${a.vehicle.model}`.localeCompare(`${b.vehicle.make} ${b.vehicle.model}`));

  return hits.slice(0, limit);
}
