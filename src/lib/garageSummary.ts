import type { Vehicle } from '../data/types';

/**
 * Evaluate the garage as a set. docs/SPEC.md section 4.7.
 *
 * This is the part no other tool does, and it is where the tool must be least
 * clever: state the facts. No score, no grade, no verdict.
 */

export type Capability = {
  id: string;
  label: string;
  /** Which picks satisfy it, by vehicle id. */
  satisfiedBy: string[];
};

export type Overlap = {
  a: Vehicle;
  b: Vehicle;
  /** What makes them the same answer to the same question. */
  shared: string;
};

export type GarageSummary = {
  capabilities: Capability[];
  gaps: Capability[];
  overlaps: Overlap[];
  annualMaintenanceUsd: number;
  annualFuelUsd: number;
  combinedHorsepower: number;
  pedals: number;
  countries: number;
};

const PETROL_PER_GALLON = 3.4;
const ELECTRIC_PER_KWH = 0.17;
const MILES_PER_YEAR = 12_000;

const CAPABILITIES: { id: string; label: string; test: (v: Vehicle) => boolean }[] = [
  { id: 'four-up', label: 'Carry four people', test: (v) => v.spec.seats >= 4 },
  { id: 'six-up', label: 'Carry six or more', test: (v) => v.spec.seats >= 6 },
  { id: 'tow', label: 'Tow 5,000 lb', test: (v) => (v.spec.towingLb ?? 0) >= 5000 },
  { id: 'snow', label: 'Handle snow', test: (v) => v.spec.drivetrain === 'AWD' || v.spec.drivetrain === '4WD' },
  { id: 'unpaved', label: 'Handle unpaved roads', test: (v) => (v.spec.groundClearanceIn ?? 0) >= 7.5 },
  { id: 'cargo', label: 'Carry bulky cargo', test: (v) => (v.spec.cargoCuFt ?? 0) >= 30 },
  { id: 'cheap-miles', label: 'Cover miles cheaply', test: (v) => v.spec.mpgCombined >= 30 },
];

/** Country of origin, for the diversity observation. Marque, not build plant. */
const ORIGIN: Record<string, string> = {
  Mazda: 'JP', Toyota: 'JP', Honda: 'JP', Nissan: 'JP', Subaru: 'JP', Lexus: 'JP',
  BMW: 'DE', 'Mercedes-AMG': 'DE', Volkswagen: 'DE', Audi: 'DE', Porsche: 'DE',
  Ford: 'US', Chevrolet: 'US', Chrysler: 'US', Ram: 'US', Jeep: 'US', Tesla: 'US',
  Volvo: 'SE', Lotus: 'GB',
};

export function summarise(picks: Vehicle[]): GarageSummary {
  const capabilities: Capability[] = [];
  const gaps: Capability[] = [];

  for (const c of CAPABILITIES) {
    const satisfiedBy = picks.filter(c.test).map((v) => v.id);
    const entry = { id: c.id, label: c.label, satisfiedBy };
    (satisfiedBy.length > 0 ? capabilities : gaps).push(entry);
  }

  // Two picks are the same answer when body, drivetrain and seat count agree.
  const overlaps: Overlap[] = [];
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      const a = picks[i]!;
      const b = picks[j]!;
      if (
        a.bodyStyle === b.bodyStyle &&
        a.spec.drivetrain === b.spec.drivetrain &&
        Math.abs(a.spec.seats - b.spec.seats) <= 1
      ) {
        overlaps.push({ a, b, shared: `${a.spec.drivetrain} ${a.bodyStyle}, ${a.spec.seats} seats` });
      }
    }
  }

  const annualFuelUsd = Math.round(
    picks.reduce((sum, v) => {
      if (v.spec.fuel === 'ev') {
        // MPGe converts back to kWh via the EPA's 33.7 kWh per gallon equivalent.
        const kwh = (MILES_PER_YEAR / v.spec.mpgCombined) * 33.7;
        return sum + kwh * ELECTRIC_PER_KWH;
      }
      return sum + (MILES_PER_YEAR / v.spec.mpgCombined) * PETROL_PER_GALLON;
    }, 0),
  );

  return {
    capabilities,
    gaps,
    overlaps,
    annualMaintenanceUsd: picks.reduce((a, v) => a + v.ownership.annualMaintenanceUsd, 0),
    annualFuelUsd,
    combinedHorsepower: picks.reduce((a, v) => a + v.spec.horsepower, 0),
    pedals: picks.reduce((a, v) => a + (v.spec.transmissions.includes('manual') ? 3 : 2), 0),
    countries: new Set(picks.map((v) => ORIGIN[v.make] ?? v.make)).size,
  };
}
