import { CATALOG } from '../data/catalog';
import { findMatches } from './matching';
import { MIN_SLOT, type GarageState } from '../state/garage';

/**
 * Re-solve the split across the fluid slots. docs/SPEC.md section 4.2.
 *
 * A plain greedy marginal allocation does not work here, and the reason is
 * worth recording: a slot's value function is not concave. An off-road slot
 * is worth nothing at all until it crosses the cheapest 4x4's price floor,
 * then jumps. Marginal-gain greedy sees zero gain from every step below that
 * cliff, never invests, and starves the slot permanently. Observed directly:
 * a four slot $55,000 garage funded sports and commuter to $20k and $28k and
 * left family and offroad at $3,282 and $2,836 with no matches at all.
 *
 * So: seat every slot at its entry price first, then distribute what is left
 * by gain per dollar over a lookahead window rather than a single step.
 */

const STEP = 500;
const LOOKAHEAD = 10; // up to $5,000 ahead, enough to clear most price cliffs

function scoreAt(state: GarageState, slotIndex: number, dollars: number): number {
  const slot = state.slots[slotIndex]!;
  const list = findMatches(CATALOG, {
    budget: dollars, role: slot.role, odometer: slot.odometer, filters: slot.filters,
  });
  const top = list.matches[0];
  if (!top) return 0;
  // A small bonus for depth of choice, so a slot with one marginal match does
  // not outrank one with real options.
  return top.score + Math.min(4, list.matches.length) * 0.02;
}

/**
 * Cheapest budget at which this slot has anything at all. Prices are fixed by
 * the slot's odometer, so match count is monotonic in budget: raising it can
 * only bring more cars under the line. A binary search is sound.
 */
function entryPrice(state: GarageState, slotIndex: number, cap: number): number | null {
  const slot = state.slots[slotIndex]!;
  const has = (d: number) =>
    findMatches(CATALOG, {
      budget: d, role: slot.role, odometer: slot.odometer, filters: slot.filters,
    }).matches.length > 0;

  if (!has(cap)) return null;
  let lo = MIN_SLOT;
  let hi = cap;
  if (has(lo)) return lo;
  while (hi - lo > STEP) {
    const mid = Math.round((lo + hi) / 2 / STEP) * STEP;
    if (mid <= lo || mid >= hi) break;
    if (has(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

export function autoAllocate(state: GarageState): GarageState {
  const fluidIdx = state.slots.map((s, i) => (s.pinned ? -1 : i)).filter((i) => i >= 0);
  if (fluidIdx.length === 0) return state;

  const pinnedTotal = state.slots.filter((s) => s.pinned).reduce((a, s) => a + s.target, 0);
  const pot = Math.max(fluidIdx.length * MIN_SLOT, state.budget - pinnedTotal);

  // Phase A. Seat each slot at its entry price, cheapest first, so a limited
  // pot funds as many working slots as it can rather than one luxurious one.
  const current = fluidIdx.map(() => MIN_SLOT);
  const entries = fluidIdx.map((i) => entryPrice(state, i, pot) ?? Infinity);
  const order = entries.map((e, k) => ({ k, e })).sort((a, b) => a.e - b.e);

  let spent = fluidIdx.length * MIN_SLOT;
  for (const { k, e } of order) {
    if (!Number.isFinite(e)) continue;
    const extra = e - current[k]!;
    if (extra <= 0 || spent + extra > pot) continue;
    current[k] = e;
    spent += extra;
  }

  // Phase B. Distribute the rest by gain per dollar across a lookahead window,
  // so a slot whose next improvement costs $3,000 can still win against one
  // whose next improvement costs $500.
  const scores = fluidIdx.map((i, k) => scoreAt(state, i, current[k]!));

  while (pot - spent >= STEP) {
    let best = { k: -1, chunk: STEP, rate: 0, score: 0 };
    const affordable = Math.floor((pot - spent) / STEP);

    for (let k = 0; k < fluidIdx.length; k++) {
      for (let w = 1; w <= Math.min(LOOKAHEAD, affordable); w++) {
        const chunk = w * STEP;
        const s = scoreAt(state, fluidIdx[k]!, current[k]! + chunk);
        const rate = (s - scores[k]!) / chunk;
        if (rate > best.rate) best = { k, chunk, rate, score: s };
      }
    }

    if (best.k < 0) break; // nothing improves anywhere, stop burning cycles
    current[best.k]! += best.chunk;
    scores[best.k] = best.score;
    spent += best.chunk;
  }

  // Place the sub-step remainder on the best-scoring slot so the books balance
  // to the dollar. Re-apportioning everything here would undo the solve: the
  // amounts above are a solution, not a set of weights.
  const leftover = pot - spent;
  if (leftover > 0) {
    let bestK = 0;
    for (let k = 1; k < scores.length; k++) if (scores[k]! > scores[bestK]!) bestK = k;
    current[bestK]! += leftover;
  }

  return {
    ...state,
    slots: state.slots.map((s, i) => {
      const k = fluidIdx.indexOf(i);
      return k < 0 ? s : { ...s, target: current[k]! };
    }),
  };
}
