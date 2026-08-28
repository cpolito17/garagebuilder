import { CONDITIONS, conditionById, type ConditionId } from '../lib/condition';

/**
 * The condition picker. docs/SPEC.md section 4.3.
 *
 * Replaces the continuous odometer dial. Not a filter and not a limit: it sets
 * one condition for the whole slot and every result is priced at it. Choosing
 * a worse condition does not remove cars, it makes them cheaper, which is how
 * a slot reaches a car that lists far above its budget.
 *
 * Six stops rather than a slider, because the trade being made is between
 * condition and car, and nobody holds an opinion about 137,500 miles. The
 * mileage stays visible under each name so the price remains explicable.
 *
 * A radiogroup rather than six buttons: one tab stop for the whole control and
 * arrow keys between the bands, which is what a set of exclusive choices is.
 */
export function ConditionPicker({
  value, onChange,
}: { value: ConditionId; onChange: (v: ConditionId) => void }) {
  const selected = conditionById(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="t-label text-[--text-tertiary]">Condition</span>
        <span className="num t-small" style={{ color: selected.color }}>
          {selected.range}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Condition every result in this slot is priced at"
        className="grid grid-cols-2 gap-1.5"
      >
        {CONDITIONS.map((c) => {
          const on = c.id === selected.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              // Only the selected band is in the tab order; arrow keys move
              // within the group, which is how a radiogroup is meant to work.
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(c.id)}
              onKeyDown={(e) => {
                const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
                  : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                if (step === 0) return;
                e.preventDefault();
                const i = CONDITIONS.findIndex((x) => x.id === selected.id);
                const next = CONDITIONS[(i + step + CONDITIONS.length) % CONDITIONS.length]!;
                onChange(next.id);
              }}
              className="flex min-h-11 items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left transition-colors duration-150"
              style={{
                background: on ? c.wash : 'var(--bg-shell)',
                border: `1px solid ${on ? c.color : 'var(--hairline)'}`,
              }}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: c.color, opacity: on ? 1 : 0.55 }}
              />
              <span className="flex min-w-0 flex-col">
                <span
                  className="t-small truncate"
                  style={{ color: on ? c.color : 'var(--text-primary)' }}
                >
                  {c.label}
                </span>
                <span className="num t-small truncate text-[--text-tertiary]">{c.range}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
