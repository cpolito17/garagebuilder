import { useId, useMemo, useRef, useState } from 'react';
import type { PriceCurve } from '../data/types';
import { priceAtMiles, ceilingPrice, plausibleMaxMiles, formatUsd } from '../lib/pricing';

/**
 * Price against odometer, with the slot's budget marked.
 *
 * Form: one continuous series over a continuum, so a line. One series means no
 * legend box (the caption names it) and no categorical palette, so there is no
 * palette to validate here. The curve wears recessive ink; the accent is spent
 * only on the intersection, because in this design accent means "your answer",
 * and using it for the line as well would dilute that.
 *
 * This chart is the fastest explanation of the whole product: it shows why the
 * same money buys a low-mileage cheap car or a high-mileage expensive one.
 */

const W = 520;
const H = 220;
const PAD = { top: 14, right: 16, bottom: 30, left: 56 };

export function PriceCurveChart({
  curve, firstYear, budget, selectedPrice, atMiles, ceilingMiles,
}: {
  curve: PriceCurve;
  firstYear: number;
  budget: number;
  selectedPrice: number;
  atMiles: number;
  ceilingMiles: number;
}) {
  const titleId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ m: number; p: number; x: number; y: number } | null>(null);

  const maxMiles = Math.min(plausibleMaxMiles(firstYear), Math.max(ceilingMiles, atMiles * 1.25, 60_000));
  const top = ceilingPrice(curve);
  const bottom = curve.floor * 0.9;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (m: number) => PAD.left + (m / maxMiles) * plotW;
  const y = (p: number) => PAD.top + plotH - ((p - bottom) / (top - bottom)) * plotH;

  const path = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 64; i++) {
      const m = (maxMiles * i) / 64;
      pts.push(`${i === 0 ? 'M' : 'L'}${x(m).toFixed(1)},${y(priceAtMiles(curve, m)).toFixed(1)}`);
    }
    return pts.join(' ');
  }, [curve, maxMiles, top, bottom]);

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((maxMiles * f) / 10_000) * 10_000);
  const yTicks = [bottom + (top - bottom) * 0.05, (top + bottom) / 2, top * 0.97];

  const curvePrice = priceAtMiles(curve, atMiles);
  const inRange = curvePrice >= bottom && curvePrice <= top;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const m = Math.max(0, Math.min(maxMiles, ((px - PAD.left) / plotW) * maxMiles));
    const p = priceAtMiles(curve, m);
    setHover({ m, p, x: x(m), y: y(p) });
  }

  /** The table view: the same curve as numbers, for anyone who cannot read it. */
  const readout = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const m = maxMiles * f;
    return `${Math.round(m / 1000)}k miles ${formatUsd(priceAtMiles(curve, m))}`;
  });

  return (
    <figure className="m-0 flex flex-col gap-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        style={{ overflow: 'visible' }}
        role="img"
        aria-labelledby={titleId}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <title id={titleId}>
          Asking price against odometer. {readout.join('. ')}.
        </title>

        {/* Recessive grid */}
        {yTicks.map((p) => (
          <line
            key={p} x1={PAD.left} x2={W - PAD.right} y1={y(p)} y2={y(p)}
            stroke="var(--hairline)" strokeWidth={1}
          />
        ))}

        {/* Axis labels wear text tokens, never a series colour */}
        {yTicks.map((p) => (
          <text
            key={`yl-${p}`} x={PAD.left - 8} y={y(p) + 4} textAnchor="end"
            className="num" fontSize={11} fill="var(--text-tertiary)"
          >
            {formatUsd(p)}
          </text>
        ))}
        {xTicks.map((m) => (
          <text
            key={`xl-${m}`} x={x(m)} y={H - PAD.bottom + 18} textAnchor="middle"
            className="num" fontSize={11} fill="var(--text-tertiary)"
          >
            {m === 0 ? '0' : `${Math.round(m / 1000)}k`}
          </text>
        ))}

        {/* The floor the market will not go below */}
        <line
          x1={PAD.left} x2={W - PAD.right} y1={y(curve.floor)} y2={y(curve.floor)}
          stroke="var(--text-tertiary)" strokeWidth={1} strokeDasharray="2 4" opacity={0.7}
        />

        {/* The curve: 2px, round ends, recessive ink */}
        <path
          d={path} fill="none" stroke="var(--text-secondary)"
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        />

        {inRange && (
          <>
            <line
              x1={PAD.left} x2={x(atMiles)} y1={y(curvePrice)} y2={y(curvePrice)}
              stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.75}
            />
            <line
              x1={x(atMiles)} x2={x(atMiles)} y1={y(curvePrice)} y2={H - PAD.bottom}
              stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.75}
            />
            {/* A 2px surface ring keeps the marker legible over the curve */}
            <circle cx={x(atMiles)} cy={y(curvePrice)} r={7} fill="var(--bg-raised)" />
            <circle cx={x(atMiles)} cy={y(curvePrice)} r={5} fill="var(--accent)" />
          </>
        )}

        {hover && (
          <>
            <line
              x1={hover.x} x2={hover.x} y1={PAD.top} y2={H - PAD.bottom}
              stroke="var(--hairline-strong)" strokeWidth={1}
            />
            <circle cx={hover.x} cy={hover.y} r={5} fill="var(--bg-raised)" stroke="var(--text-secondary)" strokeWidth={2} />
            <text
              x={Math.min(W - PAD.right, Math.max(PAD.left, hover.x))}
              y={PAD.top - 2}
              textAnchor={hover.x > W / 2 ? 'end' : 'start'}
              className="num" fontSize={12} fill="var(--text-primary)"
            >
              {formatUsd(hover.p)} at {Math.round(hover.m / 1000)}k
            </text>
          </>
        )}
      </svg>

      <figcaption className="t-small text-[--text-tertiary] m-0">
        {inRange ? (
          <>
            The <span style={{ color: 'var(--accent)' }}>{formatUsd(selectedPrice)} estimate</span> lands at about{' '}
            <span className="num">{Math.round(atMiles / 1000)},000 miles</span>
            {selectedPrice < budget ? ` and leaves ${formatUsd(budget - selectedPrice)} in this slot` : ''}. The dotted floor is
            what the market pays regardless of odometer.
          </>
        ) : (
          <>
            This slot&apos;s budget is outside the range this vehicle trades in. The dotted floor is
            what the market pays regardless of odometer.
          </>
        )}
      </figcaption>
    </figure>
  );
}
