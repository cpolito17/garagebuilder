import { memo, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Star, Warning, Engine, Users, Package, SteeringWheel, Snowflake, Lightning } from '@phosphor-icons/react';
import type { Match } from '../lib/matching';
import type { Role } from '../data/types';
import { formatMiles, formatUsd } from '../lib/pricing';
import type { ConditionId } from '../lib/condition';
import { Chip } from './primitives';
import { ConditionTag } from './ConditionTag';
import { VehicleTile } from './VehicleTile';
import { VehiclePhoto } from './VehiclePhoto';
import { heroFor } from '../data/images';

const TRANSMISSION_LABEL: Record<string, string> = {
  manual: 'Manual', automatic: 'Auto', dct: 'DCT', cvt: 'CVT', 'single-speed': 'Single speed',
};

/** Three chips chosen by what the slot is for. A family slot does not care
 *  about horsepower and a sports slot does not care about cargo volume. */
function chipsForRole(m: Match, role: Role | null) {
  const s = m.vehicle.spec;
  const power = <Chip key="hp" icon={<Engine size={13} />}>{s.horsepower} hp</Chip>;
  const drive = <Chip key="dt" icon={<SteeringWheel size={13} />}>{s.drivetrain}</Chip>;
  const trans = (
    <Chip key="tr">{s.transmissions.map((t) => TRANSMISSION_LABEL[t] ?? t).slice(0, 2).join(' / ')}</Chip>
  );
  const seats = <Chip key="st" icon={<Users size={13} />}>{s.seats} seats</Chip>;
  const cargo = s.cargoCuFt ? <Chip key="cg" icon={<Package size={13} />}>{s.cargoCuFt} cu ft</Chip> : null;
  const mpg = <Chip key="mpg" icon={<Lightning size={13} />}>{s.mpgCombined} {s.fuel === 'ev' ? 'MPGe' : 'mpg'}</Chip>;
  const tow = s.towingLb ? <Chip key="tw">{s.towingLb.toLocaleString()} lb tow</Chip> : null;
  const clear = s.groundClearanceIn ? <Chip key="gc" icon={<Snowflake size={13} />}>{s.groundClearanceIn} in</Chip> : null;

  switch (role) {
    case 'family': return [seats, cargo, mpg].filter(Boolean);
    case 'cargo': return [cargo, seats, mpg].filter(Boolean);
    case 'tow': return [tow, power, drive].filter(Boolean);
    case 'offroad': return [clear, drive, power].filter(Boolean);
    case 'winter': return [drive, clear, seats].filter(Boolean);
    case 'commuter': return [mpg, trans, seats].filter(Boolean);
    default: return [power, drive, trans].filter(Boolean);
  }
}

export const ResultCard = memo(function ResultCard({
  match, role, condition, starred, onStar, onOpen, index,
}: {
  match: Match; role: Role | null; condition: ConditionId; starred: boolean;
  onStar: () => void; onOpen: (origin: DOMRect) => void; index: number;
}) {
  const reduce = useReducedMotion();
  const [showCautions, setShowCautions] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const { vehicle: v, spend, atMiles, cautions } = match;
  const worst = cautions[0];
  const hero = heroFor(v.id);

  return (
    <m.article
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.04, ease: [0.32, 0.72, 0, 1] }}
      className="shell relative"
      style={{ borderRadius: 20, padding: 6 }}
    >
      <div className="core relative overflow-hidden" style={{ borderRadius: 14 }}>
        {/* A full-card overlay is the detail click target. Keeping it a sibling
            of the content, rather than a parent, leaves the star and the
            caution disclosure as valid, operable controls. */}
        <button
          type="button"
          onClick={() => ref.current && onOpen(ref.current.getBoundingClientRect())}
          className="absolute inset-0 z-0 cursor-pointer"
          aria-label={`Details for ${v.make} ${v.model}, ${v.generation}`}
        />

        <div className="pointer-events-none relative z-10">
          <VehicleTile vehicle={v} withPhoto={!!hero} />
          {/* The photograph sits under the identity band: the name reads first,
              the car confirms it, and the price follows underneath. Squared off,
              because in the middle of the card there are no corners to inherit. */}
          <VehiclePhoto image={hero} priority={index < 2} rounded={false} />
        </div>

        {/* pointer-events-none so the card's dead space falls through to the
            detail overlay beneath. Interactive children opt back in. */}
        <div className="pointer-events-none relative z-10 flex flex-col gap-2.5 p-3">
          <div className="pointer-events-none flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="num t-h2 text-[--text-primary]">
                {formatUsd(spend)}
              </div>
              {/* The band is the slot's; the mileage is this car's, because a
                  2023 hatchback cannot be a beater however the slot is set. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ConditionTag condition={condition} />
                <span className="num t-small text-[--text-secondary]">
                  {atMiles < 1000 ? 'New, 0 miles' : `at about ${formatMiles(atMiles)}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onStar}
              aria-pressed={starred}
              aria-label={starred ? `Unlock ${v.make} ${v.model}` : `Lock ${v.make} ${v.model} into this slot`}
              className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.92]"
              style={{
                background: starred ? 'var(--accent)' : 'var(--bg-shell)',
                color: starred ? 'var(--accent-on)' : 'var(--text-tertiary)',
                border: '1px solid var(--hairline)',
              }}
            >
              <Star size={19} weight={starred ? 'fill' : 'regular'} />
            </button>
          </div>

          <div className="pointer-events-none flex flex-wrap gap-1.5">{chipsForRole(match, role)}</div>

          {worst && (
            <div>
              <button
                type="button"
                onClick={() => setShowCautions((s) => !s)}
                aria-expanded={showCautions}
                className="pointer-events-auto flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left t-small"
                style={{ background: 'var(--caution-wash)', color: 'var(--caution)' }}
              >
                <Warning size={14} weight="regular" className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {cautions.length} known {cautions.length === 1 ? 'issue' : 'issues'}
                  {cautions.some((c) => c.onsetMiles > 0) ? ' at this mileage' : ''}
                </span>
                {worst.typicalCostUsd > 0 && (
                  <span className="num shrink-0">{formatUsd(worst.typicalCostUsd)}</span>
                )}
              </button>

              {showCautions && (
                <ul className="pointer-events-auto mt-2 flex flex-col gap-2">
                  {cautions.map((c) => (
                    <li key={c.text} className="t-small text-[--text-secondary]">
                      <span className="text-[--text-primary]">{c.text}.</span>{' '}
                      <span className="num">
                        {c.onsetMiles > 0 ? `From ${formatMiles(c.onsetMiles)}` : 'At any mileage'}
                        {c.typicalCostUsd > 0 ? `, about ${formatUsd(c.typicalCostUsd)}` : ''}
                      </span>
                      {c.severity === 'car-ending' && (
                        <span className="num" style={{ color: 'var(--caution)' }}> · ends the car</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </m.article>
  );
});
