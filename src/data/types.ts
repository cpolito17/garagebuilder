/**
 * Runtime types and constants for the catalog.
 *
 * Deliberately free of Zod. Validation belongs at build time, in
 * scripts/build-catalog.ts, so the schema library never reaches the client.
 * The app consumes catalog JSON that has already been proved correct.
 */

export const ROLES = [
  'sports', 'commuter', 'family', 'offroad', 'tow',
  'winter', 'grand-tourer', 'cargo', 'track', 'project',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  sports: 'Sports car',
  commuter: 'Commuter',
  family: 'Family hauler',
  offroad: 'Off-roader',
  tow: 'Tow rig',
  winter: 'Winter car',
  'grand-tourer': 'Grand tourer',
  cargo: 'Cargo hauler',
  track: 'Track car',
  project: 'Project car',
};

/** First allocation weights. Produce a sane first screen, nothing more. */
export const ROLE_WEIGHT: Record<Role, number> = {
  sports: 1.3, track: 1.3, 'grand-tourer': 1.3,
  family: 1.2, tow: 1.2, offroad: 1.2,
  cargo: 1.0,
  commuter: 0.8,
  winter: 0.5, project: 0.5,
};

export type Severity = 'annoyance' | 'expensive' | 'car-ending';

export type Issue = {
  text: string;
  onsetMiles: number;
  typicalCostUsd: number;
  severity: Severity;
};

export type PriceCurve = {
  base: number;
  baselineMiles: number;
  floor: number;
  decay: number;
  lowMileCap: number;
  spread: number;
  msrpNew?: number;
};

export type VehicleSpec = {
  seats: number;
  doors: number;
  drivetrain: 'FWD' | 'RWD' | 'AWD' | '4WD';
  transmissions: ('manual' | 'automatic' | 'dct' | 'cvt' | 'single-speed')[];
  cylinders: number;
  displacementL: number;
  aspiration: 'na' | 'turbo' | 'supercharged' | 'hybrid' | 'electric';
  horsepower: number;
  torqueLbFt: number;
  curbWeightLb: number;
  fuel: 'gas' | 'diesel' | 'hybrid' | 'phev' | 'ev';
  mpgCombined: number;
  towingLb: number | null;
  cargoCuFt: number | null;
  groundClearanceIn: number | null;
};

export type Ownership = {
  reliabilityIndex: number;
  insuranceIndex: number;
  partsAvailability: number;
  annualMaintenanceUsd: number;
  diyFriendliness: number;
};

export type BodyStyle =
  | 'coupe' | 'sedan' | 'hatchback' | 'wagon' | 'convertible'
  | 'suv' | 'truck' | 'van' | 'targa';

/** What matching and card rendering need. Shipped eagerly. */
export type Vehicle = {
  id: string;
  make: string;
  model: string;
  generation: string;
  years: [number, number];
  status: 'current' | 'discontinued';
  roles: Role[];
  bodyStyle: BodyStyle;
  spec: VehicleSpec;
  pricing: PriceCurve;
  ownership: Ownership;
  knownIssues: Issue[];
};

/** Prose only the detail view needs. Loaded on demand. */
export type VehicleDetails = {
  summary: string;
  whatToLookFor: string[];
};
