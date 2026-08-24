import { describe, it, expect } from 'vitest';
import { CATALOG } from './catalog';
import { ROLES, type Role } from './types';
import { CURRENT_YEAR, milesAffordable, priceAtMiles, plausibleMaxMiles, ceilingPrice } from '../lib/pricing';

/** Sanity checks over the whole catalog. docs/DATA-MODEL.md section 8. */

describe('catalog integrity', () => {
  it('parses every record and only grows', () => {
    // A floor rather than an exact count, so authoring a new wave does not
    // fail the suite, but losing records still does.
    expect(CATALOG.length).toBeGreaterThanOrEqual(250);
  });

  it('has unique ids', () => {
    expect(new Set(CATALOG.map((v) => v.id)).size).toBe(CATALOG.length);
  });

  it('has no duplicate vehicles under different ids', () => {
    // Unique ids are not enough. Authoring a wave without re-reading the
    // previous one put the same eleven cars in twice under ids that differed
    // only in style, and only this check would have caught it.
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const v of CATALOG) {
      const key = `${v.make}|${v.model}|${v.years[0]}-${v.years[1]}`.toLowerCase();
      const prior = seen.get(key);
      if (prior) collisions.push(`${prior} and ${v.id} are both ${key}`);
      else seen.set(key, v.id);
    }
    expect(collisions).toEqual([]);
  });

  it('keeps floor below base on every record', () => {
    for (const v of CATALOG) {
      expect(v.pricing.floor, v.id).toBeLessThan(v.pricing.base);
    }
  });

  it('keeps decay inside the calibrated band on every record', () => {
    for (const v of CATALOG) {
      expect(v.pricing.decay, v.id).toBeGreaterThanOrEqual(0.02);
      expect(v.pricing.decay, v.id).toBeLessThanOrEqual(0.3);
    }
  });

  it('recovers baselineMiles from base price on every record', () => {
    for (const v of CATALOG) {
      const m = milesAffordable(v.pricing, v.pricing.base);
      expect(m, v.id).not.toBeNull();
      expect(m as number, v.id).toBeCloseTo(v.pricing.baselineMiles, 3);
    }
  });

  it('gives every record older than three years a usable mileage ceiling', () => {
    for (const v of CATALOG) {
      if (CURRENT_YEAR - v.years[0] <= 3) continue;
      expect(plausibleMaxMiles(v.years[0]), v.id).toBeGreaterThanOrEqual(40_000);
    }
  });

  it('requires msrpNew on every current vehicle', () => {
    for (const v of CATALOG.filter((x) => x.status === 'current')) {
      expect(v.pricing.msrpNew, v.id).toBeGreaterThan(0);
      expect(v.pricing.msrpNew, v.id).toBeGreaterThanOrEqual(v.pricing.base);
    }
  });

  it('prices every delivery-mileage current car exactly at MSRP', () => {
    for (const v of CATALOG.filter((x) => x.status === 'current')) {
      expect(ceilingPrice(v.pricing), v.id).toBe(v.pricing.msrpNew);
      expect(priceAtMiles(v.pricing, 0), v.id).toBe(v.pricing.msrpNew);
    }
  });

  it('never lets a documented issue onset exceed a plausible odometer', () => {
    for (const v of CATALOG) {
      const cap = plausibleMaxMiles(v.years[0]);
      for (const issue of v.knownIssues) {
        expect(issue.onsetMiles, `${v.id}: ${issue.text}`).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe('role coverage', () => {
  const byRole = (r: Role) => CATALOG.filter((v) => v.roles.includes(r));

  it('covers every role with enough vehicles to make a real choice', () => {
    // Twelve was the target set for the full catalog in DATA-MODEL section 8,
    // and every role clears it at 126 records.
    for (const r of ROLES) {
      expect(byRole(r).length, r).toBeGreaterThanOrEqual(12);
    }
  });

  it('spans at least three price tiers per role', () => {
    // Tier by the price of a typical example: under 12k, 12k to 30k, above 30k.
    for (const r of ROLES) {
      const tiers = new Set(
        byRole(r).map((v) => {
          const p = priceAtMiles(v.pricing, v.pricing.baselineMiles);
          return p < 12_000 ? 'low' : p <= 30_000 ? 'mid' : 'high';
        }),
      );
      expect(tiers.size, `${r} spans ${[...tiers].join(', ')}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('offers a manual transmission in every role that plausibly wants one', () => {
    for (const r of ['sports', 'track', 'project', 'commuter'] as Role[]) {
      const manuals = byRole(r).filter((v) => v.spec.transmissions.includes('manual'));
      expect(manuals.length, r).toBeGreaterThan(0);
    }
  });
});
