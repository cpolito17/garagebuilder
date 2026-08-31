import { describe, expect, it } from 'vitest';
import type { VehicleImage } from '../../src/data/images';
import { isNewSource, replacementPlan } from './replacement-plan';

const image = (slot: number, sourceUrl: string): VehicleImage => ({
  file: `car-${slot}.jpg`,
  width: 960,
  height: 640,
  licence: 'cc0',
  author: 'Photographer',
  sourceUrl,
  alt: 'A car',
});

describe('replacement rounds', () => {
  const approved = image(0, 'https://example.com/photos/approved');
  const rejected = image(1, 'https://example.com/photos/rejected');
  const gallery = image(2, 'https://example.com/photos/gallery');

  it('keeps approved slots and opens only rejected slots', () => {
    const plan = replacementPlan(
      [approved, rejected, gallery],
      ['url:https://example.com/photos/rejected'],
    );
    expect(plan.preserved.map((entry) => entry.file)).toEqual(['car-0.jpg', 'car-2.jpg']);
    expect(plan.freeSlots).toEqual([1, 3]);
  });

  it('rejects every source seen in the previous round as not new', () => {
    const plan = replacementPlan([approved, rejected, gallery], []);
    expect(isNewSource(approved.sourceUrl, plan)).toBe(false);
    expect(isNewSource(rejected.sourceUrl, plan)).toBe(false);
    expect(isNewSource('https://example.com/photos/new', plan)).toBe(true);
  });

  it('opens all slots when the whole set was rejected', () => {
    const plan = replacementPlan(
      [approved, rejected, gallery],
      [approved.sourceUrl, rejected.sourceUrl, gallery.sourceUrl]
        .map((url) => `url:${url}`),
    );
    expect(plan.preserved).toEqual([]);
    expect(plan.freeSlots).toEqual([0, 1, 2, 3]);
  });
});
