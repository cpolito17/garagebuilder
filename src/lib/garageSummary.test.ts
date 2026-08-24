import { describe, it, expect } from 'vitest';
import { summarise } from './garageSummary';
import { CATALOG } from '../data/catalog';

const pick = (id: string) => {
  const v = CATALOG.find((x) => x.id === id);
  if (!v) throw new Error(`missing fixture vehicle ${id}`);
  return v;
};

describe('garage summary', () => {
  it('reports a gap the garage genuinely has', () => {
    // Two two-seat sports cars cannot carry four people or tow anything.
    const s = summarise([pick('mazda-mx5-nc'), pick('honda-s2000-ap')]);
    const gapIds = s.gaps.map((g) => g.id);
    expect(gapIds).toContain('four-up');
    expect(gapIds).toContain('tow');
    expect(gapIds).toContain('snow');
  });

  it('reports a capability once any pick covers it', () => {
    const s = summarise([pick('mazda-mx5-nc'), pick('toyota-4runner-n280')]);
    const capIds = s.capabilities.map((c) => c.id);
    expect(capIds).toContain('tow');
    expect(capIds).toContain('snow');
    expect(capIds).toContain('unpaved');
    expect(s.capabilities.find((c) => c.id === 'tow')!.satisfiedBy).toEqual(['toyota-4runner-n280']);
  });

  it('names an overlap when two picks answer the same question', () => {
    const s = summarise([pick('mazda-mx5-nc'), pick('mazda-mx5-nd')]);
    expect(s.overlaps).toHaveLength(1);
    expect(s.overlaps[0]!.shared).toMatch(/RWD convertible/);
  });

  it('does not invent an overlap between genuinely different cars', () => {
    const s = summarise([pick('mazda-mx5-nc'), pick('toyota-sienna-xl30'), pick('toyota-4runner-n280')]);
    expect(s.overlaps).toHaveLength(0);
  });

  it('adds up running costs across the set', () => {
    const a = pick('mazda-mx5-nc');
    const b = pick('bmw-7-series-f01');
    const s = summarise([a, b]);
    expect(s.annualMaintenanceUsd).toBe(
      a.ownership.annualMaintenanceUsd + b.ownership.annualMaintenanceUsd);
    expect(s.annualFuelUsd).toBeGreaterThan(1000);
  });

  it('costs an electric car through MPGe rather than as petrol', () => {
    const ev = summarise([pick('tesla-model3')]).annualFuelUsd;
    const petrol = summarise([pick('bmw-7-series-f01')]).annualFuelUsd;
    expect(ev).toBeLessThan(petrol / 2);
  });

  it('counts three pedals only where a manual is offered', () => {
    expect(summarise([pick('honda-s2000-ap')]).pedals).toBe(3);
    expect(summarise([pick('lexus-ls460-xf40')]).pedals).toBe(2);
  });

  it('counts distinct countries of origin', () => {
    expect(summarise([pick('mazda-mx5-nc'), pick('toyota-4runner-n280')]).countries).toBe(1);
    expect(summarise([pick('mazda-mx5-nc'), pick('bmw-m3-e46'), pick('ford-f150-13th')]).countries).toBe(3);
  });

  it('handles an empty garage without throwing', () => {
    const s = summarise([]);
    expect(s.gaps.length).toBeGreaterThan(0);
    expect(s.annualFuelUsd).toBe(0);
  });
});
