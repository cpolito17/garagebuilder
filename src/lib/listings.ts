import type { Vehicle } from '../data/types';
import type { PriceBand } from './pricing';

/**
 * Outbound search links. docs/SPEC.md section 9.
 *
 * The app has no listings and never will, but constructing a search URL from
 * data we already hold costs nothing and is the obvious next thing a user
 * wants. AutoTempest aggregates the major US sites, so one link covers more
 * ground than several.
 */
export function listingSearchUrl(v: Vehicle, band: PriceBand): string {
  const params = new URLSearchParams({
    make: v.make.toLowerCase().replace(/[^a-z0-9]/g, ''),
    model: v.model.toLowerCase().replace(/[^a-z0-9]/g, ''),
    minyear: String(v.years[0]),
    maxyear: String(v.years[1]),
    maxprice: String(Math.round(band.high)),
    zip: '',
  });
  return `https://www.autotempest.com/results?${params.toString()}`;
}
