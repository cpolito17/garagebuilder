import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allCredits } from './images';

const VEHICLE_DIR = fileURLToPath(new URL('../../public/vehicles/', import.meta.url));

describe('photo manifest', () => {
  it('ships every image file referenced by an attribution record', () => {
    const missing = allCredits().flatMap(({ vehicleId, image }) => {
      const files = image.file2x ? [image.file, image.file2x] : [image.file];
      return files
        .filter((file) => !existsSync(`${VEHICLE_DIR}/${file}`))
        .map((file) => `${vehicleId}: ${file}`);
    });

    expect(missing).toEqual([]);
  });
});
