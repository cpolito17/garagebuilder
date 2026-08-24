import { useCallback, useMemo, useState } from 'react';
import { CATALOG, PRICES_AS_OF } from './data/catalog';
import { ROLE_LABEL, type Role } from './data/types';
import { findMatches, type Filters, type Match } from './lib/matching';
import { formatUsd } from './lib/pricing';
import { autoAllocate } from './lib/autoAllocate';
import {
  allocate, initialGarage, pinSlot, setBudget, setSlotBudget, setSlotCount,
  setSlotFilters, setSlotMaxMiles, setSlotRole, unpinSlot, MIN_SLOT,
  type GarageState,
} from './state/garage';
import { BudgetBar } from './components/BudgetBar';
import { DetailModal } from './components/DetailModal';
import { GarageSummary } from './components/GarageSummary';
import { byId } from './data/catalog';
import { SlotColumn } from './components/SlotColumn';
import { useIsDesktop } from './hooks/useMediaQuery';

export default function App() {
  const [state, setState] = useState<GarageState>(() => initialGarage(50_000, 3));
  const [active, setActive] = useState(0);
  const isDesktop = useIsDesktop();
  const [detail, setDetail] = useState<{ match: Match; slotId: string; origin: DOMRect } | null>(null);

  const alloc = useMemo(() => allocate(state), [state]);

  // Slots with nothing at their current allocation. Reported once at the top
  // rather than leaving the user to work out why a column is empty.
  const starved = useMemo(
    () =>
      state.slots.filter((s) => {
        if (s.pinned) return false;
        const budget = alloc.perSlot.get(s.id) ?? 0;
        return findMatches(CATALOG, {
          budget, role: s.role, maxMiles: s.maxMiles, filters: s.filters,
        }).matches.length === 0;
      }),
    [state.slots, alloc],
  );

  const update = useCallback((fn: (s: GarageState) => GarageState) => setState(fn), []);
  const openDetail = useCallback(
    (slotId: string, match: Match, origin: DOMRect) => setDetail({ match, slotId, origin }),
    [],
  );
  const detailSlot = detail ? state.slots.find((s) => s.id === detail.slotId) : undefined;

  // The summary appears once every slot is locked, because a garage with an
  // empty slot is not yet a set worth evaluating.
  const picks = state.slots.map((s) => (s.pick ? byId.get(s.pick) : undefined));
  const complete = picks.every(Boolean) && picks.length > 0;

  const activeSlot = state.slots[Math.min(active, state.slots.length - 1)];

  return (
    <div className="min-h-[100dvh] bg-[--bg-base]">
      <BudgetBar
        state={state}
        alloc={alloc}
        onBudget={(v) => update((s) => setBudget(s, v))}
        onSlotCount={(n) => { setActive((a) => Math.min(a, n - 1)); update((s) => setSlotCount(s, n)); }}
        onAutoAllocate={() => update(autoAllocate)}
      />

      {(alloc.over > 0 || starved.length > 0) && (
        <div className="mx-auto max-w-[1400px] px-4 pt-3">
          {alloc.over > 0 && (
            <p
              className="m-0 rounded-[10px] px-3 py-2 t-small"
              style={{ background: 'var(--over-wash)', color: 'var(--over)' }}
            >
              This garage is <span className="num">{formatUsd(alloc.over)}</span> over budget.
            </p>
          )}
          {starved.length > 0 && (
            <p
              className="m-0 mt-2 rounded-[10px] px-3 py-2 t-small"
              style={{ background: 'var(--caution-wash)', color: 'var(--caution)' }}
            >
              {starved.length === 1
                ? `The ${starved[0]!.role ? ROLE_LABEL[starved[0]!.role as Role].toLowerCase() : 'unassigned'} slot has nothing at its current share.`
                : `${starved.length} slots have nothing at their current share.`}{' '}
              {formatUsd(state.budget)} may not stretch to {state.slots.length} cars with these purposes.
            </p>
          )}
        </div>
      )}

      {/* Mobile: one slot at a time behind a rail. Columns are the desktop
          expression of this layout, not its basis. */}
      {!isDesktop && (
      <nav
        className="mx-auto flex max-w-[1400px] gap-2 overflow-x-auto px-4 py-3 no-scrollbar"
        aria-label="Slots"
      >
        {state.slots.map((s, i) => {
          const dollars = alloc.perSlot.get(s.id) ?? 0;
          const on = i === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(i)}
              aria-current={on}
              className="flex h-11 shrink-0 flex-col justify-center rounded-full border px-4 text-left transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
              style={{
                background: on ? 'var(--bg-raised)' : 'var(--bg-shell)',
                borderColor: on ? 'var(--hairline-strong)' : 'var(--hairline)',
                color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <span className="t-small leading-tight">
                {s.role ? ROLE_LABEL[s.role] : `Slot ${i + 1}`}
              </span>
              <span
                className="num leading-tight"
                style={{ fontSize: '0.6875rem', color: s.pinned ? 'var(--accent)' : 'var(--text-tertiary)' }}
              >
                {formatUsd(dollars)}{s.pinned ? ' locked' : ''}
              </span>
            </button>
          );
        })}
      </nav>
      )}

      <main className="mx-auto max-w-[1400px] px-4 pb-24">
        {isDesktop ? (
          // Columns never compress below a legible width, they scroll.
          <div className="flex gap-5 overflow-x-auto pb-2">
            {state.slots.map((s, i) => (
              <div key={s.id} className="min-w-[320px] flex-1 shrink-0">
                <SlotColumnFor slot={s} index={i} state={state} alloc={alloc} update={update} onOpenDetail={openDetail} />
              </div>
            ))}
          </div>
        ) : (
          activeSlot && (
            <SlotColumnFor
              slot={activeSlot}
              index={state.slots.indexOf(activeSlot)}
              state={state}
              alloc={alloc}
              update={update}
              onOpenDetail={openDetail}
            />
          )
        )}

        {complete && (
          <div className="mt-8">
            <GarageSummary
              picks={picks.filter(Boolean) as NonNullable<(typeof picks)[number]>[]}
              spend={alloc.total}
              budget={state.budget}
            />
          </div>
        )}

        <footer className="mt-12 flex flex-col gap-1 border-t border-[--hairline] pt-5">
          <p className="m-0 t-small text-[--text-tertiary]">
            Estimates from an offline catalog of {CATALOG.length} vehicle generations, priced as of{' '}
            {PRICES_AS_OF}. US market, model years 1990 to current. Not listings, quotes, or advice.
          </p>
          <p className="m-0 t-small text-[--text-tertiary]">
            Budget means purchase price only. It does not include tax, title, registration,
            insurance, or running costs.
          </p>
        </footer>
      </main>

      <DetailModal
        match={detail?.match ?? null}
        slotBudget={detail ? alloc.perSlot.get(detail.slotId) ?? 0 : 0}
        slotMaxMiles={detailSlot?.maxMiles ?? 120_000}
        origin={detail?.origin ?? null}
        starred={!!detailSlot && detailSlot.pick === detail?.match.vehicle.id}
        onStar={() => {
          if (!detail || !detailSlot) return;
          update((s) =>
            detailSlot.pick === detail.match.vehicle.id
              ? unpinSlot(s, detail.slotId)
              : pinSlot(s, detail.slotId, detail.match.vehicle.id, detail.match.spend),
          );
          setDetail(null);
        }}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function SlotColumnFor({
  slot, index, state, alloc, update, onOpenDetail,
}: {
  slot: GarageState['slots'][number];
  index: number;
  state: GarageState;
  alloc: ReturnType<typeof allocate>;
  update: (fn: (s: GarageState) => GarageState) => void;
  onOpenDetail: (slotId: string, match: Match, origin: DOMRect) => void;
}) {
  const allocated = alloc.perSlot.get(slot.id) ?? 0;
  return (
    <SlotColumn
      slot={slot}
      index={index}
      budget={state.budget}
      allocated={allocated}
      headroom={alloc.headroom(slot.id)}
      minSlot={MIN_SLOT}
      over={alloc.over > 0}
      onBudgetChange={(v) => update((s) => setSlotBudget(s, slot.id, v))}
      onBudgetCommit={(v) => update((s) => setSlotBudget(s, slot.id, v))}
      onRole={(r: Role | null) => update((s) => setSlotRole(s, slot.id, r))}
      onMaxMiles={(v) => update((s) => setSlotMaxMiles(s, slot.id, v))}
      onFilters={(f: Filters) => update((s) => setSlotFilters(s, slot.id, f))}
      onStar={(vehicleId, spend) => update((s) => pinSlot(s, slot.id, vehicleId, spend))}
      onUnstar={() => update((s) => unpinSlot(s, slot.id))}
      onOpenDetail={(match, origin) => onOpenDetail(slot.id, match, origin)}
    />
  );
}
