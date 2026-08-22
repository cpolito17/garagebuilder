import type { PriceCurve } from '../data/types';

/**
 * The price model. Source of truth: docs/DATA-MODEL.md section 3.
 *
 * One equation drives the whole application, and its inversion is the
 * mechanic the product is built on: a slot does not ask which cars cost
 * under a budget, it asks what odometer each car requires at that budget.
 */

export const CURRENT_YEAR = 2026;

/** Highest odometer a vehicle could plausibly have covered given its age. */
export function plausibleMaxMiles(firstYear: number, currentYear = CURRENT_YEAR): number {
  return Math.min(300_000, (currentYear - firstYear + 1) * 22_000);
}

/**
 * Lowest odometer a vehicle could plausibly show, from the newest model year
 * of its generation. The mirror of plausibleMaxMiles, and just as necessary:
 * without it the curve happily offers a 1990 Miata at delivery mileage, which
 * is not a bargain, it is a car that does not exist.
 *
 * 1,500 miles a year is a cherished, garage-kept, second-car life. Anything
 * below that is a museum piece and not what this tool is for.
 */
export function plausibleMinMiles(lastYear: number, currentYear = CURRENT_YEAR): number {
  return Math.max(0, (currentYear - lastYear) * 1_500);
}

/**
 * price(m) = floor + (base - floor) * (1 - decay) ^ ((m - baselineMiles) / 10000)
 *
 * Asymptotes to `floor` rather than going negative, so a 240,000 mile Civic
 * is worth something. Clamped above by base * lowMileCap so extrapolating
 * backwards to delivery mileage cannot produce an absurd garage-queen price.
 */
export function priceAtMiles(c: PriceCurve, miles: number): number {
  const raw =
    c.floor + (c.base - c.floor) * Math.pow(1 - c.decay, (miles - c.baselineMiles) / 10_000);
  return Math.min(raw, c.base * c.lowMileCap);
}

/** The most this vehicle costs at any odometer, which is its price at delivery. */
export function ceilingPrice(c: PriceCurve): number {
  return priceAtMiles(c, 0);
}

/**
 * The inversion.
 *
 * Returns the odometer this budget buys, or null when the budget sits below
 * the vehicle's price floor, meaning no odometer brings it into reach.
 * Returns 0 when the budget covers a delivery-mileage example.
 */
export function milesAffordable(c: PriceCurve, budget: number): number | null {
  if (budget <= c.floor) return null;
  if (budget >= ceilingPrice(c)) return 0;

  const raw =
    c.baselineMiles +
    (10_000 * Math.log((budget - c.floor) / (c.base - c.floor))) / Math.log(1 - c.decay);

  return Math.max(0, raw);
}

export type PriceBand = { low: number; mid: number; high: number };

/** Never display a single-point price. The range is honest and it reads better. */
export function priceRange(c: PriceCurve, miles: number): PriceBand {
  const mid = priceAtMiles(c, miles);
  return {
    low: roundTo(mid * (1 - c.spread), 250),
    mid: roundTo(mid, 250),
    high: roundTo(mid * (1 + c.spread), 250),
  };
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** Odometers read better rounded than precise. 107,560 is false precision. */
export function formatMiles(n: number): string {
  if (n < 1000) return '0 mi';
  return `${roundTo(n, 1000).toLocaleString('en-US')} mi`;
}
