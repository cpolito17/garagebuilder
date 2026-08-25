import { describe, it, expect } from 'vitest';
import { autoAllocate } from './autoAllocate';
import { initialGarage, allocate, pinSlot, MIN_SLOT } from '../state/garage';
import { CATALOG } from '../data/catalog';
import { findMatches } from './matching';

const totals = (s: ReturnType<typeof initialGarage>) => s.slots.reduce((a, x) => a + x.target, 0);

describe('auto-allocate', () => {
  it('spends the whole budget to the dollar', () => {
    for (const [budget, n] of [[30_000, 3], [60_000, 4], [18_000, 2]] as const) {
      const g = autoAllocate(initialGarage(budget, n));
      expect(totals(g), `${budget}/${n}`).toBe(budget);
    }
  });

  it('leaves pinned slots untouched and only redistributes the rest', () => {
    const base = initialGarage(60_000, 4);
    const pinned = pinSlot(base, base.slots[0]!.id, 'mazda-mx5-nc', 14_000);
    const solved = autoAllocate(pinned);
    expect(solved.slots[0]!.target).toBe(14_000);
    expect(totals(solved)).toBe(60_000);
  });

  it('gives every slot at least one match when the budget allows it', () => {
    const g = autoAllocate(initialGarage(70_000, 4));
    for (const s of g.slots) {
      const list = findMatches(CATALOG, {
        budget: s.target, role: s.role, odometer: s.odometer, filters: s.filters,
      });
      expect(list.matches.length, `${s.role} at ${s.target}`).toBeGreaterThan(0);
    }
  });

  it('beats the naive weight split on total pick quality', () => {
    const naive = initialGarage(55_000, 4);
    const solved = autoAllocate(naive);
    const quality = (g: typeof naive) =>
      g.slots.reduce((a, s) => {
        const top = findMatches(CATALOG, {
          budget: s.target, role: s.role, odometer: s.odometer, filters: s.filters,
        }).matches[0];
        return a + (top?.score ?? 0);
      }, 0);
    expect(quality(solved)).toBeGreaterThanOrEqual(quality(naive));
  });

  it('never drops a slot below its floor', () => {
    const g = autoAllocate(initialGarage(9_000, 5));
    for (const s of g.slots) expect(s.target).toBeGreaterThanOrEqual(MIN_SLOT);
    expect(allocate(g).total).toBe(9_000);
  });

  it('completes fast enough to be an interactive control', () => {
    const t0 = performance.now();
    autoAllocate(initialGarage(80_000, 5));
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
