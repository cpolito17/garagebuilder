import type { Vehicle, VehicleDetails } from './types';
import slim from './generated/catalog.slim.json';

/**
 * Wave 1 catalog. US market, model years 1990 to current, new and used.
 *
 * Prices are hand-authored estimates of clean-example asking prices. They are
 * not listings and not quotes. See docs/DATA-MODEL.md sections 3 and 6.
 *
 * Records are authored in ./vehicles and validated against the Zod schema by
 * scripts/build-catalog.ts, which emits the JSON imported here. A record that
 * fails validation fails the build, and the schema library never ships.
 */

export const PRICES_AS_OF = 'August 2026';

export const CATALOG = slim as unknown as Vehicle[];

export const byId = new Map(CATALOG.map((v) => [v.id, v]));

/** Prose for the detail view. Loaded on demand, not in the critical path. */
let detailsCache: Record<string, VehicleDetails> | null = null;
export async function loadDetails(id: string): Promise<VehicleDetails | undefined> {
  if (!detailsCache) {
    detailsCache = (await import('./generated/details.json')).default as Record<string, VehicleDetails>;
  }
  return detailsCache[id];
}
