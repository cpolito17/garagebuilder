import { ArrowRight, Trophy } from '@phosphor-icons/react';
import { byId } from '../data/catalog';
import { ROLE_LABEL } from '../data/types';
import type { GarageState } from '../state/garage';
import { formatUsd } from '../lib/pricing';

/**
 * What a recipient of a shared link sees. docs/SPEC.md section 6.2.
 *
 * Deliberately not the empty builder. A blank page is not a challenge; a
 * budget, a set of jobs to cover, and someone else's answer to beat is.
 */
export function ChallengeIntro({
  rival, onAccept, onDismiss,
}: { rival: GarageState; onAccept: () => void; onDismiss: () => void }) {
  const spend = rival.slots.reduce((a, s) => a + s.target, 0);

  return (
    <section className="shell" style={{ borderRadius: 24, padding: 8 }}>
      <div className="core flex flex-col gap-5 p-4" style={{ borderRadius: 16 }}>
        <div className="flex items-start gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
            style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
          >
            <Trophy size={20} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="t-h2 m-0 text-[--text-primary]">
              Someone built a {formatUsd(rival.budget)} garage
            </h2>
            <p className="m-0 t-small text-[--text-secondary]">
              You get the same budget and the same {rival.slots.length}{' '}
              {rival.slots.length === 1 ? 'slot' : 'slots'}, with nothing picked. Do better.
            </p>
          </div>
        </div>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rival.slots.map((slot, i) => {
            const v = slot.pick ? byId.get(slot.pick) : undefined;
            return (
              <li
                key={slot.id}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-[--hairline] px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="t-label text-[--text-tertiary]">
                    {slot.role ? ROLE_LABEL[slot.role] : `Slot ${i + 1}`}
                  </span>
                  <span className="t-body truncate text-[--text-primary]">
                    {v ? `${v.make} ${v.model}` : slot.pick ? 'No longer in the catalog' : 'Empty'}
                    {v && <span className="num text-[--text-tertiary]"> {v.generation}</span>}
                  </span>
                </div>
                <span className="num t-body shrink-0 text-[--text-secondary]">
                  {formatUsd(slot.target)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="num t-small text-[--text-tertiary]">
            {formatUsd(spend)} spent of {formatUsd(rival.budget)}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex min-h-11 items-center rounded-full border border-[--hairline] bg-[--bg-shell] px-4 t-small text-[--text-primary]"
            >
              Start from scratch instead
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="group inline-flex h-11 items-center gap-2.5 rounded-full py-1.5 pl-5 pr-1.5 t-small"
              style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
            >
              Take the challenge
              <span className="grid h-8 w-8 place-items-center rounded-full bg-black/12 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
                <ArrowRight size={15} />
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
