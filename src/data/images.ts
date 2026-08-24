/**
 * Vehicle photography. docs/DATA-MODEL.md section 7.
 *
 * Photographs are fetched, not authored, so they live in a manifest produced
 * by scripts/fetch-images.ts rather than in the catalog records. The app reads
 * the manifest and falls back to the typographic identity band for any vehicle
 * that has no photo yet, so the catalog and the image set can grow apart
 * without either blocking the other.
 *
 * Every file carries its licence. `redistributable` is the gate for the share
 * card, which distributes whatever it contains and is therefore the surface
 * where informal reuse stops being defensible.
 */

export type ImageLicence =
  | 'cc0'        // public domain dedication, no attribution required
  | 'pd'         // public domain by age or author release
  | 'cc-by'      // attribution required
  | 'cc-by-sa';  // attribution required, share-alike

/** Licences whose terms we can satisfy inside a rendered share image. */
export const SHARE_SAFE: ImageLicence[] = ['cc0', 'pd'];

export type VehicleImage = {
  /** Filename under /vehicles, e.g. "mazda-mx5-nc-0.jpg" */
  file: string;
  width: number;
  height: number;
  /** Same image at 2x for dense displays, when available. */
  file2x?: string;
  licence: ImageLicence;
  author: string;
  /** Page the file came from, for the attribution link. */
  sourceUrl: string;
  /** Descriptive alt text built from the vehicle identity. */
  alt: string;
};

export type ImageManifest = Record<string, VehicleImage[]>;

/**
 * Attribution requirements are a property of the licence, not a judgement
 * call, so they are derived rather than stored.
 */
export function requiresAttribution(licence: ImageLicence): boolean {
  return licence === 'cc-by' || licence === 'cc-by-sa';
}

export function isShareSafe(image: VehicleImage): boolean {
  return SHARE_SAFE.includes(image.licence);
}

export const LICENCE_LABEL: Record<ImageLicence, string> = {
  cc0: 'CC0',
  pd: 'Public domain',
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
};

export const LICENCE_URL: Record<ImageLicence, string | null> = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  pd: null,
  'cc-by': 'https://creativecommons.org/licenses/by/4.0/',
  'cc-by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

/** One line of credit, in the form the licences ask for. */
export function creditLine(image: VehicleImage): string {
  const lic = LICENCE_LABEL[image.licence];
  if (!requiresAttribution(image.licence)) return `${image.author || 'Unknown'}, ${lic}`;
  return `${image.author || 'Unknown'}, ${lic}, via Wikimedia Commons`;
}

// ---------------------------------------------------------------- manifest

import manifest from './generated/images.json';

const MANIFEST = manifest as ImageManifest;

export function heroFor(vehicleId: string): VehicleImage | undefined {
  return MANIFEST[vehicleId]?.[0];
}

export function galleryFor(vehicleId: string): VehicleImage[] {
  return MANIFEST[vehicleId] ?? [];
}

export function hasPhotos(vehicleId: string): boolean {
  return (MANIFEST[vehicleId]?.length ?? 0) > 0;
}

/** Every credited image in the manifest, for the licences page. */
export function allCredits(): { vehicleId: string; image: VehicleImage }[] {
  return Object.entries(MANIFEST).flatMap(([vehicleId, images]) =>
    images.map((image) => ({ vehicleId, image })),
  );
}

export const PHOTO_COUNT = Object.values(MANIFEST).reduce((a, l) => a + l.length, 0);
export const PHOTO_VEHICLE_COUNT = Object.keys(MANIFEST).length;
