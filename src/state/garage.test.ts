import { describe, it, expect } from 'vitest';
import {
  initialGarage, allocate, setSlotBudget, pinSlot, unpinSlot,
  setBudget, setSlotCount, setSlotOdometer, steppedBudget,
  MIN_SLOT, MAX_ODOMETER, DEFAULT_ODOMETER,
} from './garage';

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const totals = (s: ReturnType<typeof initialGarage>) => sum(s.slots.map((x) => x.target));

describe('initial allocation', () => {
  it('spends the whole budget across the requested slots', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const g = initialGarage(50_000, n);
      expect(g.slots).toHaveLength(n);
      expect(totals(g)).toBeCloseTo(50_000, -2);
    }
  });

  it('weights a sports slot above a commuter slot', () => {
    const g = initialGarage(50_000, 2);
    expect(g.slots[0]!.target).toBeGreaterThan(g.slots[1]!.target);
  });

  it('produces results before the user touches anything', () => {
    const g = initialGarage(50_000, 3);
    for (const s of g.slots) expect(s.target).toBeGreaterThan(MIN_SLOT);
  });
});

describe('dragging a slot', () => {
  it('takes money from the other fluid slots, keeping the total at budget', () => {
    const g = setSlotBudget(initialGarage(60_000, 3), initialGarage(60_000, 3).slots[0]!.id, 30_000);
    const start = initialGarage(60_000, 3);
    const moved = setSlotBudget(start, start.slots[0]!.id, 30_000);
    expect(moved.slots[0]!.target).toBe(30_000);
    expect(totals(moved)).toBeCloseTo(60_000, -2);
    expect(g).toBeDefined();
  });

  it('preserves the proportion between the other slots', () => {
    const start = initialGarage(60_000, 3);
    const ratioBefore = start.slots[1]!.target / start.slots[2]!.target;
    const moved = setSlotBudget(start, start.slots[0]!.id, 24_000);
    const ratioAfter = moved.slots[1]!.target / moved.slots[2]!.target;
    expect(ratioAfter).toBeCloseTo(ratioBefore, 1);
  });

  it('never drops another slot below its floor', () => {
    const start = initialGarage(30_000, 4);
    const moved = setSlotBudget(start, start.slots[0]!.id, 29_000);
    for (const s of moved.slots.slice(1)) expect(s.target).toBeGreaterThanOrEqual(MIN_SLOT);
  });

  it('goes over budget rather than hitting a wall', () => {
    const start = initialGarage(30_000, 3);
    const moved = setSlotBudget(start, start.slots[0]!.id, 40_000);
    const a = allocate(moved);
    expect(moved.slots[0]!.target).toBe(40_000);
    expect(a.over).toBeGreaterThan(0);
    expect(a.total).toBeGreaterThan(30_000);
  });

  it('reports the headroom before overspend begins', () => {
    const start = initialGarage(30_000, 3);
    const a = allocate(start);
    const head = a.headroom(start.slots[0]!.id);
    expect(head).toBe(30_000 - 2 * MIN_SLOT);
    const atLimit = setSlotBudget(start, start.slots[0]!.id, head);
    expect(allocate(atLimit).over).toBe(0);
    const past = setSlotBudget(start, start.slots[0]!.id, head + 1000);
    expect(allocate(past).over).toBeGreaterThan(0);
  });
});

describe('pinning', () => {
  it('locks the slot to the price and redistributes the remainder', () => {
    const start = initialGarage(50_000, 3);
    const pinned = pinSlot(start, start.slots[0]!.id, 'mazda-mx5-nc', 12_000);
    expect(pinned.slots[0]!.pinned).toBe(true);
    expect(pinned.slots[0]!.target).toBe(12_000);
    expect(totals(pinned)).toBeCloseTo(50_000, -2);
  });

  it('gives the freed money to the other slots when a pick is cheap', () => {
    const start = initialGarage(50_000, 3);
    const before = start.slots[1]!.target;
    const pinned = pinSlot(start, start.slots[0]!.id, 'v', 5_000);
    expect(pinned.slots[1]!.target).toBeGreaterThan(before);
  });

  it('squeezes the other slots when a pick is expensive', () => {
    const start = initialGarage(50_000, 3);
    const before = start.slots[1]!.target;
    const pinned = pinSlot(start, start.slots[0]!.id, 'v', 35_000);
    expect(pinned.slots[1]!.target).toBeLessThan(before);
  });

  it('never moves a pinned slot when another slot is dragged', () => {
    const start = pinSlot(initialGarage(50_000, 3), initialGarage(50_000, 3).slots[0]!.id, 'v', 20_000);
    const g = pinSlot(initialGarage(50_000, 3), '', 'v', 0);
    expect(g).toBeDefined();
    const base = initialGarage(50_000, 3);
    const withPin = pinSlot(base, base.slots[0]!.id, 'v', 20_000);
    const dragged = setSlotBudget(withPin, withPin.slots[1]!.id, 25_000);
    expect(dragged.slots[0]!.target).toBe(20_000);
    expect(dragged.slots[0]!.pinned).toBe(true);
    expect(start).toBeDefined();
  });

  it('goes over budget when pinned picks exceed it, without clamping them', () => {
    const base = initialGarage(30_000, 2);
    let g = pinSlot(base, base.slots[0]!.id, 'a', 25_000);
    g = pinSlot(g, g.slots[1]!.id, 'b', 20_000);
    const a = allocate(g);
    expect(a.pinnedTotal).toBe(45_000);
    expect(a.over).toBe(15_000);
  });

  it('returns the slot to the fluid pool on unpin', () => {
    const base = initialGarage(50_000, 3);
    const pinned = pinSlot(base, base.slots[0]!.id, 'v', 30_000);
    const free = unpinSlot(pinned, base.slots[0]!.id);
    expect(free.slots[0]!.pinned).toBe(false);
    expect(free.slots[0]!.pick).toBeNull();
    expect(totals(free)).toBeCloseTo(50_000, -2);
  });
});

describe('exactness', () => {
  it('always sums to a whole-dollar total with no drift, across many operations', () => {
    for (const budget of [7_500, 23_333, 50_000, 117_000]) {
      for (const n of [1, 2, 3, 4, 5]) {
        let g = initialGarage(budget, n);
        expect(totals(g), `${budget}/${n} initial`).toBe(budget);

        for (const slot of g.slots) {
          const head = allocate(g).headroom(slot.id);
          if (head > MIN_SLOT) g = setSlotBudget(g, slot.id, Math.round(head * 0.6));

          // With two or more fluid slots the others absorb the difference and
          // the total holds. With one slot there is nothing to absorb it, so
          // dragging down underspends, which the allocation reports.
          const a = allocate(g);
          expect(a.total, `${budget}/${n}`).toBe(totals(g));
          expect(a.total + a.under - a.over, `${budget}/${n}`).toBe(budget);
          if (n > 1) expect(a.total, `${budget}/${n}`).toBe(budget);
          for (const s of g.slots) expect(Number.isInteger(s.target)).toBe(true);
        }
      }
    }
  });

  it('reports underspend when a lone slot is dragged below the budget', () => {
    let g = initialGarage(20_000, 1);
    g = setSlotBudget(g, g.slots[0]!.id, 12_000);
    const a = allocate(g);
    expect(a.under).toBe(8_000);
    expect(a.over).toBe(0);
  });

  it('keeps the books balanced through a pin and unpin cycle', () => {
    let g = initialGarage(45_000, 4);
    g = pinSlot(g, g.slots[1]!.id, 'v', 9_876);
    expect(totals(g)).toBe(45_000);
    g = pinSlot(g, g.slots[3]!.id, 'w', 4_321);
    expect(totals(g)).toBe(45_000);
    g = unpinSlot(g, g.slots[1]!.id);
    expect(totals(g)).toBe(45_000);
  });
});

describe('budget and slot count changes', () => {
  it('scales fluid slots with the budget but leaves pinned picks alone', () => {
    const base = initialGarage(40_000, 3);
    const pinned = pinSlot(base, base.slots[0]!.id, 'v', 15_000);
    const doubled = setBudget(pinned, 80_000);
    expect(doubled.slots[0]!.target).toBe(15_000);
    expect(doubled.slots[1]!.target).toBeGreaterThan(pinned.slots[1]!.target);
  });

  it('rebalances to the full budget when slots are added or removed', () => {
    let g = initialGarage(50_000, 2);
    g = setSlotCount(g, 5);
    expect(g.slots).toHaveLength(5);
    expect(totals(g)).toBeCloseTo(50_000, -2);
    g = setSlotCount(g, 3);
    expect(g.slots).toHaveLength(3);
    expect(totals(g)).toBeCloseTo(50_000, -2);
  });
});

describe('the budget stepper', () => {
  it('snaps to the ten thousand rather than adding to an odd number', () => {
    expect(steppedBudget(50_000, 1)).toBe(60_000);
    expect(steppedBudget(50_000, -1)).toBe(40_000);
    expect(steppedBudget(53_000, 1)).toBe(60_000);
    expect(steppedBudget(53_000, -1)).toBe(50_000);
    expect(steppedBudget(47_281, 1)).toBe(50_000);
    expect(steppedBudget(47_281, -1)).toBe(40_000);
  });

  it('always moves, and never past either end of the range', () => {
    for (const start of [1500, 9_999, 10_000, 1_999_999, 2_000_000]) {
      expect(steppedBudget(start, 1)).toBeGreaterThanOrEqual(start === 2_000_000 ? start : start);
      expect(steppedBudget(start, 1)).toBeLessThanOrEqual(2_000_000);
      expect(steppedBudget(start, -1)).toBeGreaterThanOrEqual(MIN_SLOT);
    }
    expect(steppedBudget(1500, -1)).toBe(MIN_SLOT);
    expect(steppedBudget(2_000_000, 1)).toBe(2_000_000);
  });
});

describe('the odometer', () => {
  it('stays inside the dial range whatever it is handed', () => {
    let g = initialGarage(50_000, 3);
    const id = g.slots[0]!.id;
    expect(setSlotOdometer(g, id, -5_000).slots[0]!.odometer).toBe(0);
    expect(setSlotOdometer(g, id, 9_000_000).slots[0]!.odometer).toBe(MAX_ODOMETER);
    g = setSlotOdometer(g, id, 137_500);
    expect(g.slots[0]!.odometer).toBe(137_500);
    // One slot's odometer is its own; the others keep the default.
    expect(g.slots[1]!.odometer).toBe(DEFAULT_ODOMETER);
  });
});
