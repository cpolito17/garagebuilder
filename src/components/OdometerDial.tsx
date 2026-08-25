import { Gauge } from '@phosphor-icons/react';
import { MAX_ODOMETER, ODOMETER_STEP } from '../lib/pricing';

/**
 * The odometer. docs/SPEC.md section 4.3.
 *
 * Not a filter and not a limit. It sets one odometer for the whole slot, and
 * every result is priced at it. Winding it up does not remove cars, it makes
 * them cheaper, which is how a slot reaches a car that lists far above its
 * budget. Winding it down does the reverse.
 *
 * Continuous rather than a handful of stops, because the point of the control
 * is tuning the trade between condition and car.
 *
 * No explanatory line under it. There is one of these per slot, so a sentence
 * here is the same sentence three times, and each result card already prints
 * the odometer it was priced at.
 */
export function OdometerDial({
  value, onChange,
}: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="t-label text-[--text-tertiary]">Odometer</span>
        <span className="num t-small text-[--text-secondary]">
          {value.toLocaleString()} mi
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Gauge size={15} className="shrink-0 text-[--text-tertiary]" aria-hidden />
        <input
          type="range"
          min={0}
          max={MAX_ODOMETER}
          step={ODOMETER_STEP}
          value={Math.min(MAX_ODOMETER, value)}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Odometer for every result in this slot"
          aria-valuetext={`${value.toLocaleString()} miles`}
          className="h-11 w-full cursor-pointer"
          style={{ accentColor: 'var(--accent)' }}
        />
      </div>
    </div>
  );
}
