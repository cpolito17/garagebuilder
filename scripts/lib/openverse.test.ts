import { describe, expect, it } from 'vitest';
import { openversePage, type OpenverseImage } from './openverse';

const image: OpenverseImage = {
  id: 'abc',
  title: '2008 Mazda MX-5 front right',
  creator: 'Jane Photographer',
  url: 'https://images.example/mazda.jpg',
  thumbnail: 'https://thumbs.example/mazda.jpg',
  foreign_landing_url: 'https://www.flickr.com/photos/jane/abc',
  width: 2400,
  height: 1600,
  license: 'cc0',
  extension: 'jpg',
  provider: 'flickr',
};

describe('Openverse fallback mapping', () => {
  it('maps a complete CC0 result into the existing scoring shape', () => {
    const page = openversePage(image);
    expect(page).not.toBeNull();
    expect(page?.provider).toBe('openverse');
    expect(page?.imageinfo?.[0]?.descriptionurl).toBe(image.foreign_landing_url);
    expect(page?.imageinfo?.[0]?.extmetadata?.License?.value).toBe('cc0');
  });

  it('accepts public-domain marks', () => {
    expect(openversePage({ ...image, license: 'pdm' })).not.toBeNull();
  });

  it.each(['by', 'by-sa', 'by-nc', null])(
    'rejects %s because the untouched site would mislabel its source',
    (license) => expect(openversePage({ ...image, license })).toBeNull(),
  );

  it('drops Wikimedia results because Commons is queried directly', () => {
    expect(openversePage({ ...image, provider: 'wikimedia' })).toBeNull();
  });

  it('drops incomplete and unusable records', () => {
    expect(openversePage({ ...image, foreign_landing_url: null })).toBeNull();
    expect(openversePage({ ...image, width: 0 })).toBeNull();
  });
});
