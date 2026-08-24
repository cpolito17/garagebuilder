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
import { encodeCatalog } from '../src/data/codec';
import type { Vehicle } from '../src/data/types';
import { groupA } from '../src/data/vehicles/group-a';
import { groupB } from '../src/data/vehicles/group-b';
import { groupC } from '../src/data/vehicles/group-c';
import { groupD } from '../src/data/vehicles/group-d';
import { groupE } from '../src/data/vehicles/group-e';
import { groupF } from '../src/data/vehicles/group-f';
import { groupG } from '../src/data/vehicles/group-g';
import { groupH } from '../src/data/vehicles/group-h';
import { groupI } from '../src/data/vehicles/group-i';
import { groupJ } from '../src/data/vehicles/group-j';
import { groupK } from '../src/data/vehicles/group-k';

const RAW = [...groupA, ...groupB, ...groupC, ...groupD, ...groupE, ...groupF, ...groupG, ...groupH, ...groupI, ...groupJ, ...groupK];

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
})) as unknown as Vehicle[];

// Columnar, dictionary-encoded. See src/data/codec.ts for why.
const encoded = encodeCatalog(slim);

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
writeFileSync('src/data/generated/catalog.slim.json', JSON.stringify(encoded));
writeFileSync('src/data/generated/details.json', JSON.stringify(details));

const plain = JSON.stringify(slim).length;
const packed = JSON.stringify(encoded).length;
console.log(
  `catalog: ${parsed.length} records -> slim ${(packed / 1024).toFixed(1)} kB ` +
    `(${(plain / 1024).toFixed(1)} kB unpacked, ${(100 - (packed / plain) * 100).toFixed(0)}% saved), ` +
    `details ${(JSON.stringify(details).length / 1024).toFixed(1)} kB`,
);
