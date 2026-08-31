import type { ImageManifest, VehicleImage } from '../../src/data/images';
import { sourceIdentity } from './source-identity';

export type ReviewDecision = 'keep' | 'reject' | 'hero' | 'interior';

export type ReviewProgress = {
  version: 1;
  vehicles: Record<string, {
    completed: boolean;
    decisions: Record<string, ReviewDecision>;
  }>;
};

export const emptyReviewProgress = (): ReviewProgress => ({ version: 1, vehicles: {} });

export function defaultDecision(index: number): ReviewDecision {
  if (index === 0) return 'hero';
  if (index === 3) return 'interior';
  return 'keep';
}

export function decisionFor(
  progress: ReviewProgress,
  vehicleId: string,
  image: VehicleImage,
  index: number,
): ReviewDecision {
  const decisions = progress.vehicles[vehicleId]?.decisions ?? {};
  const saved = decisions[sourceIdentity(image.sourceUrl)];
  if (saved) return saved;
  const fallback = defaultDecision(index);
  if ((fallback === 'hero' || fallback === 'interior') && Object.values(decisions).includes(fallback)) {
    return 'keep';
  }
  return fallback;
}

export function setDecision(
  progress: ReviewProgress,
  vehicleId: string,
  sourceUrl: string,
  decision: ReviewDecision,
): ReviewProgress {
  const current = progress.vehicles[vehicleId] ?? { completed: false, decisions: {} };
  const decisions = { ...current.decisions };
  if (decision === 'hero' || decision === 'interior') {
    for (const [identity, value] of Object.entries(decisions)) {
      if (value === decision) decisions[identity] = 'keep';
    }
  }
  decisions[sourceIdentity(sourceUrl)] = decision;
  return {
    version: 1,
    vehicles: {
      ...progress.vehicles,
      [vehicleId]: { completed: false, decisions },
    },
  };
}

export function completeVehicle(progress: ReviewProgress, vehicleId: string): ReviewProgress {
  const current = progress.vehicles[vehicleId] ?? { completed: false, decisions: {} };
  return {
    version: 1,
    vehicles: {
      ...progress.vehicles,
      [vehicleId]: { ...current, completed: true },
    },
  };
}

export function orderedKeptImages(
  manifest: ImageManifest,
  progress: ReviewProgress,
  vehicleId: string,
): VehicleImage[] {
  const images = manifest[vehicleId] ?? [];
  const entries = images.map((image, index) => ({
    image,
    decision: decisionFor(progress, vehicleId, image, index),
    index,
  })).filter((entry) => entry.decision !== 'reject');

  const hero = entries.find((entry) => entry.decision === 'hero') ?? entries[0];
  const interior = entries.find((entry) => entry.decision === 'interior' && entry !== hero);
  return [
    ...(hero ? [hero.image] : []),
    ...entries.filter((entry) => entry !== hero && entry !== interior).map((entry) => entry.image),
    ...(interior ? [interior.image] : []),
  ];
}

export function reviewStats(manifest: ImageManifest, progress: ReviewProgress) {
  let approved = 0;
  let rejected = 0;
  let completedVehicles = 0;
  for (const [vehicleId, images] of Object.entries(manifest)) {
    if (progress.vehicles[vehicleId]?.completed) completedVehicles++;
    images.forEach((image, index) => {
      if (decisionFor(progress, vehicleId, image, index) === 'reject') rejected++;
      else approved++;
    });
  }
  return {
    approved,
    rejected,
    completedVehicles,
    totalVehicles: Object.keys(manifest).length,
  };
}
