import type { DataSource } from './types';

/** Catalog-level provenance. Individual observations were not retained by the original dataset. */
export const CATALOG_UPDATED_AT = '2026-08-24';

export const CATALOG_SOURCES: DataSource[] = [
  {
    fields: ['pricing'],
    label: 'Garage Challenge editorial US asking-price estimates',
    kind: 'editorial',
    note: 'Generation-level estimates; individual listing observations were not retained.',
  },
  {
    fields: ['spec.mpgCombined'],
    label: 'U.S. Department of Energy fuel-economy data',
    kind: 'public-dataset',
    url: 'https://www.fueleconomy.gov/feg/download.shtml',
    note: 'Reference dataset used for normalization; verify the exact year, trim, and powertrain.',
  },
  {
    fields: ['spec', 'ownership', 'knownIssues', 'notes'],
    label: 'Garage Challenge editorial research',
    kind: 'editorial',
    note: 'Generation-wide synthesis; original per-record citations were not retained.',
  },
];
