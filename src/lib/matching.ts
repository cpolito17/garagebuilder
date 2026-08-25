import type { Issue, Role, Vehicle } from '../data/types';
import {
  estimatedPrice, milesAffordable, plausibleMaxMiles, plausibleOdometer,
  MAX_ODOMETER, ODOMETER_STEP,
} from './pricing';

/** Hard filters exposed per slot. All optional, all AND-ed. */
export type Filters = {
  transmissions: string[];
  drivetrains: string[];
  minSeats: number;
  bodyStyles: string[];
  fuels: string[];
  minTowingLb: number;
  minGroundClearanceIn: number;
  minCargoCuFt: number;
  minYear: number;
  minReliability: number;
};

export const DEFAULT_FILTERS: Filters = {
  transmissions: [], drivetrains: [], minSeats: 0, bodyStyles: [], fuels: [],
  minTowingLb: 0, minGroundClearanceIn: 0, minCargoCuFt: 0,
  minYear: 1990, minReliability: 1,
};

/**
 * Roles preset filters, they never replace them. A preset the user cannot see
 * and adjust is a black box, and a black box in a tool that gives financial
 * estimates is a trust problem.
 */
export const ROLE_PRESETS: Partial<Record<Role, Partial<Filters>>> = {
  family: { minSeats: 5, minCargoCuFt: 20 },
  offroad: { drivetrains: ['4WD', 'AWD'], minGroundClearanceIn: 7.5 },
  tow: { minTowingLb: 5000 },
  winter: { drivetrains: ['AWD', '4WD'] },
  cargo: { minCargoCuFt: 40 },
  commuter: { minReliability: 3 },
};

export type MatchOutcome =
  | { kind: 'match'; vehicle: Vehicle; atMiles: number; spend: number; score: number; cautions: Issue[] }
  /**
   * Priced at this slot's odometer and still above its budget. `reachableAt`
   * is the odometer that would bring it into reach, or null when no plausible
   * odometer does, so the empty state can offer a number instead of a shrug.
   */
  | { kind: 'over-budget'; vehicle: Vehicle; atMiles: number; price: number; reachableAt: number | null }
  | { kind: 'filtered'; vehicle: Vehicle };

function passesFilters(v: Vehicle, f: Filters): boolean {
  const s = v.spec;
  if (f.transmissions.length && !f.transmissions.some((t) => s.transmissions.includes(t as never))) return false;
  if (f.drivetrains.length && !f.drivetrains.includes(s.drivetrain)) return false;
  if (f.bodyStyles.length && !f.bodyStyles.includes(v.bodyStyle)) return false;
  if (f.fuels.length && !f.fuels.includes(s.fuel)) return false;
  if (s.seats < f.minSeats) return false;
  if (f.minTowingLb > 0 && (s.towingLb ?? 0) < f.minTowingLb) return false;
  if (f.minGroundClearanceIn > 0 && (s.groundClearanceIn ?? 0) < f.minGroundClearanceIn) return false;
  if (f.minCargoCuFt > 0 && (s.cargoCuFt ?? 0) < f.minCargoCuFt) return false;
  // A generation-wide price estimate cannot prove that the priced example is
  // from the final model year. Be conservative: the whole generation must be
  // at least as new as the requested floor.
  if (v.years[0] < f.minYear) return false;
  if (v.ownership.reliabilityIndex < f.minReliability) return false;
  return true;
}

/**
 * Cautions are any documented issue whose onset the implied odometer has
 * already passed. There is no arbitrary mileage gate: an issue that starts at
 * 60k is exactly as relevant when you are buying at 80k as one that starts at
 * 120k is when you are buying at 140k.
 */
export function cautionsFor(v: Vehicle, atMiles: number): Issue[] {
  return v.knownIssues
    .filter((i) => i.onsetMiles <= atMiles)
    .sort((a, b) => b.typicalCostUsd - a.typicalCostUsd);
}

/** Peaks at 85 to 100 percent of the attainable target. Every dollar below
 *  that band reduces the score; cheap and moderately priced cars must not tie
 *  merely because both are far below a very large budget. */
function budgetFit(spend: number, budget: number): number {
  if (budget <= 0) return 0;
  const r = spend / budget;
  if (r > 1) return Math.max(0, 1 - (r - 1) * 4);
  if (r >= 0.85) return 1;
  return Math.max(0, r / 0.85);
}

function roleFit(v: Vehicle, role: Role | null): number {
  if (!role) return 1;
  const i = v.roles.indexOf(role);
  if (i < 0) return 0;
  return i === 0 ? 1 : 0.7;
}

function ownershipFit(v: Vehicle): number {
  const o = v.ownership;
  return (o.reliabilityIndex + o.partsAvailability + (6 - o.insuranceIndex)) / 15;
}

function rankScore(
  vehicle: Vehicle,
  spend: number,
  q: SlotQuery,
  attainableTarget: number,
): number {
  // No mileage term. Every car in the list is priced at the same odometer, so
  // mileage is the constant the user set rather than a way to separate them.
  return (
    0.70 * budgetFit(spend, attainableTarget) +
    0.22 * roleFit(vehicle, q.role) +
    0.08 * ownershipFit(vehicle)
  );
}

export type SlotQuery = {
  budget: number;
  role: Role | null;
  /** One odometer for the whole list. Every result is priced at it. */
  odometer: number;
  filters: Filters;
};

/**
 * The odometer that would bring this vehicle inside the budget, or null when
 * none does: either the budget sits under the price floor, or the odometer it
 * implies is higher than the vehicle's age allows.
 */
function reachableOdometer(v: Vehicle, budget: number): number | null {
  const raw = milesAffordable(v.pricing, budget);
  if (raw === null) return null;
  if (raw > plausibleMaxMiles(v.years[0])) return null;
  return plausibleOdometer(raw, v.years[0], v.years[1]);
}

/**
 * The slot fixes the odometer and asks what each vehicle costs there. This is
 * the inversion of the original ceiling behaviour and it is the mechanic the
 * product is for: winding the odometer up does not filter the list, it
 * re-prices it, and cars that were out of reach walk into the budget.
 */
export function evaluate(v: Vehicle, q: SlotQuery): MatchOutcome {
  if (q.role && !v.roles.includes(q.role)) return { kind: 'filtered', vehicle: v };
  if (!passesFilters(v, q.filters)) return { kind: 'filtered', vehicle: v };

  const atMiles = plausibleOdometer(q.odometer, v.years[0], v.years[1]);
  const price = estimatedPrice(v.pricing, atMiles);

  if (price > q.budget) {
    return { kind: 'over-budget', vehicle: v, atMiles, price, reachableAt: reachableOdometer(v, q.budget) };
  }

  return {
    kind: 'match',
    vehicle: v,
    atMiles,
    spend: price,
    score: rankScore(v, price, q, q.budget),
    cautions: cautionsFor(v, atMiles),
  };
}

export type Match = Extract<MatchOutcome, { kind: 'match' }>;

export type MatchList = {
  matches: Match[];
  /** Priced above the budget at this odometer, cheapest first. */
  overBudget: Extract<MatchOutcome, { kind: 'over-budget' }>[];
  filtered: number;
};

/**
 * Four generations of Miata are four correct answers to the same question,
 * and a list that is four Miatas has told the user nothing. Keep the best
 * example of each model at full score and demote the rest so the list shows
 * breadth first and depth second.
 */
function diversify(matches: Match[], attainableTarget: number): Match[] {
  const seen = new Map<string, number>();
  const weighted = matches.map((m) => {
    const key = `${m.vehicle.make}|${m.vehicle.model}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const penalty = n === 0 ? 1 : n === 1 ? 0.72 : 0.55;
    return { m, adjusted: m.score * penalty };
  });
  // Price is the primary intent. Compare results in five-percent price bands,
  // then use role, mileage, ownership, and model diversity inside each band.
  // This keeps a $30k Miata out of first place in a seven-figure slot without
  // pretending the catalog contains a seven-figure car.
  const bandSize = Math.max(500, attainableTarget * 0.05);
  const band = (spend: number) => Math.floor(Math.max(0, attainableTarget - spend) / bandSize);
  weighted.sort((a, b) => band(a.m.spend) - band(b.m.spend) || b.adjusted - a.adjusted);
  return weighted.map((w) => w.m);
}

export function findMatches(catalog: Vehicle[], q: SlotQuery): MatchList {
  const matches: Match[] = [];
  const overBudget: MatchList['overBudget'] = [];
  let filtered = 0;

  for (const v of catalog) {
    const r = evaluate(v, q);
    if (r.kind === 'match') matches.push(r);
    else if (r.kind === 'over-budget') overBudget.push(r);
    else filtered++;
  }

  const attainableTarget = Math.min(
    q.budget,
    matches.reduce((highest, match) => Math.max(highest, match.spend), 0),
  );
  for (const match of matches) {
    match.score = rankScore(match.vehicle, match.spend, q, attainableTarget);
  }
  matches.sort((a, b) => b.score - a.score);
  overBudget.sort((a, b) => a.price - b.price);
  return { matches: diversify(matches, attainableTarget), overBudget, filtered };
}

/**
 * Names the specific constraint that eliminated the last candidate, so the
 * empty state can say something true instead of shrugging.
 */
/**
 * Names the specific constraint that eliminated the last candidate, and where
 * possible the exact value that would bring something back. An empty state
 * that only shrugs is a dead end.
 */
export function explainEmpty(list: MatchList, q: SlotQuery): {
  message: string;
  action?: { label: string; kind: 'set-odometer'; value: number };
} {
  // The offer is the smallest wind of the dial that brings something in, and
  // the message names that same vehicle: an offer about one car and a sentence
  // about another reads as two unrelated facts. Never past the dial's own end,
  // because an offer the control cannot honour is worse than no offer.
  const reachable = list.overBudget
    .filter((o) => o.reachableAt !== null && o.reachableAt > q.odometer && o.reachableAt <= MAX_ODOMETER)
    .sort((a, b) => a.reachableAt! - b.reachableAt!);

  if (reachable.length > 0) {
    const nearest = reachable[0]!;
    const needed = Math.min(MAX_ODOMETER, Math.ceil(nearest.reachableAt! / ODOMETER_STEP) * ODOMETER_STEP);
    const n = list.overBudget.length;
    return {
      message: `${n} ${n === 1 ? 'vehicle fits' : 'vehicles fit'} these filters but ${n === 1 ? 'costs' : 'cost'} more than ${fmt(q.budget)} at ${fmt0(q.odometer)} miles. The nearest is the ${nearest.vehicle.make} ${nearest.vehicle.model}, ${fmt(nearest.price)} here, and inside the budget at ${fmt0(needed)} miles.`,
      action: { label: `Set the odometer to ${needed.toLocaleString()}`, kind: 'set-odometer', value: needed },
    };
  }

  if (list.overBudget.length > 0) {
    const nearest = list.overBudget[0]!;
    const need = Math.max(500, Math.ceil((nearest.price - q.budget) / 500) * 500);
    return {
      message: `Nothing here costs ${fmt(q.budget)} or less at any odometer its age allows. The closest is the ${nearest.vehicle.make} ${nearest.vehicle.model}, which needs about ${fmt(need)} more.`,
    };
  }

  if (q.filters.transmissions.length || q.filters.drivetrains.length) {
    return { message: 'No vehicle matches this combination of transmission and drivetrain. Relax one of them.' };
  }
  return { message: 'No vehicle matches these filters. Relax a filter or move budget into this slot.' };
}

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmt0(n: number) {
  return Math.round(n).toLocaleString('en-US');
}
