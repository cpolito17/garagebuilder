import { describe, it, expect } from 'vitest';
import { displayAuthor, creditLine, type VehicleImage } from './images';

const image = (author: string, licence: VehicleImage['licence'] = 'cc-by-sa'): VehicleImage => ({
  file: 'x.jpg', width: 500, height: 300, licence, author,
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg', alt: 'A car',
});

describe('showing an author', () => {
  it('replaces the em-dash several Commons artists use', () => {
    // Real entry: the audit fails the build over banned dashes in visible copy.
    expect(displayAuthor('CZmarlin — Christopher Ziemnowicz'))
      .toBe('CZmarlin - Christopher Ziemnowicz');
    expect(displayAuthor('A – B')).toBe('A - B');
  });

  it('leaves an ordinary name alone', () => {
    expect(displayAuthor('Alexander Migl')).toBe('Alexander Migl');
  });

  it('keeps the credit line free of banned dashes', () => {
    const line = creditLine(image('CZmarlin — Christopher Ziemnowicz'));
    expect(line).not.toMatch(/[—–]/);
    expect(line).toContain('Christopher Ziemnowicz');
    expect(line).toContain('via Wikimedia Commons');
  });

  it('still says Unknown when there is no author', () => {
    expect(creditLine(image(''))).toContain('Unknown');
  });
});
