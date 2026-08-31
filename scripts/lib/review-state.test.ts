import { describe, expect, it } from 'vitest';
import type { VehicleImage } from '../../src/data/images';
import {
  assignRole, completeVehicle, emptyReviewProgress, normaliseReviewProgress,
  selectedImages, selectionCount,
} from './review-state';
import { sourceIdentity } from './source-identity';

const image = (name: string): VehicleImage => ({
  file: `${name}.jpg`, width: 960, height: 640, licence: 'cc0', author: 'A',
  sourceUrl: `https://example.com/${name}`, alt: name,
});
const images = ['a', 'b', 'c', 'd', 'e'].map(image);

describe('candidate-library review state', () => {
  it('assigns exactly one image to each role', () => {
    let state = emptyReviewProgress();
    state = assignRole(state, 'car', images[0]!.sourceUrl, 'hero');
    state = assignRole(state, 'car', images[1]!.sourceUrl, 'hero');
    state = assignRole(state, 'car', images[2]!.sourceUrl, 'extra1');
    expect(selectedImages(images, state, 'car').map((entry) => entry.file))
      .toEqual(['b.jpg', 'c.jpg']);
  });

  it('orders the four selected slots for the site manifest', () => {
    let state = emptyReviewProgress();
    state = assignRole(state, 'car', images[3]!.sourceUrl, 'interior');
    state = assignRole(state, 'car', images[2]!.sourceUrl, 'extra2');
    state = assignRole(state, 'car', images[0]!.sourceUrl, 'hero');
    state = assignRole(state, 'car', images[1]!.sourceUrl, 'extra1');
    expect(selectedImages(images, state, 'car').map((entry) => entry.file))
      .toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);
    expect(selectionCount(images, state, 'car')).toBe(4);
  });

  it('marks a vehicle incomplete when a selection is edited', () => {
    let state = completeVehicle(emptyReviewProgress(), 'car');
    state = assignRole(state, 'car', images[0]!.sourceUrl, 'hero');
    expect(state.vehicles.car!.completed).toBe(false);
  });

  it('replaces a role inherited from the existing site manifest', () => {
    const fallbacks = new Map([[sourceIdentity(images[0]!.sourceUrl), 'hero' as const]]);
    const state = assignRole(emptyReviewProgress(), 'car', images[1]!.sourceUrl, 'hero', fallbacks);
    expect(selectedImages(images, state, 'car', fallbacks).map((entry) => entry.file))
      .toEqual(['b.jpg']);
  });

  it('migrates old keep and reject decisions to unselected', () => {
    const state = normaliseReviewProgress({ version: 1, vehicles: { car: {
      completed: true, decisions: { a: 'hero', b: 'keep', c: 'reject' },
    } } });
    expect(state.version).toBe(2);
    expect(state.vehicles.car).toEqual({
      completed: true, decisions: { a: 'hero', b: 'unselected', c: 'unselected' },
    });
  });
});
