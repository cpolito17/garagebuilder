import { describe, it, expect } from 'vitest';
import { encodeGarage, decodeGarage, challengeFrom, shareUrlFor } from './urlState';
import { initialGarage, pinSlot, setSlotFilters, setSlotOdometer, DEFAULT_ODOMETER, MAX_ODOMETER, MIN_SLOT } from '../state/garage';
import { DEFAULT_FILTERS } from './matching';
import { CATALOG } from '../data/catalog';

const sameGarage = (a: ReturnType<typeof initialGarage>, b: ReturnType<typeof initialGarage>) => {
  expect(b.budget).toBe(a.budget);
  expect(b.slots).toHaveLength(a.slots.length);
  a.slots.forEach((slot, i) => {
    const got = b.slots[i]!;
    expect(got.role, `slot ${i} role`).toBe(slot.role);
    expect(got.target, `slot ${i} target`).toBe(slot.target);
    expect(got.pick, `slot ${i} pick`).toBe(slot.pick);
    expect(got.pinned, `slot ${i} pinned`).toBe(slot.pinned);
    expect(got.odometer, `slot ${i} odometer`).toBe(slot.odometer);
    expect(got.filters, `slot ${i} filters`).toEqual(slot.filters);
  });
};

describe('round trip', () => {
  it('survives a plain garage', () => {
    const g = initialGarage(50_000, 3);
    sameGarage(g, decodeGarage(encodeGarage(g))!);
  });

  it('survives every slot count', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const g = initialGarage(37_500, n);
      sameGarage(g, decodeGarage(encodeGarage(g))!);
    }
  });

  it('survives pins, filters and odometers together', () => {
    let g = initialGarage(60_000, 4);
    g = pinSlot(g, g.slots[0]!.id, 'mazda-mx5-nc', 14_000);
    g = setSlotOdometer(g, g.slots[1]!.id, 200_000);
    g = setSlotFilters(g, g.slots[2]!.id, {
      ...DEFAULT_FILTERS, transmissions: ['manual'], drivetrains: ['RWD'], minSeats: 4, minYear: 2005,
    });
    sameGarage(g, decodeGarage(encodeGarage(g))!);
  });
});

describe('link length', () => {
  it('keeps a typical four slot garage short enough to paste', () => {
    let g = initialGarage(50_000, 4);
    g = pinSlot(g, g.slots[0]!.id, 'mazda-mx5-nc', 14_000);
    g = pinSlot(g, g.slots[1]!.id, 'toyota-4runner-n280', 18_000);
    expect(encodeGarage(g).length).toBeLessThan(400);
  });

  it('does not pay for values that are already the default', () => {
    const plain = initialGarage(50_000, 3);
    let heavy = initialGarage(50_000, 3);
    heavy = setSlotOdometer(heavy, heavy.slots[0]!.id, 250_000);
    heavy = setSlotFilters(heavy, heavy.slots[1]!.id, { ...DEFAULT_FILTERS, bodyStyles: ['coupe', 'wagon'] });
    expect(encodeGarage(plain).length).toBeLessThan(encodeGarage(heavy).length);
  });
});

describe('a link must open forever', () => {
  it('returns null for junk rather than throwing', () => {
    for (const bad of ['', 'nonsense', '1.', '1.@@@@', 'x.abc', '....', '1.' + btoa('not json')]) {
      expect(() => decodeGarage(bad)).not.toThrow();
      expect(decodeGarage(bad)).toBeNull();
    }
    expect(decodeGarage(null)).toBeNull();
    expect(decodeGarage(undefined)).toBeNull();
  });

  it('reads a payload written by a newer version instead of rejecting it', () => {
    const g = initialGarage(45_000, 2);
    const encoded = encodeGarage(g);
    const fromFuture = encoded.replace(/^1\./, '7.');
    const back = decodeGarage(fromFuture);
    expect(back).not.toBeNull();
    expect(back!.budget).toBe(45_000);
  });

  it('ignores fields a future version added', () => {
    const wire = { v: 1, b: 30_000, s: [{ t: 30_000, r: 0, zzz: 'unknown' }], future: { nested: true } };
    const raw = '1.' + btoa(JSON.stringify(wire)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const back = decodeGarage(raw);
    expect(back).not.toBeNull();
    expect(back!.slots).toHaveLength(1);
    expect(back!.slots[0]!.role).toBe('sports');
  });

  it('fills in fields an older version omitted', () => {
    const wire = { v: 1, b: 25_000, s: [{ t: 25_000 }] };
    const raw = '1.' + btoa(JSON.stringify(wire)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const back = decodeGarage(raw)!;
    expect(back.slots[0]!.role).toBeNull();
    expect(back.slots[0]!.odometer).toBe(DEFAULT_ODOMETER);
    expect(back.slots[0]!.filters).toEqual(DEFAULT_FILTERS);
  });

  it('clamps hostile numbers instead of trusting them', () => {
    const wire = { v: 1, b: 9e12, s: [{ t: -5000, m: 9e9 }, { t: 1e12 }] };
    const raw = '1.' + btoa(JSON.stringify(wire)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const back = decodeGarage(raw)!;
    expect(back.budget).toBeLessThanOrEqual(2_000_000);
    expect(back.slots[0]!.target).toBeGreaterThanOrEqual(0);
    expect(back.slots[0]!.odometer).toBeLessThanOrEqual(MAX_ODOMETER);
  });

  it('caps the slot count so a crafted link cannot render a hundred columns', () => {
    const wire = { v: 1, b: 50_000, s: Array.from({ length: 80 }, () => ({ t: 1000 })) };
    const raw = '1.' + btoa(JSON.stringify(wire)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeGarage(raw)!.slots.length).toBeLessThanOrEqual(5);
  });

  it('references vehicles by stable id, never by catalog position', () => {
    // Catalog indices shift whenever a record is authored. If an index leaked
    // into the wire format, every shared link would silently repoint.
    let g = initialGarage(40_000, 2);
    g = pinSlot(g, g.slots[0]!.id, 'porsche-boxster-986', 15_000);
    const encoded = encodeGarage(g);
    expect(encoded).toBeTruthy();
    const decoded = decodeGarage(encoded)!;
    expect(decoded.slots[0]!.pick).toBe('porsche-boxster-986');
    expect(CATALOG.some((v) => v.id === decoded.slots[0]!.pick)).toBe(true);
  });

  it('keeps a pick that is no longer in the catalog rather than dropping it silently', () => {
    const wire = { v: 1, b: 30_000, s: [{ t: 30_000, p: 'retired-vehicle-id' }] };
    const raw = '1.' + btoa(JSON.stringify(wire)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const back = decodeGarage(raw)!;
    expect(back.slots[0]!.pick).toBe('retired-vehicle-id');
  });
});

describe('the challenge', () => {
  it('inherits the budget and the slot roles', () => {
    let g = initialGarage(55_000, 4);
    g = pinSlot(g, g.slots[0]!.id, 'mazda-mx5-nc', 12_000);
    const c = challengeFrom(g);
    expect(c.budget).toBe(g.budget);
    expect(c.slots.map((s) => s.role)).toEqual(g.slots.map((s) => s.role));
  });

  it('inherits none of the picks, so the challenger starts empty', () => {
    let g = initialGarage(55_000, 3);
    g = pinSlot(g, g.slots[0]!.id, 'mazda-mx5-nc', 12_000);
    g = pinSlot(g, g.slots[1]!.id, 'toyota-4runner-n280', 20_000);
    const c = challengeFrom(g);
    expect(c.slots.every((s) => s.pick === null)).toBe(true);
    expect(c.slots.every((s) => !s.pinned)).toBe(true);
  });

  it('gives challenger slots their own ids', () => {
    const g = initialGarage(30_000, 3);
    const c = challengeFrom(g);
    expect(new Set(c.slots.map((s) => s.id)).size).toBe(3);
    expect(c.slots.map((s) => s.id)).not.toEqual(g.slots.map((s) => s.id));
  });

  it('resets private mileage, filter, and allocation choices', () => {
    const g = initialGarage(40_000, 2);
    g.slots[0]!.odometer = 42_000;
    g.slots[0]!.filters = { ...g.slots[0]!.filters, minYear: 2020, minSeats: 7 };
    g.slots[0]!.target = 35_000;
    const c = challengeFrom(g);
    expect(c.slots[0]!.odometer).toBe(DEFAULT_ODOMETER);
    expect(c.slots[0]!.filters.minYear).toBe(1990);
    expect(c.slots[0]!.filters.minSeats).not.toBe(7);
    expect(c.slots.reduce((sum, slot) => sum + slot.target, 0)).toBe(c.budget);
  });
});

describe('share url', () => {
  it('builds an absolute link carrying the whole garage', () => {
    const g = initialGarage(50_000, 2);
    const url = shareUrlFor(g, 'https://example.test/');
    expect(url.startsWith('https://example.test/?g=')).toBe(true);
    const encoded = new URL(url).searchParams.get('g');
    expect(decodeGarage(encoded)!.budget).toBe(50_000);
  });

  it('produces a url safe payload with no characters needing escaping', () => {
    let g = initialGarage(50_000, 5);
    g = pinSlot(g, g.slots[0]!.id, 'mazda-mx5-nc', 12_000);
    const encoded = encodeGarage(g);
    expect(encoded).toMatch(/^[0-9]+\.[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(encoded)).toBe(encoded);
  });
});

describe('slot floor', () => {
  it('never decodes a slot below zero dollars', () => {
    const g = initialGarage(20_000, 2);
    const back = decodeGarage(encodeGarage(g))!;
    for (const s of back.slots) expect(s.target).toBeGreaterThanOrEqual(0);
    expect(MIN_SLOT).toBeGreaterThan(0);
  });
});
