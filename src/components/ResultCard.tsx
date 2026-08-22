import { memo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Star, Warning, Engine, Users, Package, SteeringWheel, Snowflake, Lightning } from '@phosphor-icons/react';
import type { Match } from '../lib/matching';
import type { Role } from '../data/types';
import { formatMiles, formatUsd } from '../lib/pricing';
import { Chip } from './primitives';
import { VehicleTile } from './VehicleTile';

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
    <Chip key="tr">
      {s.transmissions.map((t) => TRANSMISSION_LABEL[t] ?? t).slice(0, 2).join(' / ')}
    </Chip>
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
  match, role, starred, onStar, index,
}: {
  match: Match; role: Role | null; starred: boolean;
  onStar: () => void; index: number;
}) {
  const reduce = useReducedMotion();
  const [showCautions, setShowCautions] = useState(false);
  const { vehicle: v, band, atMiles, cautions } = match;
  const worst = cautions[0];

  return (
    <motion.article
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.04, ease: [0.32, 0.72, 0, 1] }}
      className="shell"
      style={{ borderRadius: 20, padding: 6 }}
    >
      <div className="core overflow-hidden" style={{ borderRadius: 14 }}>
        <VehicleTile vehicle={v} />

        <div className="flex flex-col gap-2.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="num t-h2 text-[--text-primary]">
                {formatUsd(band.low)}
                <span className="text-[--text-tertiary]"> to </span>
                {formatUsd(band.high)}
              </div>
              <div className="num t-small text-[--text-secondary]">
                {atMiles < 1000 ? 'New, 0 miles' : `at about ${formatMiles(atMiles)}`}
              </div>
            </div>

            <button
              type="button"
              onClick={onStar}
              aria-pressed={starred}
              aria-label={starred ? `Unlock ${v.make} ${v.model}` : `Lock ${v.make} ${v.model} into this slot`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.92]"
              style={{
                background: starred ? 'var(--accent)' : 'var(--bg-shell)',
                color: starred ? 'var(--accent-on)' : 'var(--text-tertiary)',
                border: '1px solid var(--hairline)',
              }}
            >
              <Star size={19} weight={starred ? 'fill' : 'regular'} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">{chipsForRole(match, role)}</div>

          {worst && (
            <div>
              <button
                type="button"
                onClick={() => setShowCautions((s) => !s)}
                aria-expanded={showCautions}
                className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left t-small"
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
                <ul className="mt-2 flex flex-col gap-2">
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
    </motion.article>
  );
});
