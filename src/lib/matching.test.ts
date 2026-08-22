import { describe, it, expect } from 'vitest';
import { CATALOG } from '../data/catalog';
import { findMatches, explainEmpty, DEFAULT_FILTERS, cautionsFor } from './matching';
import { plausibleMinMiles, plausibleMaxMiles, priceAtMiles } from './pricing';

const q = (o: Partial<Parameters<typeof findMatches>[1]> = {}) => ({
  budget: 18000, role: null, maxMiles: 150_000, filters: DEFAULT_FILTERS, ...o,
});

describe('plausible odometer guards', () => {
  it('never offers an old car at delivery mileage', () => {
    // A 1990-1997 generation cannot show single-digit thousands in 2026.
    const list = findMatches(CATALOG, q({ budget: 40_000 }));
    for (const m of list.matches) {
      const floor = plausibleMinMiles(m.vehicle.years[1]);
      expect(m.atMiles, `${m.vehicle.id} (${m.vehicle.years[1]})`).toBeGreaterThanOrEqual(floor);
    }
  });

  it('allows a current-model-year vehicle to show zero miles', () => {
    const current = CATALOG.filter((v) => v.status === 'current' && v.years[1] >= 2026);
    expect(current.length).toBeGreaterThan(0);
    for (const v of current) expect(plausibleMinMiles(v.years[1])).toBe(0);
  });

  it('never returns a match above the slot ceiling or above what age permits', () => {
    for (const ceiling of [40_000, 90_000, 150_000, 250_000]) {
      for (const m of findMatches(CATALOG, q({ maxMiles: ceiling })).matches) {
        expect(m.atMiles, m.vehicle.id).toBeLessThanOrEqual(ceiling);
        expect(m.atMiles, m.vehicle.id).toBeLessThanOrEqual(plausibleMaxMiles(m.vehicle.years[0]));
      }
    }
  });

  it('never quotes a spend above the slot budget', () => {
    for (const budget of [8000, 15_000, 25_000, 60_000]) {
      for (const m of findMatches(CATALOG, q({ budget })).matches) {
        expect(m.spend, `${m.vehicle.id} at ${budget}`).toBeLessThanOrEqual(budget + 1);
      }
    }
  });
});

describe('the mileage dial', () => {
  it('reveals strictly more vehicles as the ceiling rises', () => {
    let previous = -1;
    for (const ceiling of [40_000, 80_000, 120_000, 200_000, 300_000]) {
      const n = findMatches(CATALOG, q({ role: 'sports', maxMiles: ceiling })).matches.length;
      expect(n).toBeGreaterThanOrEqual(previous);
      previous = n;
    }
  });

  it('buys a more expensive car at a higher odometer for the same money', () => {
    const tight = findMatches(CATALOG, q({ budget: 18_000, role: 'sports', maxMiles: 50_000 }));
    const loose = findMatches(CATALOG, q({ budget: 18_000, role: 'sports', maxMiles: 250_000 }));
    const priciestNew = (ms: typeof tight.matches) =>
      Math.max(...ms.map((m) => priceAtMiles(m.vehicle.pricing, m.vehicle.pricing.baselineMiles)));
    expect(priciestNew(loose.matches)).toBeGreaterThan(priciestNew(tight.matches));
  });
});

describe('result diversity', () => {
  it('does not fill the top of a list with one model', () => {
    const top = findMatches(CATALOG, q({ role: 'sports' })).matches.slice(0, 5);
    const models = top.map((m) => `${m.vehicle.make}|${m.vehicle.model}`);
    expect(new Set(models).size).toBeGreaterThanOrEqual(4);
  });
});

describe('cautions', () => {
  it('surfaces an issue exactly when the implied odometer has passed its onset', () => {
    const v = CATALOG.find((x) => x.id === 'porsche-boxster-986')!;
    const ims = v.knownIssues.find((i) => i.text.includes('IMS'))!;
    expect(cautionsFor(v, ims.onsetMiles - 1)).not.toContain(ims);
    expect(cautionsFor(v, ims.onsetMiles + 1)).toContain(ims);
  });

  it('orders cautions by cost so the expensive one is read first', () => {
    const v = CATALOG.find((x) => x.id === 'bmw-7-series-f01')!;
    const cs = cautionsFor(v, 150_000);
    expect(cs.length).toBeGreaterThan(1);
    for (let i = 1; i < cs.length; i++) {
      expect(cs[i - 1]!.typicalCostUsd).toBeGreaterThanOrEqual(cs[i]!.typicalCostUsd);
    }
  });
});

describe('empty states', () => {
  it('offers a concrete ceiling when the mileage limit is what excluded everything', () => {
    const query = q({ budget: 8000, role: 'sports', maxMiles: 120_000 });
    const list = findMatches(CATALOG, query);
    expect(list.matches).toHaveLength(0);
    const e = explainEmpty(list, query);
    expect(e.action?.kind).toBe('raise-ceiling');
    expect(e.action!.value).toBeGreaterThan(120_000);
  });

  it('never tells the user they need zero more dollars', () => {
    // A budget sitting exactly on a vehicle floor.
    const query = q({ budget: 9000, role: 'tow', maxMiles: 100_000 });
    const e = explainEmpty(findMatches(CATALOG, query), query);
    expect(e.message).not.toContain('$0');
  });

  it('names transmission and drivetrain when that pairing is the cause', () => {
    const query = q({ budget: 30_000, role: 'sports', filters: { ...DEFAULT_FILTERS, transmissions: ['manual'], drivetrains: ['4WD'] } });
    const e = explainEmpty(findMatches(CATALOG, query), query);
    expect(e.message).toMatch(/transmission and drivetrain/);
  });
});
