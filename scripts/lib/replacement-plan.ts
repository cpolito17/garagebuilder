import type { VehicleImage } from '../../src/data/images';
import {
  exclusionMatches, sourceIdentity, titleFromSourceUrl,
} from './source-identity';

export type ReplacementPlan = {
  preserved: VehicleImage[];
  previousIdentities: Set<string>;
  freeSlots: number[];
};

export function replacementPlan(
  installed: VehicleImage[],
  exclusions: string[],
  slotCount = 3,
): ReplacementPlan {
  const isExcluded = (image: VehicleImage) => exclusions.some((value) =>
    exclusionMatches(value, titleFromSourceUrl(image.sourceUrl) ?? '', image.sourceUrl));
  const preserved = installed.filter((image) => !isExcluded(image));
  const previousIdentities = new Set(installed.map((image) => sourceIdentity(image.sourceUrl)));
  const occupied = new Set(preserved.map((image) => {
    const match = image.file.match(/-(\d+)\.(?:jpe?g|png)$/i);
    return match ? Number(match[1]) : -1;
  }));
  const freeSlots = Array.from({ length: slotCount }, (_, index) => index)
    .filter((index) => !occupied.has(index));
  return { preserved, previousIdentities, freeSlots };
}

export function isNewSource(sourceUrl: string, plan: ReplacementPlan): boolean {
  return !plan.previousIdentities.has(sourceIdentity(sourceUrl));
}
