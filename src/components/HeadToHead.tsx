import { byId } from '../data/catalog';
import { ROLE_LABEL, type Vehicle } from '../data/types';
import type { GarageState } from '../state/garage';
import { summarise } from '../lib/garageSummary';
import { formatUsd } from '../lib/pricing';

/**
 * Two garages side by side. docs/SPEC.md section 6.2.
 *
 * No winner is declared. The tool states facts and the people arguing about
 * it decide, which is the part that turns one share into a thread.
 */
export function HeadToHead({
  rival, mine, mineSpend,
}: { rival: GarageState; mine: GarageState; mineSpend: number }) {
  const picksOf = (g: GarageState) =>
    g.slots.map((s) => (s.pick ? byId.get(s.pick) : undefined));

  const rivalPicks = picksOf(rival);
  const minePicks = picksOf(mine);
  const rivalSummary = summarise(rivalPicks.filter(Boolean) as Vehicle[]);
  const mineSummary = summarise(minePicks.filter(Boolean) as Vehicle[]);
  const rivalSpend = rival.slots.reduce((a, s) => a + s.target, 0);

  const rows: { label: string; a: string; b: string }[] = [
    { label: 'Spent', a: formatUsd(rivalSpend), b: formatUsd(mineSpend) },
    { label: 'Combined power', a: `${rivalSummary.combinedHorsepower.toLocaleString()} hp`, b: `${mineSummary.combinedHorsepower.toLocaleString()} hp` },
    { label: 'Pedals', a: String(rivalSummary.pedals), b: String(mineSummary.pedals) },
    { label: 'Countries', a: String(rivalSummary.countries), b: String(mineSummary.countries) },
    { label: 'Capabilities covered', a: `${rivalSummary.capabilities.length} of ${rivalSummary.capabilities.length + rivalSummary.gaps.length}`, b: `${mineSummary.capabilities.length} of ${mineSummary.capabilities.length + mineSummary.gaps.length}` },
    { label: 'Running cost a year', a: formatUsd(rivalSummary.annualMaintenanceUsd + rivalSummary.annualFuelUsd), b: formatUsd(mineSummary.annualMaintenanceUsd + mineSummary.annualFuelUsd) },
  ];

  return (
    <section className="shell" style={{ borderRadius: 24, padding: 8 }}>
      <div className="core flex flex-col gap-5 p-4" style={{ borderRadius: 16 }}>
        <div className="flex flex-col gap-1">
          <h2 className="t-h2 m-0 text-[--text-primary]">Head to head</h2>
          <p className="m-0 t-small text-[--text-secondary]">
            Same budget, same slots. No winner is declared here, which is rather the point.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-2 sm:gap-x-6">
          <span className="t-label text-[--text-tertiary]">Theirs</span>
          <span />
          <span className="t-label text-right text-[--text-tertiary]" style={{ color: 'var(--accent)' }}>Yours</span>

          {rival.slots.map((slot, i) => {
            const a = rivalPicks[i];
            const b = minePicks[i];
            return (
              <div key={slot.id} className="col-span-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 border-t border-[--hairline] pt-2 sm:gap-x-6">
                <span className="t-small truncate text-[--text-secondary]">
                  {a ? `${a.make} ${a.model}` : 'Empty'}
                </span>
                <span className="t-label whitespace-nowrap text-[--text-tertiary]">
                  {slot.role ? ROLE_LABEL[slot.role] : `Slot ${i + 1}`}
                </span>
                <span className="t-small truncate text-right text-[--text-primary]">
                  {b ? `${b.make} ${b.model}` : 'Empty'}
                </span>
              </div>
            );
          })}

          {rows.map((r) => (
            <div key={r.label} className="col-span-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 border-t border-[--hairline] pt-2 sm:gap-x-6">
              <span className="num t-body text-[--text-secondary]">{r.a}</span>
              <span className="t-label whitespace-nowrap text-[--text-tertiary]">{r.label}</span>
              <span className="num t-body text-right text-[--text-primary]">{r.b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
