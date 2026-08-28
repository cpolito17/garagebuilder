import { useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import { LockOpen } from '@phosphor-icons/react';
import { CATALOG } from '../data/catalog';
import { ROLES, ROLE_LABEL, type Role } from '../data/types';
import { findMatches, explainEmpty, type Filters, type Match } from '../lib/matching';
import { formatUsd } from '../lib/pricing';
import { milesFor, type ConditionId } from '../lib/condition';
import type { SlotState } from '../state/garage';
import { AllocationSlider } from './AllocationSlider';
import { ConditionPicker } from './ConditionPicker';
import { ResultCard } from './ResultCard';
import { EmptyState } from './EmptyState';
import { FilterPanel } from './FilterPanel';

const RESULT_LIMIT = 12;

export function SlotColumn({
  slot, index, budget, allocated, headroom, minSlot, over,
  onBudgetChange, onBudgetCommit, onRole, onCondition, onFilters, onStar, onUnstar, onOpenDetail,
}: {
  slot: SlotState;
  index: number;
  budget: number;
  allocated: number;
  headroom: number;
  minSlot: number;
  over: boolean;
  onBudgetChange: (v: number) => void;
  onBudgetCommit: (v: number) => void;
  onRole: (r: Role | null) => void;
  onCondition: (v: ConditionId) => void;
  onFilters: (f: Filters) => void;
  onStar: (vehicleId: string, spend: number) => void;
  onUnstar: () => void;
  onOpenDetail: (match: Match, origin: DOMRect) => void;
}) {
  // The slot holds a condition; the price model works in miles. One
  // conversion, here, keeps the rest of the column speaking in bands.
  const odometer = milesFor(slot.condition);

  const list = useMemo(
    () => findMatches(CATALOG, {
      budget: allocated, role: slot.role, odometer, filters: slot.filters,
    }),
    [allocated, slot.role, odometer, slot.filters],
  );

  const pick = slot.pick ? list.matches.find((m) => m.vehicle.id === slot.pick) : undefined;
  const shown = slot.pinned && pick ? [pick] : list.matches.slice(0, RESULT_LIMIT);
  const empty = explainEmpty(list, {
    budget: allocated, role: slot.role, odometer, filters: slot.filters,
  });

  return (
    <section
      className="flex min-w-0 flex-col gap-4"
      aria-label={`Slot ${index + 1}${slot.role ? `, ${ROLE_LABEL[slot.role]}` : ''}`}
    >
      <div className="shell" style={{ borderRadius: 24, padding: 8 }}>
        <div className="core flex flex-col gap-4 p-3.5" style={{ borderRadius: 16 }}>
          <div className="flex items-center justify-between gap-2">
            <label className="sr-only" htmlFor={`role-${slot.id}`}>Slot {index + 1} purpose</label>
            <select
              id={`role-${slot.id}`}
              value={slot.role ?? ''}
              onChange={(e) => onRole((e.target.value || null) as Role | null)}
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-[--hairline] bg-[--bg-shell] px-2.5 t-body text-[--text-primary]"
            >
              <option value="">Any purpose</option>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>

            {slot.pinned && (
              <button
                type="button"
                onClick={onUnstar}
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 t-small transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
                style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
              >
                <LockOpen size={15} /> Unlock
              </button>
            )}
          </div>

          <AllocationSlider
            value={allocated}
            headroom={headroom}
            scale={budget}
            min={minSlot}
            pinned={slot.pinned}
            over={over}
            label={`Slot ${index + 1}`}
            onChange={onBudgetChange}
            onCommit={onBudgetCommit}
          />

          {!slot.pinned && (
            <>
              <ConditionPicker value={slot.condition} onChange={onCondition} />
              <FilterPanel
                filters={slot.filters}
                role={slot.role}
                budget={allocated}
                odometer={odometer}
                onChange={onFilters}
              />
            </>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 px-1">
        <span className="t-label text-[--text-tertiary]">
          {slot.pinned ? 'Locked in' : `${list.matches.length} ${list.matches.length === 1 ? 'match' : 'matches'}`}
        </span>
        {!slot.pinned && list.matches.length > RESULT_LIMIT && (
          <span className="num t-small text-[--text-tertiary]">top {RESULT_LIMIT}</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {shown.length === 0 ? (
          <EmptyState
            message={empty.message}
            action={empty.action ? { label: empty.action.label, value: empty.action.value } : undefined}
            onAction={onCondition}
          />
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((m, i) => (
              <ResultCard
                key={m.vehicle.id}
                match={m}
                role={slot.role}
                condition={slot.condition}
                index={i}
                starred={slot.pick === m.vehicle.id}
                onStar={() => (slot.pick === m.vehicle.id ? onUnstar() : onStar(m.vehicle.id, m.spend))}
                onOpen={(origin) => onOpenDetail(m, origin)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {slot.pinned && pick && (
        <p className="px-1 t-small text-[--text-tertiary] m-0">
          This slot is locked at <span className="num">{formatUsd(pick.spend)}</span>. The rest of the
          budget has moved to the other slots.
        </p>
      )}
    </section>
  );
}
