import { describe, it, expect } from 'vitest';
import { resolveRejects, mergeExclusions, titleFromSourceUrl, normaliseTitle } from './rejects';
import type { ImageManifest } from '../../src/data/images';

const image = (file: string, title: string) => ({
  file,
  width: 500,
  height: 300,
  licence: 'cc-by-sa' as const,
  author: 'Someone',
  sourceUrl: `https://commons.wikimedia.org/wiki/${title}`,
  alt: 'A car',
});

const MANIFEST: ImageManifest = {
  'bmw-m3-e46': [
    { ...image('bmw-m3-e46-0.jpg', 'File:BMW_M3_E46_front.jpg'), file2x: 'bmw-m3-e46-0@2x.jpg' },
    image('bmw-m3-e46-1.jpg', 'File:BMW_M3_E46_rear.jpg'),
  ],
  'mazda-mx5-nc': [image('mazda-mx5-nc-0.jpg', 'File:Mazda_MX-5_NC.jpg')],
};

describe('reading a reject list', () => {
  it('takes the local filename a reviewer is actually looking at', () => {
    const { rejections, unresolved } = resolveRejects(['bmw-m3-e46-1.jpg'], MANIFEST);
    expect(unresolved).toHaveLength(0);
    expect(rejections).toEqual([
      { vehicleId: 'bmw-m3-e46', title: 'File:BMW_M3_E46_rear.jpg', file: 'bmw-m3-e46-1.jpg' },
    ]);
  });

  it('treats the retina twin as the same photograph', () => {
    // Rejecting the @2x file and rejecting the 1x are the same intent, and a
    // reviewer on a dense display may well have been looking at the former.
    const { rejections } = resolveRejects(['bmw-m3-e46-0@2x.jpg'], MANIFEST);
    expect(rejections.map((r) => r.file)).toEqual(['bmw-m3-e46-0.jpg']);
  });

  it('accepts a path in either slash direction', () => {
    const posix = resolveRejects(['public/vehicles/bmw-m3-e46-0.jpg'], MANIFEST);
    const windows = resolveRejects(['public\\vehicles\\bmw-m3-e46-0.jpg'], MANIFEST);
    expect(posix.rejections).toEqual(windows.rejections);
    expect(posix.rejections).toHaveLength(1);
  });

  it('accepts a Commons title or a Commons URL', () => {
    const byTitle = resolveRejects(['File:BMW_M3_E46_front.jpg'], MANIFEST);
    const byUrl = resolveRejects(['https://commons.wikimedia.org/wiki/File:BMW_M3_E46_front.jpg'], MANIFEST);
    expect(byTitle.rejections).toEqual(byUrl.rejections);
    expect(byTitle.rejections[0]!.file).toBe('bmw-m3-e46-0.jpg');
  });

  it('accepts a non-Commons landing URL and records its stable source identity', () => {
    const openverseManifest: ImageManifest = {
      ...MANIFEST,
      'bmw-m3-e92': [{
        ...image('bmw-m3-e92-0.jpg', 'unused'),
        licence: 'cc0',
        sourceUrl: 'https://www.flickr.com/photos/jane/12345',
      }],
    };
    const result = resolveRejects(
      ['https://www.flickr.com/photos/jane/12345'],
      openverseManifest,
    );
    expect(result.unresolved).toHaveLength(0);
    expect(result.rejections[0]).toEqual({
      vehicleId: 'bmw-m3-e92',
      title: 'url:https://www.flickr.com/photos/jane/12345',
      file: 'bmw-m3-e92-0.jpg',
    });
  });

  it('rejects a whole set from a bare vehicle id', () => {
    const { rejections } = resolveRejects(['bmw-m3-e46'], MANIFEST);
    expect(rejections.map((r) => r.file)).toEqual(['bmw-m3-e46-0.jpg', 'bmw-m3-e46-1.jpg']);
  });

  it('ignores blanks and treats the rest of a line after # as a note', () => {
    const { rejections, unresolved } = resolveRejects(
      ['', '   ', '# a heading', 'bmw-m3-e46-1.jpg  # cropped through the wheel'],
      MANIFEST,
    );
    expect(unresolved).toHaveLength(0);
    expect(rejections).toHaveLength(1);
  });

  it('reports a line that matches nothing rather than skipping it', () => {
    // A typo that silently does nothing is the worst outcome here: the
    // reviewer believes a bad photo is gone and it is still on the card.
    const { rejections, unresolved } = resolveRejects(['bmw-m3-e64-0.jpg'], MANIFEST);
    expect(rejections).toHaveLength(0);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]!.line).toBe('bmw-m3-e64-0.jpg');
  });

  it('does not list the same photograph twice', () => {
    const { rejections } = resolveRejects(
      ['bmw-m3-e46-0.jpg', 'bmw-m3-e46-0@2x.jpg', 'File:BMW_M3_E46_front.jpg'],
      MANIFEST,
    );
    expect(rejections).toHaveLength(1);
  });
});

describe('the Commons title in a description URL', () => {
  it('is the tail of the URL, percent-decoded', () => {
    expect(titleFromSourceUrl('https://commons.wikimedia.org/wiki/File:A_car.jpg')).toBe('File:A_car.jpg');
    expect(titleFromSourceUrl('https://commons.wikimedia.org/wiki/File:Citro%C3%ABn.jpg')).toBe('File:Citroën.jpg');
  });

  it('is null when there is no title to read', () => {
    expect(titleFromSourceUrl('https://example.com/photo.jpg')).toBeNull();
    expect(titleFromSourceUrl('https://commons.wikimedia.org/wiki/')).toBeNull();
  });

  it('survives a malformed escape rather than throwing', () => {
    expect(() => titleFromSourceUrl('https://commons.wikimedia.org/wiki/File:100%.jpg')).not.toThrow();
    expect(titleFromSourceUrl('https://commons.wikimedia.org/wiki/File:100%.jpg')).toBe('File:100%.jpg');
  });

  it('treats underscores and case as presentation', () => {
    expect(normaliseTitle('File:A_Car.JPG')).toBe(normaliseTitle('file:a car.jpg'));
  });
});

describe('merging into the exclusions file', () => {
  const rejection = (vehicleId: string, title: string) => ({ vehicleId, title, file: 'x.jpg' });

  it('keeps exclusions already recorded', () => {
    const merged = mergeExclusions(
      { 'tesla-model3': ['File:Old.jpg'] },
      [rejection('bmw-m3-e46', 'File:New.jpg')],
    );
    expect(merged['tesla-model3']).toEqual(['File:Old.jpg']);
    expect(merged['bmw-m3-e46']).toEqual(['File:New.jpg']);
  });

  it('does not add a title that is already excluded, whatever its spelling', () => {
    const merged = mergeExclusions(
      { 'bmw-m3-e46': ['File:Some_Car.jpg'] },
      [rejection('bmw-m3-e46', 'File:some car.jpg')],
    );
    expect(merged['bmw-m3-e46']).toEqual(['File:Some_Car.jpg']);
  });

  it('sorts so the file stays readable as it grows', () => {
    const merged = mergeExclusions({}, [
      rejection('zzz-car', 'File:B.jpg'),
      rejection('aaa-car', 'File:D.jpg'),
      rejection('aaa-car', 'File:C.jpg'),
    ]);
    expect(Object.keys(merged)).toEqual(['aaa-car', 'zzz-car']);
    expect(merged['aaa-car']).toEqual(['File:C.jpg', 'File:D.jpg']);
  });
});
