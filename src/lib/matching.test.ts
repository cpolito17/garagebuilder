import { describe, it, expect } from 'vitest';
import { CATALOG } from '../data/catalog';
import { findMatches, explainEmpty, DEFAULT_FILTERS, cautionsFor } from './matching';
import { plausibleMinMiles, plausibleMaxMiles, priceAtMiles, MAX_ODOMETER } from './pricing';

const q = (o: Partial<Parameters<typeof findMatches>[1]> = {}) => ({
  budget: 18000, role: null, odometer: 100_000, filters: DEFAULT_FILTERS, ...o,
});

describe('the odometer sets the price of the whole list', () => {
  it('prices every result at the requested odometer when age allows it', () => {
    for (const odometer of [20_000, 100_000, 200_000]) {
      for (const m of findMatches(CATALOG, q({ budget: 60_000, odometer })).matches) {
        const low = plausibleMinMiles(m.vehicle.years[1]);
        const high = plausibleMaxMiles(m.vehicle.years[0]);
        const expected = Math.min(high, Math.max(low, odometer));
        expect(m.atMiles, `${m.vehicle.id} at ${odometer}`).toBe(expected);
      }
    }
  });

  it('never offers an old car at delivery mileage', () => {
    for (const m of findMatches(CATALOG, q({ budget: 40_000, odometer: 0 })).matches) {
      const floor = plausibleMinMiles(m.vehicle.years[1]);
      expect(m.atMiles, `${m.vehicle.id} (${m.vehicle.years[1]})`).toBeGreaterThanOrEqual(floor);
    }
  });

  it('never invents an odometer a vehicle is too young to have reached', () => {
    for (const m of findMatches(CATALOG, q({ budget: 90_000, odometer: 250_000 })).matches) {
      expect(m.atMiles, m.vehicle.id).toBeLessThanOrEqual(plausibleMaxMiles(m.vehicle.years[0]));
    }
  });

  it('allows a current-model-year vehicle to show zero miles', () => {
    const current = CATALOG.filter((v) => v.status === 'current' && v.years[1] >= new Date().getFullYear());
    expect(current.length).toBeGreaterThan(0);
    for (const v of current) expect(plausibleMinMiles(v.years[1])).toBe(0);
  });

  it('quotes the price at that odometer, and never more than the budget', () => {
    for (const budget of [8000, 15_000, 25_000, 60_000]) {
      for (const m of findMatches(CATALOG, q({ budget, odometer: 120_000 })).matches) {
        expect(m.spend, `${m.vehicle.id} at ${budget}`).toBeLessThanOrEqual(budget);
        expect(m.spend).toBeLessThanOrEqual(priceAtMiles(m.vehicle.pricing, m.atMiles));
      }
    }
  });
});

describe('the odometer dial', () => {
  it('brings in more vehicles as it winds up, and never removes one', () => {
    let previous = -1;
    for (const odometer of [20_000, 60_000, 100_000, 160_000, 250_000]) {
      const n = findMatches(CATALOG, q({ role: 'sports', odometer })).matches.length;
      expect(n, `at ${odometer}`).toBeGreaterThanOrEqual(previous);
      previous = n;
    }
  });

  it('buys a more expensive car at a higher odometer for the same money', () => {
    const tight = findMatches(CATALOG, q({ budget: 18_000, role: 'sports', odometer: 20_000 }));
    const loose = findMatches(CATALOG, q({ budget: 18_000, role: 'sports', odometer: 250_000 }));
    const priciestNew = (ms: typeof tight.matches) =>
      Math.max(...ms.map((m) => priceAtMiles(m.vehicle.pricing, m.vehicle.pricing.baselineMiles)));
    expect(priciestNew(loose.matches)).toBeGreaterThan(priciestNew(tight.matches));
  });

  it('makes the same vehicle cheaper as the odometer rises', () => {
    const id = 'bmw-m3-e90';
    const priceOf = (odometer: number) =>
      findMatches(CATALOG, q({ budget: 200_000, role: 'sports', odometer })).matches
        .find((m) => m.vehicle.id === id)?.spend;
    const low = priceOf(30_000);
    const high = priceOf(200_000);
    expect(low).toBeDefined();
    expect(high).toBeDefined();
    expect(high!).toBeLessThan(low!);
  });
});

describe('result diversity', () => {
  it('does not fill the top of a list with one model', () => {
    const top = findMatches(CATALOG, q({ role: 'sports' })).matches.slice(0, 5);
    const models = top.map((m) => `${m.vehicle.make}|${m.vehicle.model}`);
    expect(new Set(models).size).toBeGreaterThanOrEqual(4);
  });
});

describe('price-led ranking', () => {
  it('does not rank a cheap car first when the slot budget exceeds the catalog', () => {
    const list = findMatches(CATALOG, q({ budget: 1_303_281, role: 'sports', odometer: 80_000 }));
    const highestAttainable = Math.max(...list.matches.map((match) => match.spend));
    expect(list.matches[0]!.spend).toBeGreaterThanOrEqual(highestAttainable * 0.95);
    expect(list.matches[0]!.vehicle.id).not.toBe('mazda-mx5-nd');
  });

  it('keeps the top result near the highest attainable price at normal budgets', () => {
    for (const budget of [20_000, 40_000, 80_000]) {
      const list = findMatches(CATALOG, q({ budget, role: 'sports', odometer: 80_000 }));
      const highestAttainable = Math.max(...list.matches.map((match) => match.spend));
      expect(list.matches[0]!.spend, String(budget)).toBeGreaterThanOrEqual(highestAttainable * 0.95);
    }
  });
});

describe('cautions', () => {
  it('surfaces an issue exactly when the odometer has passed its onset', () => {
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
  it('offers a concrete odometer when winding the dial up would fill the list', () => {
    const query = q({ budget: 8000, role: 'sports', odometer: 20_000 });
    const list = findMatches(CATALOG, query);
    expect(list.matches).toHaveLength(0);
    const e = explainEmpty(list, query);
    expect(e.action?.kind).toBe('set-odometer');
    expect(e.action!.value).toBeGreaterThan(20_000);
    // The offer has to be true: taking it must produce results.
    const after = findMatches(CATALOG, { ...query, odometer: e.action!.value });
    expect(after.matches.length).toBeGreaterThan(0);
  });

  it('never offers an odometer the dial cannot reach', () => {
    // Regression: a $4,424 sports slot at 0 miles offered 255,000, past the end
    // of the control, so taking the offer silently landed somewhere else.
    for (const budget of [2_500, 4_424, 8_000, 14_000]) {
      for (const odometer of [0, 40_000, 120_000]) {
        const query = q({ budget, role: 'sports', odometer });
        const list = findMatches(CATALOG, query);
        if (list.matches.length > 0) continue;
        const e = explainEmpty(list, query);
        if (!e.action) continue;
        expect(e.action.value, `${budget} at ${odometer}`).toBeLessThanOrEqual(MAX_ODOMETER);
        expect(e.action.value).toBeGreaterThan(odometer);
        // Every offer has to be honoured by the thing it offers.
        const after = findMatches(CATALOG, { ...query, odometer: e.action.value });
        expect(after.matches.length, `${budget} at ${odometer}`).toBeGreaterThan(0);
      }
    }
  });

  it('names the same vehicle in the message and the offer', () => {
    const query = q({ budget: 12_000, role: 'sports', odometer: 20_000 });
    const list = findMatches(CATALOG, query);
    expect(list.matches).toHaveLength(0);
    const e = explainEmpty(list, query);
    expect(e.action).toBeDefined();
    const named = list.overBudget
      .filter((o) => o.reachableAt !== null && o.reachableAt > query.odometer && o.reachableAt <= MAX_ODOMETER)
      .sort((a, b) => a.reachableAt! - b.reachableAt!)[0]!;
    expect(e.message).toContain(`${named.vehicle.make} ${named.vehicle.model}`);
  });

  it('never tells the user they need zero more dollars', () => {
    for (const budget of [3000, 5000, 9000]) {
      const query = q({ budget, role: 'tow', odometer: 250_000 });
      const list = findMatches(CATALOG, query);
      if (list.matches.length > 0) continue;
      expect(explainEmpty(list, query).message).not.toContain('$0');
    }
  });

  it('says the odometer cannot help when no odometer can', () => {
    const query = q({ budget: 1500, role: 'sports', odometer: 250_000 });
    const list = findMatches(CATALOG, query);
    expect(list.matches).toHaveLength(0);
    const e = explainEmpty(list, query);
    expect(e.action).toBeUndefined();
    expect(e.message).toMatch(/at any odometer its age allows/);
  });

  it('names transmission and drivetrain when that pairing is the cause', () => {
    const query = q({ budget: 30_000, role: 'sports', filters: { ...DEFAULT_FILTERS, transmissions: ['manual'], drivetrains: ['4WD'] } });
    const e = explainEmpty(findMatches(CATALOG, query), query);
    expect(e.message).toMatch(/transmission and drivetrain/);
  });
});
