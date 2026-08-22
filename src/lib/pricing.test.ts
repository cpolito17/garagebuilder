import { describe, it, expect } from 'vitest';
import {
  priceAtMiles, milesAffordable, ceilingPrice, priceRange, plausibleMaxMiles,
} from './pricing';
import type { PriceCurve } from '../data/types';

const curve = (o: Partial<PriceCurve>): PriceCurve => ({
  base: 20000, baselineMiles: 80000, floor: 6000,
  decay: 0.08, lowMileCap: 1.6, spread: 0.1, ...o,
});

/** The calibration table in docs/DATA-MODEL.md section 3.2a. */
const CALIBRATION = [
  { name: 'Mazda MX-5 (NC)',        c: curve({ base: 13000, floor: 5000,  decay: 0.070, baselineMiles: 85000 }), at18k: 18000 },
  { name: 'Honda Civic Si (10th)',  c: curve({ base: 23500, floor: 8000,  decay: 0.080, baselineMiles: 55000 }), at18k: 108000 },
  { name: 'Mercedes-AMG E63 (W212)',c: curve({ base: 34000, floor: 9500,  decay: 0.175, baselineMiles: 60000 }), at18k: 115000 },
  { name: 'BMW M3 (E90)',           c: curve({ base: 33000, floor: 14000, decay: 0.090, baselineMiles: 75000 }), at18k: 240000 },
  { name: 'Toyota 4Runner (N280)',  c: curve({ base: 31000, floor: 11000, decay: 0.045, baselineMiles: 95000 }), at18k: 323000 },
];

describe('priceAtMiles', () => {
  it('returns base at baseline mileage', () => {
    const c = curve({});
    expect(priceAtMiles(c, c.baselineMiles)).toBeCloseTo(c.base, 6);
  });

  it('decreases monotonically with mileage', () => {
    const c = curve({});
    let prev = Infinity;
    for (let m = 0; m <= 300000; m += 10000) {
      const p = priceAtMiles(c, m);
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
  });

  it('asymptotes to floor and never goes below it', () => {
    const c = curve({});
    expect(priceAtMiles(c, 1_000_000)).toBeGreaterThan(c.floor);
    expect(priceAtMiles(c, 1_000_000)).toBeLessThan(c.floor + 10);
  });

  it('clamps at lowMileCap so a delivery-mileage example is not absurd', () => {
    const c = curve({ baselineMiles: 150000 });
    expect(priceAtMiles(c, 0)).toBeLessThanOrEqual(c.base * c.lowMileCap);
  });

  it('keeps the documented share of above-floor value per 80k miles', () => {
    // decay is "fraction of above-floor value lost per 10k miles"
    const c = curve({ decay: 0.19 });
    const atBaseline = priceAtMiles(c, c.baselineMiles) - c.floor;
    const at80kMore = priceAtMiles(c, c.baselineMiles + 80000) - c.floor;
    expect(at80kMore / atBaseline).toBeCloseTo(Math.pow(1 - 0.19, 8), 6);
  });
});

describe('milesAffordable', () => {
  it('is the exact inverse of priceAtMiles across the working range', () => {
    for (const { c } of CALIBRATION) {
      const lo = c.floor + 1;
      const hi = ceilingPrice(c) - 1;
      for (let i = 0; i <= 40; i++) {
        const budget = lo + ((hi - lo) * i) / 40;
        const m = milesAffordable(c, budget);
        expect(m).not.toBeNull();
        expect(priceAtMiles(c, m as number)).toBeCloseTo(budget, 6);
      }
    }
  });

  it('returns null when the budget is at or below the price floor', () => {
    const c = curve({ floor: 22000, base: 46000 });
    expect(milesAffordable(c, 18000)).toBeNull();
    expect(milesAffordable(c, 22000)).toBeNull();
    expect(milesAffordable(c, 22001)).not.toBeNull();
  });

  it('returns zero miles when the budget covers a delivery-mileage example', () => {
    const c = curve({});
    expect(milesAffordable(c, ceilingPrice(c))).toBe(0);
    expect(milesAffordable(c, ceilingPrice(c) * 2)).toBe(0);
  });

  it('never returns a negative odometer', () => {
    const c = curve({});
    for (let b = c.floor + 1; b < c.base * 3; b += 500) {
      const m = milesAffordable(c, b);
      if (m !== null) expect(m).toBeGreaterThanOrEqual(0);
    }
  });

  it('matches the documented calibration table at an $18,000 budget', () => {
    for (const { name, c, at18k } of CALIBRATION) {
      const m = milesAffordable(c, 18000);
      expect(m, name).not.toBeNull();
      // within 1000 miles of the documented figure
      expect(Math.abs((m as number) - at18k), name).toBeLessThan(1000);
    }
  });

  it('a lower decay buys more miles at the same budget', () => {
    const soft = curve({ decay: 0.04 });
    const hard = curve({ decay: 0.20 });
    const a = milesAffordable(soft, 12000) as number;
    const b = milesAffordable(hard, 12000) as number;
    expect(a).toBeGreaterThan(b);
  });
});

describe('plausibleMaxMiles', () => {
  it('scales with age and caps at 300k', () => {
    expect(plausibleMaxMiles(2023, 2026)).toBe(88_000);
    expect(plausibleMaxMiles(2014, 2026)).toBe(286_000);
    expect(plausibleMaxMiles(1994, 2026)).toBe(300_000);
  });

  it('clips an impossible odometer but allows a merely terrible one', () => {
    // The guard exists to reject odometers time does not permit, not to reject
    // bad buys. Those are different problems with different UI answers.
    const m3 = milesAffordable(CALIBRATION[3]!.c, 18000) as number;      // E90, 2008
    const runner = milesAffordable(CALIBRATION[4]!.c, 18000) as number;  // N280, 2010

    // A 2008 car can genuinely have covered 240k miles. It survives the guard
    // and is handled by the caution system instead.
    expect(m3).toBeGreaterThan(200_000);
    expect(m3).toBeLessThan(plausibleMaxMiles(2008));

    // 323k exceeds the hard 300k ceiling and must be rejected outright.
    expect(runner).toBeGreaterThan(plausibleMaxMiles(2010));
  });
});

describe('priceRange', () => {
  it('brackets the midpoint by the spread and rounds to $250', () => {
    const c = curve({ spread: 0.1 });
    const r = priceRange(c, c.baselineMiles);
    expect(r.mid).toBe(20000);
    expect(r.low).toBe(18000);
    expect(r.high).toBe(22000);
    expect(r.low % 250).toBe(0);
    expect(r.high % 250).toBe(0);
  });
});
