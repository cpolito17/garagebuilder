import { useRef } from 'react';
import { motion, useMotionValueEvent, useTransform } from 'motion/react';
import { Lock } from '@phosphor-icons/react';
import { useAllocationDrag } from '../hooks/useAllocationDrag';
import { formatUsd } from '../lib/pricing';

/**
 * One slot's share of the budget. docs/DESIGN.md section 7.3.
 *
 * The readout and the fill are driven straight from the motion value so they
 * run at full frame rate; the results list is committed on a throttled
 * schedule by the hook. Both update during the drag, neither on release only.
 */
export function AllocationSlider({
  value, headroom, scale, min, pinned, label, over, onChange, onCommit,
}: {
  value: number;
  headroom: number;
  scale: number;
  min: number;
  pinned: boolean;
  label: string;
  over: boolean;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  const { dollars, isDragging, onPointerDown, onKeyDown } = useAllocationDrag({
    value, headroom, scale, min, disabled: pinned, trackRef, onChange, onCommit,
  });

  // Text updated out of band. Re-rendering React for a dollar readout at
  // 60 fps is exactly the cost the motion value exists to avoid.
  useMotionValueEvent(dollars, 'change', (v) => {
    if (readoutRef.current) readoutRef.current.textContent = formatUsd(Math.max(0, v));
  });

  const width = useTransform(dollars, (v) => `${Math.min(100, Math.max(0, (v / scale) * 100))}%`);
  const handleScale = useTransform(isDragging, (d) => (d ? 1.12 : 1));

  const pct = Math.round((value / scale) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="t-label text-[--text-tertiary]">{label}</span>
        <span
          ref={readoutRef}
          className="num t-h3 tabular-nums"
          style={{ color: over ? 'var(--over)' : 'var(--text-primary)' }}
        >
          {formatUsd(value)}
        </span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={pinned ? -1 : 0}
        aria-label={`${label} budget`}
        aria-valuemin={min}
        aria-valuemax={Math.round(scale)}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${formatUsd(value)}, ${pct} percent of the total budget${over ? ', over budget' : ''}`}
        aria-disabled={pinned}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="relative h-11 w-full touch-none select-none"
        style={{ cursor: pinned ? 'default' : 'ew-resize' }}
      >
        {/* Track */}
        <div
          className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full"
          style={{ background: 'var(--bg-shell)', border: '1px solid var(--hairline)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              width,
              background: over ? 'var(--over)' : pinned ? 'var(--accent)' : 'var(--text-secondary)',
              opacity: pinned ? 1 : 0.85,
            }}
          />
        </div>

        {/* Handle */}
        {!pinned && (
          <motion.div
            aria-hidden
            className="absolute top-1/2 grid h-6 w-6 place-items-center rounded-full"
            style={{
              left: width,
              x: '-50%',
              y: '-50%',
              scale: handleScale,
              background: 'var(--bg-raised)',
              border: `1px solid var(--hairline-strong)`,
              boxShadow: 'var(--shadow-card)',
            }}
          />
        )}
        {pinned && (
          <div
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full"
            style={{ left: `calc(${Math.min(100, (value / scale) * 100)}% - 12px)`, background: 'var(--accent)', color: 'var(--accent-on)' }}
          >
            <Lock size={12} weight="regular" />
          </div>
        )}
      </div>
    </div>
  );
}
