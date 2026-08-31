import { describe, expect, it } from 'vitest';
import type { ImageManifest, VehicleImage } from '../../src/data/images';
import {
  completeVehicle, decisionFor, emptyReviewProgress, orderedKeptImages,
  reviewStats, setDecision,
} from './review-state';

const image = (name: string): VehicleImage => ({
  file: `${name}.jpg`, width: 960, height: 640, licence: 'cc0', author: 'A',
  sourceUrl: `https://example.com/${name}`, alt: name,
});
const manifest: ImageManifest = { car: ['a', 'b', 'c', 'd'].map(image) };

describe('contact-sheet review state', () => {
  it('defaults the first image to hero, fourth to interior, and keeps the rest', () => {
    const state = emptyReviewProgress();
    expect(manifest.car!.map((entry, index) => decisionFor(state, 'car', entry, index)))
      .toEqual(['hero', 'keep', 'keep', 'interior']);
  });

  it('allows only one explicit hero and one explicit interior', () => {
    let state = setDecision(emptyReviewProgress(), 'car', manifest.car![1]!.sourceUrl, 'hero');
    state = setDecision(state, 'car', manifest.car![2]!.sourceUrl, 'hero');
    expect(decisionFor(state, 'car', manifest.car![1]!, 1)).toBe('keep');
    expect(decisionFor(state, 'car', manifest.car![2]!, 2)).toBe('hero');
  });

  it('orders hero first and interior last while dropping rejects', () => {
    let state = setDecision(emptyReviewProgress(), 'car', manifest.car![2]!.sourceUrl, 'hero');
    state = setDecision(state, 'car', manifest.car![1]!.sourceUrl, 'reject');
    state = setDecision(state, 'car', manifest.car![3]!.sourceUrl, 'interior');
    expect(orderedKeptImages(manifest, state, 'car').map((entry) => entry.file))
      .toEqual(['c.jpg', 'a.jpg', 'd.jpg']);
  });

  it('tracks saved vehicles and image totals', () => {
    let state = setDecision(emptyReviewProgress(), 'car', manifest.car![1]!.sourceUrl, 'reject');
    state = completeVehicle(state, 'car');
    expect(reviewStats(manifest, state)).toEqual({
      approved: 3, rejected: 1, completedVehicles: 1, totalVehicles: 1,
    });
  });
});
