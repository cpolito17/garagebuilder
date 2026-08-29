import { describe, it, expect } from 'vitest';
import { CATALOG } from '../data/catalog';
import { matchesQuery, normalize, searchVehicles, tokenize } from './vehicleSearch';
import { estimatedPrice, plausibleOdometer } from './pricing';
import { milesFor } from './condition';

const ODO = milesFor('worn');
const q = (query: string, budget = 20_000, limit = 8) =>
  searchVehicles(CATALOG, query, { budget, odometer: ODO, limit });

describe('query normalisation', () => {
  it('flattens case and punctuation so a generation code reads either way', () => {
    expect(normalize('911 (996)')).toBe('911 996');
    expect(tokenize('  Mazda   MX-5 ')).toEqual(['mazda', 'mx', '5']);
    expect(tokenize('   ')).toEqual([]);
  });

  it('treats an empty query as no constraint', () => {
    expect(matchesQuery(CATALOG[0]!, '')).toBe(true);
    expect(q('')).toEqual([]);
  });
});

describe('searching the catalog', () => {
  it('finds a car by make, by model, and by both', () => {
    for (const query of ['toyota', 'tacoma', 'toyota tacoma']) {
      const hits = q(query, 40_000);
      expect(hits.length, query).toBeGreaterThan(0);
      expect(hits.every((h) => matchesQuery(h.vehicle, query)), query).toBe(true);
    }
  });

  it('requires every token to land, so two makes match nothing', () => {
    expect(q('toyota porsche')).toEqual([]);
  });

  it('ranks a name the query starts above an incidental mention', () => {
    const hits = q('honda', 60_000, 30);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.vehicle.make.toLowerCase()).toBe('honda');
  });

  it('never returns more than the limit', () => {
    expect(q('a', 1_000_000, 5).length).toBeLessThanOrEqual(5);
  });
});

describe('pricing a suggestion against the slot', () => {
  it('prices every hit at the slot condition, on an odometer the car can have', () => {
    for (const hit of q('bmw', 30_000, 20)) {
      const atMiles = plausibleOdometer(ODO, hit.vehicle.years[0], hit.vehicle.years[1]);
      expect(hit.atMiles).toBe(atMiles);
      expect(hit.price).toBe(estimatedPrice(hit.vehicle.pricing, atMiles));
    }
  });

  it('marks a hit out of budget exactly when it costs more than the slot holds', () => {
    for (const hit of q('porsche', 25_000, 30)) {
      expect(hit.overBudget, hit.vehicle.id).toBe(hit.price > 25_000);
    }
  });

  it('shows the car the user named even when it is unaffordable', () => {
    const broke = q('porsche 911', 1_500, 30);
    expect(broke.length).toBeGreaterThan(0);
    expect(broke.every((h) => h.overBudget)).toBe(true);
  });

  it('brings the same car into budget when the slot holds more', () => {
    const name = 'porsche 911';
    const rich = q(name, 2_000_000, 30);
    expect(rich.length).toBeGreaterThan(0);
    expect(rich.some((h) => !h.overBudget)).toBe(true);
  });

  it('ignores role and filters: search is about the car, not the slot', () => {
    // A truck is nobody's sports car, and searching for one still finds it.
    const hits = q('tacoma', 1_000_000, 30);
    expect(hits.length).toBeGreaterThan(0);
  });
});
