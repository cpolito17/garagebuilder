import { useCallback, useEffect, useRef } from 'react';
import { animate, useMotionValue, type MotionValue } from 'motion/react';

/**
 * The allocation gesture. docs/DESIGN.md section 7.3.
 *
 * Specified in full because a naive range input feels dead, and the whole tool
 * rests on the moment where money visibly moves between slots.
 *
 * Implements, in order: feedback on pointer-down, pointer capture, grab offset
 * respected, 1:1 tracking with live updates throughout, rubber-band resistance
 * past the budget boundary, velocity handoff into a settling spring, and
 * interruption from the presentation value.
 */

const RESISTANCE = 0.55;

/** Progressive resistance. The further past the bound, the less it follows. */
export function rubberband(overshoot: number, dimension: number, c = RESISTANCE): number {
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}

type Sample = { x: number; t: number };

export type AllocationDrag = {
  dollars: MotionValue<number>;
  isDragging: MotionValue<number>;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
};

export function useAllocationDrag(opts: {
  value: number;
  /** Dollars at which the other slots hit their floor and overspend begins. */
  headroom: number;
  /** Full-scale value of the track. */
  scale: number;
  min: number;
  disabled?: boolean;
  trackRef: React.RefObject<HTMLElement | null>;
  onChange: (dollars: number) => void;
  onCommit: (dollars: number) => void;
}): AllocationDrag {
  const { value, headroom, scale, min, disabled, trackRef, onChange, onCommit } = opts;

  const dollars = useMotionValue(value);
  const isDragging = useMotionValue(0);

  const dragging = useRef(false);
  const grabOffset = useRef(0);
  const samples = useRef<Sample[]>([]);
  const running = useRef<{ stop: () => void } | null>(null);
  const lastCommitted = useRef(value);

  // Follow external changes (another slot dragged, a pin, a budget edit) only
  // while this control is idle. During a gesture the pointer is the authority.
  useEffect(() => {
    if (dragging.current) return;
    if (Math.abs(dollars.get() - value) < 1) return;
    running.current?.stop();
    lastCommitted.current = value;
    running.current = animate(dollars, value, { type: 'spring', bounce: 0.15, duration: 0.4 });
  }, [value, dollars]);

  const pxToDollars = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left - grabOffset.current) / Math.max(1, rect.width);
      return ratio * scale;
    },
    [trackRef, scale, value],
  );

  /** Resistance applies past headroom. It does not snap back: overspending is
   *  a state the user is allowed to choose, so the control resists it rather
   *  than refusing it. */
  const constrain = useCallback(
    (raw: number) => {
      if (raw < min) return min - rubberband(min - raw, scale * 0.3);
      if (raw > headroom) return headroom + rubberband(raw - headroom, scale * 0.3);
      return raw;
    },
    [min, headroom, scale],
  );

  // Live updates during the drag, throttled to one commit per frame and to
  // meaningful dollar changes. The handle and the readout run off the motion
  // value at full rate; re-rendering a result list on every pointermove is
  // what collapses on mobile.
  const frame = useRef(0);
  const pushLive = useCallback(
    (next: number) => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const v = Math.round(dollars.get());
        if (Math.abs(v - lastCommitted.current) >= 100) {
          lastCommitted.current = v;
          onChange(v);
        }
      });
      void next;
    },
    [dollars, onChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return;
      const track = trackRef.current;
      if (!track) return;

      // Interrupt from the presentation value. Reading the live motion value
      // rather than the logical target is what stops the handle jumping when
      // a moving allocation is grabbed.
      running.current?.stop();
      running.current = null;

      const rect = track.getBoundingClientRect();
      const currentPx = rect.left + (dollars.get() / scale) * rect.width;
      // Respect where they grabbed. Centring the handle under the pointer
      // breaks the illusion immediately.
      const withinHandle = Math.abs(e.clientX - currentPx) < 28;
      grabOffset.current = withinHandle ? e.clientX - currentPx : 0;

      dragging.current = true;
      isDragging.set(1);
      samples.current = [{ x: e.clientX, t: performance.now() }];
      e.currentTarget.setPointerCapture(e.pointerId);

      if (!withinHandle) {
        const next = constrain(pxToDollars(e.clientX));
        dollars.set(next);
        pushLive(next);
      }
      e.preventDefault();
    },
    [disabled, trackRef, dollars, scale, isDragging, constrain, pxToDollars, pushLive],
  );

  // Move and release live on the window so tracking survives the pointer
  // leaving the element, alongside pointer capture.
  useEffect(() => {
    if (disabled) return;

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const now = performance.now();
      samples.current.push({ x: e.clientX, t: now });
      if (samples.current.length > 6) samples.current.shift();

      const next = constrain(pxToDollars(e.clientX));
      dollars.set(next);
      pushLive(next);
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      isDragging.set(0);

      // Velocity from the recent sample history, not the last event alone.
      const s = samples.current;
      const first = s[0];
      const last = s[s.length - 1];
      let velocity = 0;
      if (first && last && last.t > first.t) {
        const track = trackRef.current;
        const width = track ? track.getBoundingClientRect().width : 1;
        velocity = ((last.x - first.x) / (last.t - first.t)) * 1000 * (scale / Math.max(1, width));
      }

      const settled = Math.max(min, Math.round(dollars.get()));

      // Hand the release velocity to the settling spring so there is no seam
      // between dragging and animating.
      running.current = animate(dollars, settled, {
        type: 'spring',
        bounce: 0.15,
        duration: 0.4,
        velocity,
      });

      lastCommitted.current = settled;
      onCommit(settled);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [disabled, constrain, pxToDollars, dollars, isDragging, min, scale, trackRef, onCommit, pushLive]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (disabled) return;
      const step = e.shiftKey ? scale * 0.1 : scale * 0.01;
      let next: number | null = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - step;
      else if (e.key === 'Home') next = min;
      else if (e.key === 'End') next = headroom;
      if (next === null) return;
      e.preventDefault();
      onCommit(Math.max(min, Math.round(next)));
    },
    [disabled, scale, value, min, headroom, onCommit],
  );

  return { dollars, isDragging, onPointerDown, onKeyDown };
}
