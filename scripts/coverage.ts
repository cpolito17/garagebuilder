import { CATALOG } from '../src/data/catalog';
import { ROLES } from '../src/data/types';
import { findMatches, DEFAULT_FILTERS } from '../src/lib/matching';

console.log('ROLE COVERAGE  (tagged / matches at three budgets, 150k ceiling)');
for (const r of ROLES) {
  const tagged = CATALOG.filter((v) => v.roles.includes(r)).length;
  const c = [8000, 20000, 45000].map(
    (budget) => findMatches(CATALOG, { budget, role: r, maxMiles: 150000, filters: DEFAULT_FILTERS }).matches.length,
  );
  console.log(`  ${r.padEnd(14)} tagged ${String(tagged).padStart(2)}    $8k:${String(c[0]).padStart(2)}   $20k:${String(c[1]).padStart(2)}   $45k:${String(c[2]).padStart(2)}`);
}

console.log('\nTOP 6 AT $18,000, any role, 150k ceiling');
const top = findMatches(CATALOG, { budget: 18000, role: null, maxMiles: 150000, filters: DEFAULT_FILTERS });
for (const m of top.matches.slice(0, 6)) {
  console.log(
    `  ${(m.vehicle.make + ' ' + m.vehicle.model).padEnd(26)} ${String(Math.round(m.atMiles / 1000)).padStart(4)}k mi   $${m.band.mid.toLocaleString().padStart(7)}   score ${m.score.toFixed(3)}   ${m.cautions.length} caution`,
  );
}
console.log(`  ${top.matches.length} matches, ${top.belowFloor.length} below floor, ${top.implausible} implausible`);

console.log('\nTHE MILEAGE DIAL, sports slot at $18,000');
for (const ceiling of [60000, 120000, 200000]) {
  const res = findMatches(CATALOG, { budget: 18000, role: 'sports', maxMiles: ceiling, filters: DEFAULT_FILTERS });
  console.log(`  ceiling ${String(ceiling / 1000).padStart(3)}k: ` + res.matches.slice(0, 5).map((m) => `${m.vehicle.model} @${Math.round(m.atMiles / 1000)}k`).join(', '));
}

console.log('\nBUDGET SQUEEZE, sports slot');
for (const b of [8000, 15000, 25000, 40000]) {
  const res = findMatches(CATALOG, { budget: b, role: 'sports', maxMiles: 150000, filters: DEFAULT_FILTERS });
  console.log(`  $${String(b).padStart(6)}: ` + (res.matches.slice(0, 4).map((m) => `${m.vehicle.model} @${Math.round(m.atMiles / 1000)}k`).join(', ') || 'nothing'));
}
