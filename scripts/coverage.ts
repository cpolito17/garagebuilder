import { CATALOG } from '../src/data/catalog';
import { ROLES } from '../src/data/types';
import { findMatches, DEFAULT_FILTERS } from '../src/lib/matching';
import { DEFAULT_ODOMETER } from '../src/state/garage';

console.log('ROLE COVERAGE  (tagged / matches at three budgets, 100k odometer)');
for (const r of ROLES) {
  const tagged = CATALOG.filter((v) => v.roles.includes(r)).length;
  const c = [8000, 20000, 45000].map(
    (budget) => findMatches(CATALOG, { budget, role: r, odometer: DEFAULT_ODOMETER, filters: DEFAULT_FILTERS }).matches.length,
  );
  console.log(`  ${r.padEnd(14)} tagged ${String(tagged).padStart(2)}    $8k:${String(c[0]).padStart(2)}   $20k:${String(c[1]).padStart(2)}   $45k:${String(c[2]).padStart(2)}`);
}

console.log('\nTOP 6 AT $18,000, any role, 100k odometer');
const top = findMatches(CATALOG, { budget: 18000, role: null, odometer: DEFAULT_ODOMETER, filters: DEFAULT_FILTERS });
for (const m of top.matches.slice(0, 6)) {
  console.log(
    `  ${(m.vehicle.make + ' ' + m.vehicle.model).padEnd(26)} ${String(Math.round(m.atMiles / 1000)).padStart(4)}k mi   $${m.spend.toLocaleString().padStart(7)}   score ${m.score.toFixed(3)}   ${m.cautions.length} caution`,
  );
}
console.log(`  ${top.matches.length} matches, ${top.overBudget.length} over budget at this odometer`);

console.log('\nTHE ODOMETER DIAL, sports slot at $18,000');
for (const odometer of [30000, 100000, 200000]) {
  const res = findMatches(CATALOG, { budget: 18000, role: 'sports', odometer, filters: DEFAULT_FILTERS });
  console.log(`  odometer ${String(odometer / 1000).padStart(3)}k: ` + res.matches.slice(0, 5).map((m) => `${m.vehicle.model} @${Math.round(m.atMiles / 1000)}k`).join(', '));
}

console.log('\nBUDGET SQUEEZE, sports slot');
for (const b of [8000, 15000, 25000, 40000]) {
  const res = findMatches(CATALOG, { budget: b, role: 'sports', odometer: DEFAULT_ODOMETER, filters: DEFAULT_FILTERS });
  console.log(`  $${String(b).padStart(6)}: ` + (res.matches.slice(0, 4).map((m) => `${m.vehicle.model} @${Math.round(m.atMiles / 1000)}k`).join(', ') || 'nothing'));
}
