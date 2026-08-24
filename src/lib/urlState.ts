import { ROLE_ORDER } from '../data/codec';
import type { Role } from '../data/types';
import { DEFAULT_FILTERS, type Filters } from './matching';
import { DEFAULT_MAX_MILES, MIN_SLOT, type GarageState, type SlotState } from '../state/garage';

/**
 * The garage lives in the URL. docs/DATA-MODEL.md section 9.
 *
 * Two rules drive every decision here:
 *
 * 1. A link must open forever. The version marker is first and permanent, and
 *    decoding is tolerant: unknown fields are ignored, missing fields take
 *    defaults, and a partially corrupt payload yields the parts that survived
 *    rather than nothing. A link that fails to open is a link that stops
 *    spreading, and spreading is the entire distribution model.
 *
 * 2. Vehicles are referenced by id, never by catalog index. Indices shift
 *    every time a record is authored, which would silently repoint every link
 *    ever shared at a different car.
 */

const VERSION = 1;
export const STATE_PARAM = 'g';

/** Compact wire shape. Short keys because this ends up in a pasted link. */
type WireSlot = {
  r?: number;        // role index into ROLE_ORDER, absent means any
  t: number;         // dollar target
  p?: string;        // pinned vehicle id
  m?: number;        // mileage ceiling, absent means the default
  f?: Partial<Record<keyof Filters, unknown>>; // only non-default filters
};

type Wire = {
  v: number;
  b: number;         // budget
  s: WireSlot[];
  n?: string;        // optional label
};

// ---------------------------------------------------------------- base64url

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------- encode

function diffFilters(f: Filters): WireSlot['f'] {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]) {
    if (JSON.stringify(f[key]) !== JSON.stringify(DEFAULT_FILTERS[key])) out[key] = f[key];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function encodeGarage(state: GarageState, title?: string): string {
  const wire: Wire = {
    v: VERSION,
    b: Math.round(state.budget),
    s: state.slots.map((slot): WireSlot => {
      const w: WireSlot = { t: Math.round(slot.target) };
      const roleIdx = slot.role ? ROLE_ORDER.indexOf(slot.role) : -1;
      if (roleIdx >= 0) w.r = roleIdx;
      if (slot.pinned && slot.pick) w.p = slot.pick;
      if (slot.maxMiles !== DEFAULT_MAX_MILES) w.m = slot.maxMiles;
      const f = diffFilters(slot.filters);
      if (f) w.f = f;
      return w;
    }),
  };
  if (title) wire.n = title;
  return `${VERSION}.${toBase64Url(JSON.stringify(wire))}`;
}

// ---------------------------------------------------------------- decode

let slotSeq = 0;

/**
 * Tolerant by design. Anything unreadable falls back to a sane default rather
 * than throwing, because a half-open garage beats a dead link.
 */
export function decodeGarage(raw: string | null | undefined): GarageState | null {
  if (!raw) return null;

  const dot = raw.indexOf('.');
  if (dot < 0) return null;
  const version = Number(raw.slice(0, dot));
  if (!Number.isFinite(version) || version < 1) return null;
  // Future versions are not rejected: read what this build understands.

  let wire: Wire;
  try {
    wire = JSON.parse(fromBase64Url(raw.slice(dot + 1))) as Wire;
  } catch {
    return null;
  }
  if (!wire || typeof wire !== 'object' || !Array.isArray(wire.s)) return null;

  const budget = clampNumber(wire.b, MIN_SLOT, 2_000_000, 50_000);

  const slots: SlotState[] = wire.s.slice(0, 5).map((w): SlotState => {
    const role: Role | null =
      typeof w?.r === 'number' && w.r >= 0 && w.r < ROLE_ORDER.length ? ROLE_ORDER[w.r]! : null;

    const filters: Filters = { ...DEFAULT_FILTERS };
    if (w?.f && typeof w.f === 'object') {
      for (const key of Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]) {
        const incoming = (w.f as Record<string, unknown>)[key];
        if (incoming === undefined) continue;
        const shape = DEFAULT_FILTERS[key];
        if (Array.isArray(shape) && Array.isArray(incoming)) {
          (filters[key] as unknown) = incoming.filter((x) => typeof x === 'string');
        } else if (typeof shape === 'number' && typeof incoming === 'number' && Number.isFinite(incoming)) {
          (filters[key] as unknown) = incoming;
        }
        // Anything else is from a shape this build does not know. Ignore it.
      }
    }

    return {
      id: `slot-r${++slotSeq}`,
      role,
      target: clampNumber(w?.t, 0, 2_000_000, MIN_SLOT),
      pinned: typeof w?.p === 'string' && w.p.length > 0,
      pick: typeof w?.p === 'string' && w.p.length > 0 ? w.p : null,
      maxMiles: clampNumber(w?.m, 0, 400_000, DEFAULT_MAX_MILES),
      filters,
    };
  });

  if (slots.length === 0) return null;
  return { budget, slots };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

// ---------------------------------------------------------------- browser

export function readGarageFromLocation(search = window.location.search): GarageState | null {
  return decodeGarage(new URLSearchParams(search).get(STATE_PARAM));
}

/**
 * Written with replaceState and debounced by the caller, so the back button
 * still means "back" rather than "undo one slider tick".
 */
export function writeGarageToLocation(state: GarageState): void {
  const params = new URLSearchParams(window.location.search);
  params.set(STATE_PARAM, encodeGarage(state));
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

export function shareUrlFor(state: GarageState, origin = window.location.origin + window.location.pathname): string {
  return `${origin}?${STATE_PARAM}=${encodeGarage(state)}`;
}

/**
 * A challenge inherits the budget and the slot roles but none of the picks.
 * That fairness is why the loop works: an open-ended "build a garage" is a
 * blank page, while "you have this money and these jobs to cover, do better"
 * is a game with a move to make.
 */
export function challengeFrom(state: GarageState): GarageState {
  return {
    budget: state.budget,
    slots: state.slots.map((slot) => ({
      ...slot,
      id: `slot-c${++slotSeq}`,
      pinned: false,
      pick: null,
    })),
  };
}
