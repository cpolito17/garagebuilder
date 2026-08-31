import type { VehicleImage } from '../../src/data/images';
import { sourceIdentity } from './source-identity';

export const REVIEW_ROLES = ['hero', 'interior', 'extra1', 'extra2'] as const;
export type ReviewRole = typeof REVIEW_ROLES[number];
export type ReviewDecision = ReviewRole | 'unselected';

export type ReviewProgress = {
  version: 2;
  vehicles: Record<string, {
    completed: boolean;
    decisions: Record<string, ReviewDecision>;
  }>;
};

export const emptyReviewProgress = (): ReviewProgress => ({ version: 2, vehicles: {} });

/** Keep useful choices from the previous round-based state file. */
export function normaliseReviewProgress(value: unknown): ReviewProgress {
  if (!value || typeof value !== 'object') return emptyReviewProgress();
  const raw = value as { vehicles?: Record<string, { completed?: boolean; decisions?: Record<string, string> }> };
  const vehicles: ReviewProgress['vehicles'] = {};
  for (const [vehicleId, state] of Object.entries(raw.vehicles ?? {})) {
    const decisions: Record<string, ReviewDecision> = {};
    for (const [identity, decision] of Object.entries(state.decisions ?? {})) {
      decisions[identity] = REVIEW_ROLES.includes(decision as ReviewRole)
        ? decision as ReviewRole
        : 'unselected';
    }
    vehicles[vehicleId] = { completed: Boolean(state.completed), decisions };
  }
  return { version: 2, vehicles };
}

export function roleFor(
  progress: ReviewProgress,
  vehicleId: string,
  image: VehicleImage,
  fallback: ReviewDecision = 'unselected',
): ReviewDecision {
  return progress.vehicles[vehicleId]?.decisions[sourceIdentity(image.sourceUrl)] ?? fallback;
}

export function assignRole(
  progress: ReviewProgress,
  vehicleId: string,
  sourceUrl: string,
  role: ReviewDecision,
  fallbacks: Map<string, ReviewDecision> = new Map(),
): ReviewProgress {
  const current = progress.vehicles[vehicleId] ?? { completed: false, decisions: {} };
  const decisions = { ...current.decisions };
  const identity = sourceIdentity(sourceUrl);

  // One image per role and one role per image.
  if (role !== 'unselected') {
    for (const [otherIdentity, fallbackRole] of fallbacks) {
      if ((decisions[otherIdentity] ?? fallbackRole) === role) decisions[otherIdentity] = 'unselected';
    }
    for (const [otherIdentity, otherRole] of Object.entries(decisions)) {
      if (otherRole === role) decisions[otherIdentity] = 'unselected';
    }
  }
  decisions[identity] = role;
  return {
    version: 2,
    vehicles: {
      ...progress.vehicles,
      [vehicleId]: { completed: false, decisions },
    },
  };
}

export function selectedByRole(
  images: VehicleImage[],
  progress: ReviewProgress,
  vehicleId: string,
  fallbacks: Map<string, ReviewDecision> = new Map(),
): Partial<Record<ReviewRole, VehicleImage>> {
  const selected: Partial<Record<ReviewRole, VehicleImage>> = {};
  for (const image of images) {
    const identity = sourceIdentity(image.sourceUrl);
    const role = roleFor(progress, vehicleId, image, fallbacks.get(identity) ?? 'unselected');
    if (role !== 'unselected' && selected[role] === undefined) selected[role] = image;
  }
  return selected;
}

export function selectedImages(
  images: VehicleImage[],
  progress: ReviewProgress,
  vehicleId: string,
  fallbacks: Map<string, ReviewDecision> = new Map(),
): VehicleImage[] {
  const selected = selectedByRole(images, progress, vehicleId, fallbacks);
  return [selected.hero, selected.extra1, selected.extra2, selected.interior]
    .filter((image): image is VehicleImage => image !== undefined);
}

export function selectionCount(
  images: VehicleImage[],
  progress: ReviewProgress,
  vehicleId: string,
  fallbacks: Map<string, ReviewDecision> = new Map(),
): number {
  return Object.keys(selectedByRole(images, progress, vehicleId, fallbacks)).length;
}

export function completeVehicle(progress: ReviewProgress, vehicleId: string): ReviewProgress {
  const current = progress.vehicles[vehicleId] ?? { completed: false, decisions: {} };
  return {
    version: 2,
    vehicles: { ...progress.vehicles, [vehicleId]: { ...current, completed: true } },
  };
}
