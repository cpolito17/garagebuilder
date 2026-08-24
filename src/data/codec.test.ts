import { describe, it, expect } from 'vitest';
import { encodeCatalog, decodeCatalog } from './codec';
import { CATALOG } from './catalog';

describe('catalog codec', () => {
  it('round-trips every record without loss', () => {
    const back = decodeCatalog(encodeCatalog(CATALOG));
    expect(back).toHaveLength(CATALOG.length);
    // Deep equality across the whole catalog, so any field the encoder forgets
    // or the decoder mis-orders fails here rather than in the interface.
    expect(back).toEqual(CATALOG);
  });

  it('preserves absent optional measurements as null, not zero', () => {
    const withNulls = CATALOG.filter((v) => v.spec.towingLb === null);
    expect(withNulls.length).toBeGreaterThan(0);
    const back = decodeCatalog(encodeCatalog(CATALOG));
    for (const v of withNulls) {
      expect(back.find((x) => x.id === v.id)!.spec.towingLb, v.id).toBeNull();
    }
  });

  it('keeps a zero-value measurement distinct from an absent one', () => {
    const zeroCargo = CATALOG.filter((v) => v.spec.cargoCuFt === 0);
    const back = decodeCatalog(encodeCatalog(CATALOG));
    for (const v of zeroCargo) {
      expect(back.find((x) => x.id === v.id)!.spec.cargoCuFt, v.id).toBe(0);
    }
  });

  it('carries msrpNew only for current vehicles', () => {
    const back = decodeCatalog(encodeCatalog(CATALOG));
    for (const v of back) {
      if (v.status === 'current') expect(v.pricing.msrpNew, v.id).toBeGreaterThan(0);
      else expect(v.pricing.msrpNew, v.id).toBeUndefined();
    }
  });

  it('preserves role and transmission sets exactly, including order', () => {
    const back = decodeCatalog(encodeCatalog(CATALOG));
    for (const v of CATALOG) {
      const b = back.find((x) => x.id === v.id)!;
      expect(new Set(b.roles), v.id).toEqual(new Set(v.roles));
      expect(new Set(b.spec.transmissions), v.id).toEqual(new Set(v.spec.transmissions));
    }
  });

  it('is meaningfully smaller than the object form', () => {
    const packed = JSON.stringify(encodeCatalog(CATALOG)).length;
    const plain = JSON.stringify(CATALOG).length;
    expect(packed).toBeLessThan(plain * 0.5);
  });

  it('rejects a role the format has no slot for', () => {
    const bad = structuredClone(CATALOG[0]!);
    (bad.roles as string[]) = ['not-a-role'];
    expect(() => encodeCatalog([bad])).toThrow(/unknown role/);
  });
});
