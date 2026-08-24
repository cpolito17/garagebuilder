/**
 * Catalog codegen. docs/DESIGN.md section 10.
 *
 * Splits the authored records into two artefacts:
 *   catalog.slim.json  everything matching and card rendering need
 *   details.json       prose only the detail view needs, loaded on demand
 *
 * Authoring stays in one place per record. Shipping 60 full records put
 * 35.65 kB gzipped in the critical path to render twelve cards, and 250
 * records would put roughly 150 kB there.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { vehicleSchema, type AuthoredVehicle } from '../src/data/schema';
import { groupA } from '../src/data/vehicles/group-a';
import { groupB } from '../src/data/vehicles/group-b';
import { groupC } from '../src/data/vehicles/group-c';
import { groupD } from '../src/data/vehicles/group-d';
import { groupE } from '../src/data/vehicles/group-e';
import { groupF } from '../src/data/vehicles/group-f';

const RAW = [...groupA, ...groupB, ...groupC, ...groupD, ...groupE, ...groupF];

const seen = new Set<string>();
const parsed: AuthoredVehicle[] = RAW.map((record, i) => {
  const r = vehicleSchema.safeParse(record);
  if (!r.success) {
    const id = (record as { id?: string })?.id ?? `index ${i}`;
    throw new Error(
      `Catalog record "${id}" is invalid:\n` +
        r.error.issues.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n'),
    );
  }
  if (seen.has(r.data.id)) throw new Error(`Duplicate catalog id: ${r.data.id}`);
  seen.add(r.data.id);
  return r.data;
});

const slim = parsed.map((v) => ({
  id: v.id, make: v.make, model: v.model, generation: v.generation,
  years: v.years, status: v.status, roles: v.roles, bodyStyle: v.bodyStyle,
  spec: v.spec, pricing: v.pricing, ownership: v.ownership,
  // Cautions render on the card, so they stay in the critical path.
  knownIssues: v.notes.knownIssues,
}));

const details = Object.fromEntries(
  parsed.map((v) => [
    v.id,
    {
      summary: v.notes.summary,
      whatToLookFor: v.notes.whatToLookFor,
      ...(v.notes.packages?.length ? { packages: v.notes.packages } : {}),
      ...(v.notes.milestoneServices?.length ? { milestoneServices: v.notes.milestoneServices } : {}),
    },
  ]),
);

mkdirSync('src/data/generated', { recursive: true });
writeFileSync('src/data/generated/catalog.slim.json', JSON.stringify(slim));
writeFileSync('src/data/generated/details.json', JSON.stringify(details));

console.log(
  `catalog: ${parsed.length} records -> slim ${(JSON.stringify(slim).length / 1024).toFixed(1)} kB, ` +
    `details ${(JSON.stringify(details).length / 1024).toFixed(1)} kB`,
);
