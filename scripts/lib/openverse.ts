import type { CommonsPage } from './commons';

export type OpenverseImage = {
  id: string;
  title?: string | null;
  creator?: string | null;
  creator_url?: string | null;
  url?: string | null;
  thumbnail?: string | null;
  foreign_landing_url?: string | null;
  width?: number | null;
  height?: number | null;
  license?: string | null;
  license_version?: string | null;
  extension?: string | null;
  filetype?: string | null;
  source?: string | null;
  provider?: string | null;
  tags?: Array<{ name?: string | null }> | null;
};

export type OpenverseResponse = {
  results?: OpenverseImage[];
};

/**
 * Keep non-Wikimedia fallback images to CC0/public domain. The site currently
 * says "via Wikimedia Commons" for attribution-required licences, and this
 * collector must not make that credit false while site code is out of scope.
 */
export function openversePage(image: OpenverseImage): CommonsPage | null {
  const licence = image.license?.toLowerCase();
  if (licence !== 'cc0' && licence !== 'pdm') return null;

  const provider = `${image.provider ?? ''} ${image.source ?? ''}`.toLowerCase();
  if (provider.includes('wikimedia')) return null;

  if (
    !image.id || !image.title || !image.url || !image.foreign_landing_url
    || !image.width || !image.height || image.width < 1 || image.height < 1
  ) {
    return null;
  }

  let urlExtension = 'jpg';
  try {
    urlExtension = new URL(image.url).pathname.split('.').pop() || 'jpg';
  } catch {
    return null;
  }
  const extension = (image.extension ?? image.filetype ?? urlExtension)
    .toLowerCase().replace('jpeg', 'jpg');
  if (extension !== 'jpg' && extension !== 'png') return null;
  const tagText = (image.tags ?? []).map((tag) => tag.name?.trim()).filter(Boolean).slice(0, 20).join(' ');
  const searchableTitle = `${image.title} ${tagText}`.trim();
  const title = `File:${searchableTitle.replace(/\.(jpe?g|png)$/i, '')}.${extension}`;

  return {
    pageid: `openverse:${image.provider ?? image.source ?? 'unknown'}:${image.id}`,
    title,
    provider: 'openverse',
    imageinfo: [{
      url: image.url,
      descriptionurl: image.foreign_landing_url,
      width: image.width,
      height: image.height,
      thumburl: image.thumbnail ?? image.url,
      extmetadata: {
        License: { value: licence === 'cc0' ? 'cc0' : 'Public domain' },
        Artist: { value: image.creator ?? '' },
      },
    }],
  };
}
