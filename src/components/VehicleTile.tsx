import { Car, CarProfile, Jeep, Truck, Van } from '@phosphor-icons/react';
import type { Vehicle } from '../data/types';

/**
 * Identity band. docs/DATA-MODEL.md section 7.
 *
 * Phase 1 shipped no photography: hundreds of hero images could not be produced yet, and
 * the type-led treatment has to exist for the share card regardless.
 *
 * An earlier version reserved a 16:10 image area and filled it with a glyph.
 * On a phone that was most of the screen for one card and read as a missing
 * image rather than a decision. This is a compact spec plate instead, which
 * is both honest about having no photograph and denser to read.
 *
 * The band is the top of the card whether or not a photograph follows it, so
 * it always carries the card's top corners. `withPhoto` only says whether the
 * glyph is still doing any work.
 */

const GLYPH: Record<string, typeof Car> = {
  coupe: CarProfile, sedan: Car, hatchback: Car, wagon: Car,
  convertible: CarProfile, targa: CarProfile,
  suv: Jeep, truck: Truck, van: Van,
};

export function VehicleTile({ vehicle, withPhoto = false }: { vehicle: Vehicle; withPhoto?: boolean }) {
  const Glyph = GLYPH[vehicle.bodyStyle] ?? Car;
  return (
    <div
      className="relative flex items-center gap-3 overflow-hidden bg-[--bg-shell] px-3 py-2.5"
      style={{ borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit' }}
    >
      <div className="min-w-0 flex-1">
        <div className="t-label text-[--text-tertiary]">{vehicle.make}</div>
        <div className="t-h3 truncate text-[--text-primary]">{vehicle.model}</div>
        <div className="num t-small text-[--text-secondary]">
          {vehicle.generation}, {vehicle.years[0]}
          {vehicle.status === 'current' ? ' to now' : `-${vehicle.years[1]}`}
        </div>
      </div>
      {/* The glyph stands in for a photograph. With a real one below it, it
          is decoration, and decoration is the thing this design does least. */}
      {!withPhoto && (
        <Glyph
          weight="regular"
          aria-hidden
          size={46}
          className="shrink-0 text-[--text-primary] opacity-[0.13]"
        />
      )}
    </div>
  );
}
