/**
 * Replace photographs a reviewer rejected.
 *
 *   npm run images:reject                 replace everything listed
 *   npm run images:reject -- --dry-run    report only, change nothing
 *
 * Reads scripts/image-rejects.txt, records each rejected photograph in
 * scripts/image-exclusions.json so it can never be picked again, then re-fetches
 * the affected vehicles so Commons chooses different photographs from what is
 * left. Needs network access.
 *
 * Exclusions rather than hand-replacement is the whole point. A photograph
 * swapped by hand keeps the previous photographer's name, licence and source
 * page in the manifest, which turns the credits page into a false statement
 * about someone else's work. Re-fetching keeps every credit true.
 *
 * Parsing and merging live in scripts/lib/rejects.ts and are unit tested.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { ImageManifest } from '../src/data/images';
import { resolveRejects, mergeExclusions, normaliseTitle, titleFromSourceUrl } from './lib/rejects';

const REJECTS = 'scripts/image-rejects.txt';
const EXCLUSIONS = 'scripts/image-exclusions.json';
const MANIFEST = 'src/data/generated/images.json';

const dryRun = process.argv.slice(2).includes('--dry-run');

function readManifest(): ImageManifest {
  if (!existsSync(MANIFEST)) return {};
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as ImageManifest;
}

function main() {
  if (!existsSync(REJECTS)) {
    console.error(`${REJECTS} does not exist. Nothing to do.`);
    process.exit(1);
  }

  const manifest = readManifest();
  if (Object.keys(manifest).length === 0) {
    console.error(`${MANIFEST} has no photographs in it. Run "npm run images" first.`);
    process.exit(1);
  }

  const lines = readFileSync(REJECTS, 'utf8').split(/\r?\n/);
  const { rejections, unresolved } = resolveRejects(lines, manifest);

  for (const { line, reason } of unresolved) {
    console.log(`  ? "${line}" — ${reason}`);
  }

  if (rejections.length === 0) {
    console.log(unresolved.length > 0
      ? `\nNothing resolved. Check the spelling against public/vehicles or ${MANIFEST}.`
      : `\n${REJECTS} lists no photographs. Paste some filenames into it first.`);
    return;
  }

  const vehicles = [...new Set(rejections.map((r) => r.vehicleId))].sort();
  console.log(`Rejecting ${rejections.length} photograph(s) across ${vehicles.length} vehicle(s):\n`);
  for (const id of vehicles) {
    const mine = rejections.filter((r) => r.vehicleId === id);
    const total = manifest[id]?.length ?? 0;
    console.log(`  ${id}: ${mine.length} of ${total} — ${mine.map((r) => r.file).join(', ')}`);
    if (mine.length === total) {
      console.log(`    (its whole set; if Commons has nothing else free and in-generation,`);
      console.log(`     this vehicle falls back to the typographic identity band)`);
    }
  }

  const existing: Record<string, string[]> = existsSync(EXCLUSIONS)
    ? (JSON.parse(readFileSync(EXCLUSIONS, 'utf8')) as Record<string, string[]>)
    : {};
  const merged = mergeExclusions(existing, rejections);

  if (dryRun) {
    const added = rejections.filter(({ vehicleId, title }) =>
      !(existing[vehicleId] ?? []).some((t) => normaliseTitle(t) === normaliseTitle(title)));
    console.log(`\nDry run. Would add ${added.length} exclusion(s) and re-fetch: ${vehicles.join(', ')}`);
    return;
  }

  writeFileSync(EXCLUSIONS, JSON.stringify(merged, null, 2) + '\n');
  console.log(`\n${EXCLUSIONS} updated. Re-fetching ${vehicles.length} vehicle(s) from Commons.\n`);

  // The fetcher owns downloading, licence filtering and manifest writing. Run
  // it rather than reimplementing any of that here.
  const result = spawnSync(
    process.execPath,
    ['node_modules/vite-node/dist/cli.mjs', 'scripts/fetch-images.ts', '--force', '--only', vehicles.join(',')],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error('\nThe re-fetch failed. The exclusions are saved, so re-running is safe.');
    process.exit(result.status ?? 1);
  }

  // A rejection that survives is the case worth reporting: Commons had nothing
  // else free and in-generation, so the fetcher kept what it had.
  const after = readManifest();
  const survivors = rejections.filter(({ vehicleId, title }) =>
    (after[vehicleId] ?? []).some((image) => {
      const t = titleFromSourceUrl(image.sourceUrl);
      return t !== null && normaliseTitle(t) === normaliseTitle(title);
    }));

  if (survivors.length > 0) {
    console.log(`\n${survivors.length} rejected photograph(s) are still in the manifest:`);
    for (const s of survivors) console.log(`  ${s.vehicleId}: ${s.file}`);
    console.log('Commons had no other free, in-generation photograph for these. They stay');
    console.log('excluded, so a later run picks up anything newly uploaded.');
  } else {
    console.log('\nEvery rejected photograph was replaced.');
  }
  console.log(`\nReview the new files in public/vehicles, then commit ${EXCLUSIONS} and ${MANIFEST}.`);
}

main();
