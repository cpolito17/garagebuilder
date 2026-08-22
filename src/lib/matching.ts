import type { Issue, Role, Vehicle } from '../data/types';
import {
  milesAffordable, priceAtMiles, priceRange, plausibleMaxMiles, plausibleMinMiles,
  type PriceBand,
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
  | { kind: 'match'; vehicle: Vehicle; atMiles: number; band: PriceBand; spend: number; score: number; cautions: Issue[] }
  | { kind: 'below-floor'; vehicle: Vehicle; shortfall: number }
  | { kind: 'over-ceiling'; vehicle: Vehicle; needsMiles: number }
  | { kind: 'implausible'; vehicle: Vehicle }
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
  if (v.years[1] < f.minYear) return false;
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

/** Peaks at 85 to 100 percent of budget consumed. Underspend is penalised about
 *  half as hard as overspend, because underspend is at least recoverable. */
function budgetFit(spend: number, budget: number): number {
  if (budget <= 0) return 0;
  const r = spend / budget;
  if (r > 1) return Math.max(0, 1 - (r - 1) * 4);
  if (r >= 0.85) return 1;
  return Math.max(0, 1 - (0.85 - r) * 2);
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

export type SlotQuery = {
  budget: number;
  role: Role | null;
  maxMiles: number;
  filters: Filters;
};

export function evaluate(v: Vehicle, q: SlotQuery): MatchOutcome {
  if (q.role && !v.roles.includes(q.role)) return { kind: 'filtered', vehicle: v };
  if (!passesFilters(v, q.filters)) return { kind: 'filtered', vehicle: v };

  const raw = milesAffordable(v.pricing, q.budget);
  if (raw === null) {
    return { kind: 'below-floor', vehicle: v, shortfall: v.pricing.floor - q.budget };
  }

  // An odometer time does not permit is removed outright. One the user's own
  // ceiling excludes is reported back, so the empty state can name the exact
  // ceiling that would reveal it.
  if (raw > plausibleMaxMiles(v.years[0])) return { kind: 'implausible', vehicle: v };
  if (raw > q.maxMiles) return { kind: 'over-ceiling', vehicle: v, needsMiles: raw };

  // Clamped up to the lowest odometer this generation could plausibly show.
  // Below that the budget is buying a car that does not exist, and the honest
  // outcome is underspending on one that does.
  const atMiles = Math.max(plausibleMinMiles(v.years[1]), raw);

  // The clamp can push a car back over the user's ceiling: the cheapest
  // example the budget reaches is fine, but the lowest-mileage example that
  // exists at all is still above the limit they set.
  if (atMiles > q.maxMiles) return { kind: 'over-ceiling', vehicle: v, needsMiles: atMiles };

  const spend = priceAtMiles(v.pricing, atMiles);

  const score =
    0.40 * budgetFit(spend, q.budget) +
    0.25 * roleFit(v, q.role) +
    0.20 * (1 - Math.min(1, atMiles / Math.max(1, q.maxMiles))) +
    0.15 * ownershipFit(v);

  return {
    kind: 'match',
    vehicle: v,
    atMiles,
    band: priceRange(v.pricing, atMiles),
    spend,
    score,
    cautions: cautionsFor(v, atMiles),
  };
}

export type Match = Extract<MatchOutcome, { kind: 'match' }>;

export type MatchList = {
  matches: Match[];
  belowFloor: Extract<MatchOutcome, { kind: 'below-floor' }>[];
  overCeiling: Extract<MatchOutcome, { kind: 'over-ceiling' }>[];
  implausible: number;
  filtered: number;
};

/**
 * Four generations of Miata are four correct answers to the same question,
 * and a list that is four Miatas has told the user nothing. Keep the best
 * example of each model at full score and demote the rest so the list shows
 * breadth first and depth second.
 */
function diversify(matches: Match[]): Match[] {
  const seen = new Map<string, number>();
  const weighted = matches.map((m) => {
    const key = `${m.vehicle.make}|${m.vehicle.model}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const penalty = n === 0 ? 1 : n === 1 ? 0.72 : 0.55;
    return { m, adjusted: m.score * penalty };
  });
  weighted.sort((a, b) => b.adjusted - a.adjusted);
  return weighted.map((w) => w.m);
}

export function findMatches(catalog: Vehicle[], q: SlotQuery): MatchList {
  const matches: Match[] = [];
  const belowFloor: MatchList['belowFloor'] = [];
  const overCeiling: MatchList['overCeiling'] = [];
  let implausible = 0;
  let filtered = 0;

  for (const v of catalog) {
    const r = evaluate(v, q);
    if (r.kind === 'match') matches.push(r);
    else if (r.kind === 'below-floor') belowFloor.push(r);
    else if (r.kind === 'over-ceiling') overCeiling.push(r);
    else if (r.kind === 'implausible') implausible++;
    else filtered++;
  }

  matches.sort((a, b) => b.score - a.score);
  belowFloor.sort((a, b) => a.shortfall - b.shortfall);
  overCeiling.sort((a, b) => a.needsMiles - b.needsMiles);
  return { matches: diversify(matches), belowFloor, overCeiling, implausible, filtered };
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
  action?: { label: string; kind: 'raise-ceiling'; value: number };
} {
  if (list.overCeiling.length > 0) {
    const nearest = list.overCeiling[0]!;
    const needed = Math.ceil(nearest.needsMiles / 10_000) * 10_000;
    const n = list.overCeiling.length;
    return {
      message: `${n} ${n === 1 ? 'vehicle fits' : 'vehicles fit'} this budget, but only at a higher odometer than your limit allows. The closest is the ${nearest.vehicle.make} ${nearest.vehicle.model} at about ${Math.round(nearest.needsMiles / 1000)},000 miles.`,
      action: { label: `Raise the mileage limit to ${needed.toLocaleString()}`, kind: 'raise-ceiling', value: needed },
    };
  }
  if (list.belowFloor.length > 0) {
    const nearest = list.belowFloor[0]!;
    // A budget sitting exactly on a floor has a shortfall of zero, and
    // "needs about $0 more" is not a sentence. Never promise below one step.
    const need = Math.max(500, Math.ceil(nearest.shortfall / 500) * 500);
    return {
      message: `Nothing reaches this slot at ${fmt(q.budget)}. The closest is the ${nearest.vehicle.make} ${nearest.vehicle.model}, which needs about ${fmt(need)} more at any odometer.`,
    };
  }
  if (list.implausible > 0) {
    const n = list.implausible;
    return {
      message: `${n} ${n === 1 ? 'vehicle would need' : 'vehicles would need'} a higher odometer than their age allows at this budget. Move more budget into this slot.`,
    };
  }
  if (q.filters.transmissions.length || q.filters.drivetrains.length) {
    return { message: 'No vehicle matches this combination of transmission and drivetrain at this budget. Relax one of them.' };
  }
  return { message: 'No vehicle matches these filters at this budget. Relax a filter or move budget into this slot.' };
}

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
