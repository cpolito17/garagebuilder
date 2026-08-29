import { describe, expect, it } from 'vitest';
import { approvalKey, exclusionMatches, sourceIdentity, titleFromSourceUrl } from './source-identity';

describe('source identities', () => {
  it('uses the Commons file title rather than a thumbnail URL', () => {
    const url = 'https://commons.wikimedia.org/wiki/File:BMW_M3_front.jpg';
    expect(titleFromSourceUrl(url)).toBe('File:BMW_M3_front.jpg');
    expect(sourceIdentity(url)).toBe('commons:file:bmw m3 front.jpg');
  });

  it('normalises non-Commons landing pages without tracking data', () => {
    expect(sourceIdentity('https://www.flickr.com/photos/user/123/?utm_source=x#photo'))
      .toBe('url:https://www.flickr.com/photos/user/123');
  });

  it('scopes an approval to the intended vehicle', () => {
    const url = 'https://example.com/photo/1';
    expect(approvalKey('bmw-m3-e46', url)).not.toBe(approvalKey('bmw-m3-e92', url));
  });

  it('matches both legacy Commons titles and new source identities', () => {
    const url = 'https://commons.wikimedia.org/wiki/File:BMW_M3_front.jpg';
    expect(exclusionMatches('File:BMW_M3_front.jpg', 'File:BMW_M3_front.jpg', url)).toBe(true);
    expect(exclusionMatches(sourceIdentity(url), 'File:BMW_M3_front.jpg', url)).toBe(true);
  });
});
