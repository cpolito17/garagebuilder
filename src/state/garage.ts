import { ROLE_WEIGHT, type Role } from '../data/types';
import { DEFAULT_FILTERS, ROLE_PRESETS, type Filters } from '../lib/matching';
import { MAX_ODOMETER } from '../lib/pricing';

export { MAX_ODOMETER, ODOMETER_STEP } from '../lib/pricing';

/**
 * Garage state and the allocation model. docs/SPEC.md section 4.2.
 *
 * Allocation is an output that can be overridden, not an input that must be
 * supplied. Roles produce a first allocation immediately so results appear
 * before the user touches a control.
 *
 * Every slot stores an absolute dollar target rather than a percentage. That
 * is what lets the total exceed the budget: a slider that silently refuses to
 * move reads as broken, one that lets you go over and tells you reads as a
 * tool.
 */

export const MIN_SLOT = 1500;
export const MAX_BUDGET = 2_000_000;
/**
 * The budget moves in ten thousand dollar steps, which is the granularity the
 * question is actually asked at. Steps snap to the multiple rather than adding
 * to whatever is there, so a garage nudged to $53,000 by a locked car steps up
 * to $60,000 and not $63,000.
 */
export const BUDGET_STEP = 10_000;

export function steppedBudget(current: number, direction: 1 | -1): number {
  const snapped = direction > 0
    ? Math.floor(current / BUDGET_STEP) * BUDGET_STEP + BUDGET_STEP
    : Math.ceil(current / BUDGET_STEP) * BUDGET_STEP - BUDGET_STEP;
  return Math.min(MAX_BUDGET, Math.max(MIN_SLOT, snapped));
}
export const MAX_SLOTS = 5;
/**
 * The odometer every slot starts at. A hundred thousand miles is what most
 * people picture when they picture a used car, and it leaves the dial room to
 * wind in both directions.
 */
export const DEFAULT_ODOMETER = 100_000;

export type SlotState = {
  id: string;
  role: Role | null;
  target: number;          // dollars allocated to this slot
  pinned: boolean;         // a starred pick locks the slot to its price
  pick: string | null;     // vehicle id
  /** One odometer for the whole slot. Every result is priced at it. */
  odometer: number;
  filters: Filters;
};

export type GarageState = {
  budget: number;
  slots: SlotState[];
};

/**
 * Split `amount` across `weights` in whole dollars, guaranteeing every share
 * clears `floor` and the shares sum to exactly `amount`.
 *
 * Naive per-slot rounding drifts (five slots drifted the total by $371) and a
 * naive Math.max floor breaks the sum outright. Seat the floor first, then
 * apportion the surplus by largest remainder.
 */
export function distributeExact(amount: number, weights: number[], floor: number): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const surplus = Math.max(0, Math.round(amount) - n * floor);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((w) => (weightSum > 0 ? (w / weightSum) * surplus : surplus / n));

  const whole = shares.map(Math.floor);
  const order = shares
    .map((sh, i) => ({ i, frac: sh - Math.floor(sh) }))
    .sort((a, b) => b.frac - a.frac);

  let leftover = surplus - whole.reduce((a, b) => a + b, 0);
  for (let k = 0; leftover > 0 && k < n; k++, leftover--) whole[order[k]!.i]! += 1;

  return whole.map((v) => v + floor);
}

let seq = 0;
const nextId = () => `slot-${++seq}`;

export function makeSlot(role: Role | null, target: number): SlotState {
  return {
    id: nextId(),
    role,
    target,
    pinned: false,
    pick: null,
    odometer: DEFAULT_ODOMETER,
    filters: { ...DEFAULT_FILTERS, ...(role ? ROLE_PRESETS[role] ?? {} : {}) },
  };
}

const STARTER_ROLES: Role[] = ['sports', 'commuter', 'family', 'offroad', 'winter'];

/** Weight-based first allocation. Exists to produce a sane first screen. */
export function initialGarage(budget: number, count: number): GarageState {
  const roles = STARTER_ROLES.slice(0, count);
  const shares = distributeExact(budget, roles.map((r) => ROLE_WEIGHT[r]), MIN_SLOT);
  return { budget, slots: roles.map((r, i) => makeSlot(r, shares[i]!)) };
}

// ---------------------------------------------------------------- derived

export type Allocation = {
  perSlot: Map<string, number>;
  total: number;
  /** Dollars above budget, zero when within. */
  over: number;
  /**
   * Dollars left unspent. Reachable by dragging a slot down when no other
   * fluid slot can absorb the difference, which is a real choice and not an
   * error: spending less than the budget is allowed.
   */
  under: number;
  pinnedTotal: number;
  /** The most this slot can take before the others hit their floor. */
  headroom: (slotId: string) => number;
};

export function allocate(state: GarageState): Allocation {
  const perSlot = new Map(state.slots.map((s) => [s.id, Math.max(0, s.target)]));
  const total = [...perSlot.values()].reduce((a, b) => a + b, 0);
  const pinnedTotal = state.slots
    .filter((s) => s.pinned)
    .reduce((a, s) => a + (perSlot.get(s.id) ?? 0), 0);

  const headroom = (slotId: string) => {
    const otherFluid = state.slots.filter((s) => s.id !== slotId && !s.pinned);
    return state.budget - pinnedTotal - otherFluid.length * MIN_SLOT;
  };

  return {
    perSlot,
    total,
    over: Math.max(0, total - state.budget),
    under: Math.max(0, state.budget - total),
    pinnedTotal,
    headroom,
  };
}

// ---------------------------------------------------------------- actions

/**
 * Move money into one slot and rescale the other fluid slots to fit what is
 * left. Pinned slots never move. When the others reach their floor the total
 * goes over budget rather than the drag hitting a wall.
 */
export function setSlotBudget(state: GarageState, slotId: string, dollars: number): GarageState {
  const target = state.slots.find((s) => s.id === slotId);
  if (!target || target.pinned) return state;

  const pinnedTotal = state.slots
    .filter((s) => s.pinned)
    .reduce((a, s) => a + s.target, 0);

  const others = state.slots.filter((s) => s.id !== slotId && !s.pinned);
  const desired = Math.max(MIN_SLOT, Math.round(dollars));
  const forOthers = state.budget - pinnedTotal - desired;
  const othersFloor = others.length * MIN_SLOT;

  // Past the point where the others sit on their floor, the drag overspends
  // rather than hitting a wall.
  const pot = Math.max(othersFloor, forOthers);
  const shares = distributeExact(pot, others.map((s) => s.target), MIN_SLOT);
  const scaled = new Map(others.map((s, i) => [s.id, shares[i]!]));

  return {
    ...state,
    slots: state.slots.map((s) => {
      if (s.id === slotId) return { ...s, target: desired };
      const v = scaled.get(s.id);
      return v === undefined ? s : { ...s, target: Math.round(v) };
    }),
  };
}

/** Star a car: the slot pins to its price and the remainder redistributes. */
export function pinSlot(state: GarageState, slotId: string, vehicleId: string, spend: number): GarageState {
  const pinned: GarageState = {
    ...state,
    slots: state.slots.map((s) =>
      s.id === slotId ? { ...s, pinned: true, pick: vehicleId, target: Math.round(spend) } : s,
    ),
  };
  return redistribute(pinned, slotId);
}

export function unpinSlot(state: GarageState, slotId: string): GarageState {
  const unpinned: GarageState = {
    ...state,
    slots: state.slots.map((s) => (s.id === slotId ? { ...s, pinned: false, pick: null } : s)),
  };
  return redistribute(unpinned, null);
}

/** Share whatever is left across the fluid slots, keeping their proportions. */
function redistribute(state: GarageState, exceptId: string | null): GarageState {
  const pinnedTotal = state.slots.filter((s) => s.pinned).reduce((a, s) => a + s.target, 0);
  const fluid = state.slots.filter((s) => !s.pinned && s.id !== exceptId);
  if (fluid.length === 0) return state;

  const remainder = Math.max(fluid.length * MIN_SLOT, state.budget - pinnedTotal);
  const shares = distributeExact(remainder, fluid.map((s) => s.target), MIN_SLOT);
  const byId = new Map(fluid.map((s, i) => [s.id, shares[i]!]));

  return {
    ...state,
    slots: state.slots.map((s) => {
      const v = byId.get(s.id);
      return v === undefined ? s : { ...s, target: v };
    }),
  };
}

export function setBudget(state: GarageState, budget: number): GarageState {
  return redistribute({ ...state, budget }, null);
}

export function setSlotCount(state: GarageState, count: number): GarageState {
  if (count === state.slots.length) return state;
  if (count < state.slots.length) {
    return redistribute({ ...state, slots: state.slots.slice(0, count) }, null);
  }
  const used = new Set(state.slots.map((s) => s.role));
  const additions: SlotState[] = [];
  for (let i = state.slots.length; i < count; i++) {
    const role = STARTER_ROLES.find((r) => !used.has(r)) ?? null;
    if (role) used.add(role);
    additions.push(makeSlot(role, MIN_SLOT));
  }
  return redistribute({ ...state, slots: [...state.slots, ...additions] }, null);
}

export function setSlotRole(state: GarageState, slotId: string, role: Role | null): GarageState {
  return {
    ...state,
    slots: state.slots.map((s) =>
      s.id === slotId
        ? { ...s, role, pinned: false, pick: null, filters: { ...DEFAULT_FILTERS, ...(role ? ROLE_PRESETS[role] ?? {} : {}) } }
        : s,
    ),
  };
}

export function setSlotOdometer(state: GarageState, slotId: string, odometer: number): GarageState {
  const clamped = Math.min(MAX_ODOMETER, Math.max(0, Math.round(odometer)));
  return { ...state, slots: state.slots.map((s) => (s.id === slotId ? { ...s, odometer: clamped } : s)) };
}

export function setSlotFilters(state: GarageState, slotId: string, filters: Filters): GarageState {
  return { ...state, slots: state.slots.map((s) => (s.id === slotId ? { ...s, filters } : s)) };
}
