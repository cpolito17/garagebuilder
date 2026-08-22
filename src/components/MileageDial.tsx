import { Gauge } from '@phosphor-icons/react';

const STOPS = [40_000, 80_000, 120_000, 160_000, 200_000, 250_000];

/**
 * The mileage ceiling. docs/SPEC.md section 4.3.
 *
 * Not a filter on a mileage field. It reads the price curve backwards: every
 * vehicle has an odometer this slot's budget requires, and this decides which
 * of those odometers are acceptable.
 */
export function MileageDial({
  value, onChange,
}: { value: number; onChange: (v: number) => void }) {
  const index = STOPS.indexOf(value) >= 0 ? STOPS.indexOf(value) : 2;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="t-label text-[--text-tertiary]">Mileage limit</span>
        <span className="num t-small text-[--text-secondary]">
          up to {value.toLocaleString()} mi
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Gauge size={15} className="shrink-0 text-[--text-tertiary]" aria-hidden />
        <input
          type="range"
          min={0}
          max={STOPS.length - 1}
          step={1}
          value={index}
          onChange={(e) => onChange(STOPS[Number(e.target.value)]!)}
          aria-label="Mileage limit for this slot"
          aria-valuetext={`up to ${value.toLocaleString()} miles`}
          className="h-11 w-full cursor-pointer"
          style={{ accentColor: 'var(--accent)' }}
        />
      </div>
    </div>
  );
}
