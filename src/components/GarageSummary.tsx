import { Check, X, Warning } from '@phosphor-icons/react';
import type { Vehicle } from '../data/types';
import { summarise } from '../lib/garageSummary';
import { formatUsd } from '../lib/pricing';

/**
 * The garage as a set. docs/SPEC.md section 4.7.
 *
 * Facts only. No score, no grade, no verdict. This is the most useful surface
 * in the tool and the one where being clever would cost the most.
 */
export function GarageSummary({
  picks, spend, budget,
}: { picks: Vehicle[]; spend: number; budget: number }) {
  const s = summarise(picks);
  const over = spend - budget;

  return (
    <section className="shell" style={{ borderRadius: 24, padding: 8 }}>
      <div className="core flex flex-col gap-5 p-4" style={{ borderRadius: 16 }}>
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="t-h2 m-0 text-[--text-primary]">Your garage</h2>
          <div className="flex items-baseline gap-2">
            <span className="num t-h1 text-[--text-primary]">{formatUsd(spend)}</span>
            <span
              className="num t-small"
              style={{ color: over > 0 ? 'var(--over)' : 'var(--text-tertiary)' }}
            >
              {over > 0 ? `${formatUsd(over)} over` : over < 0 ? `${formatUsd(-over)} left` : 'on budget'}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Stat label="Cars" value={String(picks.length)} />
          <Stat label="Combined power" value={`${s.combinedHorsepower.toLocaleString()} hp`} />
          <Stat label="Pedals" value={String(s.pedals)} />
          <Stat label="Countries" value={String(s.countries)} />
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="t-label m-0 text-[--text-tertiary]">What this garage can do</h3>
          <div className="flex flex-wrap gap-1.5">
            {s.capabilities.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-[--hairline] px-2 py-1 t-small text-[--text-secondary]"
              >
                <Check size={13} style={{ color: 'var(--accent)' }} aria-hidden />
                {c.label}
              </span>
            ))}
            {s.gaps.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-dashed border-[--hairline] px-2 py-1 t-small text-[--text-tertiary]"
              >
                <X size={13} aria-hidden />
                {c.label}
              </span>
            ))}
          </div>
        </div>

        {s.overlaps.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="t-label m-0 text-[--text-tertiary]">Overlap</h3>
            {s.overlaps.map((o, i) => (
              <p key={i} className="m-0 flex gap-2 t-small text-[--text-secondary]">
                <Warning size={14} className="mt-0.5 shrink-0 text-[--text-tertiary]" aria-hidden />
                <span>
                  The {o.a.make} {o.a.model} and the {o.b.make} {o.b.model} are both a{' '}
                  <span className="num">{o.shared}</span>.
                </span>
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5 border-t border-[--hairline] pt-4">
          <h3 className="t-label m-0 text-[--text-tertiary]">Running costs, alongside the budget</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="t-small text-[--text-secondary]">
              Maintenance <span className="num text-[--text-primary]">{formatUsd(s.annualMaintenanceUsd)}</span> a year
            </span>
            <span className="t-small text-[--text-secondary]">
              Fuel and charging <span className="num text-[--text-primary]">{formatUsd(s.annualFuelUsd)}</span> a year
            </span>
          </div>
          <p className="m-0 t-small text-[--text-tertiary]">
            At 12,000 miles a year per vehicle. Not included in the budget, which is purchase price
            only. Insurance is deliberately absent: real premiums vary several fold by driver,
            record and postcode, so a figure here would be the least defensible number in the app.
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="t-label text-[--text-tertiary]">{label}</span>
      <span className="num t-h2 text-[--text-primary]">{value}</span>
    </div>
  );
}
