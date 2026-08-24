import { useEffect, useState } from 'react';
import { Minus, Plus, ArrowClockwise } from '@phosphor-icons/react';
import { m } from 'motion/react';
import { formatUsd } from '../lib/pricing';
import type { Allocation, GarageState } from '../state/garage';
import { MAX_SLOTS } from '../state/garage';

/**
 * Fixed chrome. Content scrolls under it, per docs/DESIGN.md 6.4.
 * Translucent here and nowhere else that scrolls.
 */
export function BudgetBar({
  state, alloc, onBudget, onSlotCount, onAutoAllocate,
}: {
  state: GarageState;
  alloc: Allocation;
  onBudget: (v: number) => void;
  onSlotCount: (n: number) => void;
  onAutoAllocate: () => void;
}) {
  const count = state.slots.length;
  const [budgetDraft, setBudgetDraft] = useState(() => state.budget.toLocaleString('en-US'));
  const [editingBudget, setEditingBudget] = useState(false);

  useEffect(() => {
    if (!editingBudget) setBudgetDraft(state.budget.toLocaleString('en-US'));
  }, [state.budget, editingBudget]);

  const commitBudget = () => {
    const digits = budgetDraft.replace(/[^0-9]/g, '');
    const next = Number(digits);
    if (digits && Number.isFinite(next)) onBudget(Math.min(2_000_000, Math.max(1500, next)));
    setEditingBudget(false);
  };

  return (
    <header className="chrome sticky top-0 z-20 border-b border-[--hairline]">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2.5 px-4 py-2.5 md:gap-3 md:py-3">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="budget" className="t-label text-[--text-tertiary]">Total budget</label>
            <div className="flex items-baseline gap-1">
              <span className="num t-h2 text-[--text-tertiary] md:t-h1">$</span>
              <input
                id="budget"
                type="text"
                inputMode="numeric"
                value={budgetDraft}
                onFocus={(e) => { setEditingBudget(true); e.currentTarget.select(); }}
                onChange={(e) => setBudgetDraft(e.target.value.replace(/[^0-9,]/g, ''))}
                onBlur={commitBudget}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') {
                    setBudgetDraft(state.budget.toLocaleString('en-US'));
                    e.currentTarget.blur();
                  }
                }}
                className="num t-h2 h-11 w-[7ch] bg-transparent text-[--text-primary] outline-none md:t-h1"
                style={{ borderBottom: '1px solid var(--hairline)' }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="t-label text-[--text-tertiary]">Cars</span>
            <div className="flex items-center gap-1">
              <StepButton
                label="Remove a slot"
                disabled={count <= 1}
                onClick={() => onSlotCount(count - 1)}
              >
                <Minus size={15} />
              </StepButton>
              <span className="num t-h2 w-[2ch] text-center text-[--text-primary] md:t-h1">{count}</span>
              <StepButton
                label="Add a slot"
                disabled={count >= MAX_SLOTS}
                onClick={() => onSlotCount(count + 1)}
              >
                <Plus size={15} />
              </StepButton>
            </div>
          </div>

          <div className="hidden flex-1 flex-col items-end gap-1 md:flex">
            <span className="t-label text-[--text-tertiary]">
              {alloc.over > 0 ? 'Over budget' : alloc.under > 0 ? 'Unspent' : 'Allocated'}
            </span>
            <span
              className="num t-h1"
              style={{ color: alloc.over > 0 ? 'var(--over)' : 'var(--text-primary)' }}
            >
              {alloc.over > 0
                ? `+${formatUsd(alloc.over)}`
                : alloc.under > 0
                  ? formatUsd(alloc.under)
                  : formatUsd(alloc.total)}
            </span>
          </div>

          <button
            type="button"
            onClick={onAutoAllocate}
            className="group inline-flex h-11 items-center gap-2.5 rounded-full border border-[--hairline] bg-[--bg-shell] py-1.5 pl-4 pr-1.5 t-small text-[--text-primary] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
          >
            Auto-allocate
            <span
              className="grid h-8 w-8 place-items-center rounded-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:rotate-90"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--hairline)' }}
            >
              <ArrowClockwise size={14} />
            </span>
          </button>
        </div>

        {/* Stacked allocation across the whole budget.
            Segments are positioned and sized with transforms rather than
            width, so the redistribution after a pin animates on the compositor
            and stays inside the transform-and-opacity rule in DESIGN.md 7.4. */}
        <div className="flex items-center gap-3">
        <div
          className="relative h-2 w-full flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--bg-shell)', border: '1px solid var(--hairline)' }}
          aria-hidden
        >
          {(() => {
            const scale = Math.max(state.budget, alloc.total, 1);
            let offset = 0;
            return state.slots.map((slot) => {
              const dollars = alloc.perSlot.get(slot.id) ?? 0;
              const frac = dollars / scale;
              const at = offset;
              offset += frac;
              return (
                <m.div
                  key={slot.id}
                  className="absolute inset-y-0 left-0 w-full origin-left rounded-full"
                  initial={false}
                  animate={{ x: `${at * 100}%`, scaleX: Math.max(0, frac - 0.004) }}
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  style={{
                    background: slot.pinned ? 'var(--accent)' : 'var(--text-secondary)',
                    opacity: slot.pinned ? 1 : 0.75,
                  }}
                />
              );
            });
          })()}
        </div>
        <span
          className="num t-small shrink-0 md:hidden"
          style={{ color: alloc.over > 0 ? 'var(--over)' : 'var(--text-secondary)' }}
        >
          {alloc.over > 0
            ? `+${formatUsd(alloc.over)} over`
            : alloc.under > 0
              ? `${formatUsd(alloc.under)} left`
              : ''}
        </span>
        </div>
      </div>
    </header>
  );
}

function StepButton({
  children, onClick, disabled, label,
}: { children: React.ReactNode; onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-full border border-[--hairline] bg-[--bg-shell] text-[--text-primary] transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.92] disabled:opacity-35"
    >
      {children}
    </button>
  );
}
