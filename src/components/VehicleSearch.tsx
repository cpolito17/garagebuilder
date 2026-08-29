import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { CATALOG } from '../data/catalog';
import { searchVehicles, type Suggestion } from '../lib/vehicleSearch';
import { formatUsd } from '../lib/pricing';
import { conditionById, type ConditionId } from '../lib/condition';

const SUGGESTION_LIMIT = 8;

/**
 * Search the whole catalog by name, from inside a slot. docs/SPEC.md 4.4.
 *
 * Filters narrow what the slot offers; this finds the car the user already
 * has in mind. Every suggestion is priced at the slot's condition, and one
 * that costs more than the slot's share is shown, marked "Out of Budget", and
 * not selectable. Hiding it would answer a question nobody asked — the user
 * named that car, so the honest reply is its price and the reason it is out of
 * reach, not silence.
 *
 * A combobox rather than a filter field: one text input, a listbox of options
 * underneath, arrow keys and Enter, Escape to close.
 */
export function VehicleSearch({
  query, budget, odometer, condition, onQuery, onSelect,
}: {
  query: string;
  /** The slot's current share, in dollars. */
  budget: number;
  odometer: number;
  condition: ConditionId;
  onQuery: (q: string) => void;
  onSelect: (s: Suggestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();

  const suggestions = useMemo(
    () => searchVehicles(CATALOG, query, { budget, odometer, limit: SUGGESTION_LIMIT }),
    [query, budget, odometer],
  );

  // The list re-prices as the slot's money and condition move, so a cursor
  // parked on the old fifth row would point at nothing.
  useEffect(() => { setCursor(0); }, [query, budget, odometer]);

  // A click anywhere else is a dismissal. Pointerdown rather than click, so the
  // list is gone before whatever was clicked reacts.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const showList = open && query.trim() !== '';
  const affordable = (s: Suggestion) => !s.overBudget;

  const choose = (s: Suggestion | undefined) => {
    if (!s || !affordable(s)) return;
    onSelect(s);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (showList) { e.preventDefault(); setOpen(false); }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setCursor((c) => (c + step + suggestions.length) % suggestions.length);
      return;
    }
    if (e.key === 'Enter' && showList) {
      e.preventDefault();
      choose(suggestions[cursor]);
    }
  };

  const band = conditionById(condition);
  const active = showList && suggestions[cursor] ? `${listId}-opt-${cursor}` : undefined;

  return (
    <div className="relative flex flex-col gap-1.5" ref={wrap}>
      <label className="t-label text-[--text-tertiary]" htmlFor={`${listId}-input`}>
        Search the catalog
      </label>

      <div className="relative">
        <MagnifyingGlass
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[--text-tertiary]"
        />
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-activedescendant={active}
          aria-describedby={`${listId}-hint`}
          placeholder="Miata, 911, Tacoma…"
          value={query}
          onChange={(e) => { onQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-[10px] border border-[--hairline] bg-[--bg-shell] pl-9 pr-11 t-body text-[--text-primary]"
        />
        {query !== '' && (
          <button
            type="button"
            onClick={() => { onQuery(''); setOpen(false); }}
            aria-label="Clear search"
            className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-[--text-tertiary]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <p id={`${listId}-hint`} className="sr-only">
        Results are priced at {band.label}, {band.range}, against this slot&rsquo;s share of the
        budget. A car above that share is marked out of budget and cannot be selected.
      </p>

      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          aria-label="Matching vehicles"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-[19rem] overflow-y-auto rounded-[12px] border border-[--hairline] p-1 shadow-lg"
          style={{ background: 'var(--bg-raised)' }}
        >
          {suggestions.length === 0 ? (
            <li className="px-3 py-2.5 t-small text-[--text-secondary]">
              Nothing in the catalog is called that.
            </li>
          ) : (
            suggestions.map((s, i) => {
              const v = s.vehicle;
              const on = i === cursor;
              return (
                <li
                  key={v.id}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={on}
                  aria-disabled={s.overBudget}
                  onPointerDown={(e) => e.preventDefault()}
                  onPointerEnter={() => setCursor(i)}
                  onClick={() => choose(s)}
                  className="flex items-center justify-between gap-3 rounded-[8px] px-2.5 py-2"
                  style={{
                    background: on ? 'var(--bg-shell)' : 'transparent',
                    cursor: s.overBudget ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span className="flex min-w-0 flex-col">
                    <span
                      className="truncate t-small"
                      style={{ color: s.overBudget ? 'var(--text-secondary)' : 'var(--text-primary)' }}
                    >
                      {v.make} {v.model}
                    </span>
                    <span className="num truncate t-small text-[--text-tertiary]">
                      {v.generation} · {v.years[0]}-{v.years[1]}
                    </span>
                  </span>

                  <span className="flex shrink-0 flex-col items-end">
                    <span
                      className="num t-small"
                      style={{ color: s.overBudget ? 'var(--over)' : 'var(--text-primary)' }}
                    >
                      {formatUsd(s.price)}
                    </span>
                    {s.overBudget && (
                      <span
                        className="t-label"
                        style={{ color: 'var(--over)' }}
                      >
                        Out of Budget
                      </span>
                    )}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
