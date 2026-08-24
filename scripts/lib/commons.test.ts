import { describe, it, expect } from 'vitest';
import {
  buildQuery, extractYear, normaliseArtist, classifyLicence,
  scoreCandidate, pickBest, fileNameFor, type CommonsPage, type VehicleKey,
} from './commons';

const nc: VehicleKey = {
  id: 'mazda-mx5-nc', make: 'Mazda', model: 'MX-5 Miata',
  generation: 'NC', years: [2006, 2015], bodyStyle: 'convertible',
};

/** Shaped like a real Commons imageinfo response. */
function page(title: string, o: Partial<{
  width: number; height: number; licence: string; artist: string; pageid: number;
}> = {}): CommonsPage {
  return {
    pageid: o.pageid ?? Math.floor(Math.random() * 1e6),
    title,
    imageinfo: [{
      url: `https://upload.wikimedia.org/${title}`,
      descriptionurl: `https://commons.wikimedia.org/wiki/${title}`,
      width: o.width ?? 3000,
      height: o.height ?? 2000,
      extmetadata: {
        License: { value: o.licence ?? 'cc-by-sa-4.0' },
        Artist: { value: o.artist ?? '<a href="/wiki/User:Someone">Someone</a>' },
      },
    }],
  };
}

describe('query construction', () => {
  it('searches on make and model, leaving generation to scoring', () => {
    expect(buildQuery(nc)).toBe('Mazda MX-5 Miata');
  });
});

describe('year extraction', () => {
  it('finds a plausible model year', () => {
    expect(extractYear('File:2007 Mazda MX-5 NC.jpg')).toBe(2007);
    expect(extractYear('File:Mazda MX-5 (1994).jpg')).toBe(1994);
  });
  it('ignores numbers that are not years', () => {
    expect(extractYear('File:Mazda MX-5 12345.jpg')).toBeNull();
    expect(extractYear('File:Mazda MX-5.jpg')).toBeNull();
  });
});

describe('artist normalisation', () => {
  it('strips the HTML Commons returns', () => {
    expect(normaliseArtist('<a href="/wiki/User:Foo" title="x">Jane Roe</a>')).toBe('Jane Roe');
  });
  it('decodes entities and collapses whitespace', () => {
    expect(normaliseArtist('Alex &amp;  Sam\n  Ltd')).toBe('Alex & Sam Ltd');
  });
  it('handles a missing field', () => {
    expect(normaliseArtist(undefined)).toBe('');
  });
});

describe('licence classification', () => {
  const cases: [string, string | null][] = [
    ['cc0', 'cc0'],
    ['CC0 1.0 Universal Public Domain Dedication', 'cc0'],
    ['cc-by-sa-4.0', 'cc-by-sa'],
    ['CC BY-SA 3.0', 'cc-by-sa'],
    ['cc-by-2.0', 'cc-by'],
    ['CC BY 4.0', 'cc-by'],
    ['Public domain', 'pd'],
    ['pd-old-100', 'pd'],
    ['GFDL', null],
    ['Fair use', null],
    ['All rights reserved', null],
    ['', null],
  ];
  for (const [raw, want] of cases) {
    it(`maps "${raw || '(empty)'}" to ${want ?? 'rejected'}`, () => {
      expect(classifyLicence(raw ? { License: { value: raw } } : undefined)).toBe(want);
    });
  }

  it('never accepts a licence it does not recognise', () => {
    expect(classifyLicence({ License: { value: 'some-new-thing-2.0' } })).toBeNull();
  });
});

describe('candidate rejection', () => {
  const rejected = (p: CommonsPage) => {
    const r = scoreCandidate(p, nc);
    expect(r, p.title).toHaveProperty('rejected');
    return (r as { rejected: string }).rejected;
  };

  it('rejects a photo of a part rather than the car', () => {
    expect(rejected(page('File:2008 Mazda MX-5 interior.jpg'))).toMatch(/interior/);
    expect(rejected(page('File:2008 Mazda MX-5 engine bay.jpg'))).toMatch(/engine/);
    expect(rejected(page('File:2008 Mazda MX-5 badge.jpg'))).toMatch(/badge/);
  });

  it('rejects a wreck, a toy and a drawing', () => {
    expect(rejected(page('File:2008 Mazda MX-5 crash.jpg'))).toMatch(/crash/);
    expect(rejected(page('File:2008 Mazda MX-5 diecast model car.jpg'))).toBeTruthy();
    expect(rejected(page('File:2008 Mazda MX-5 blueprint drawing.jpg'))).toBeTruthy();
  });

  it('rejects a year from the wrong generation, which is the failure that matters', () => {
    expect(rejected(page('File:1994 Mazda MX-5 NA.jpg'))).toMatch(/outside/);
    expect(rejected(page('File:2019 Mazda MX-5 ND.jpg'))).toMatch(/outside/);
  });

  it('rejects a different car entirely', () => {
    expect(rejected(page('File:2008 Honda Civic Type R.jpg'))).toMatch(/make not in title/);
    expect(rejected(page('File:2008 Mazda RX-8.jpg'))).toMatch(/model not in title/);
  });

  it('rejects an unfree or unrecognised licence', () => {
    expect(rejected(page('File:2008 Mazda MX-5.jpg', { licence: 'Fair use' }))).toMatch(/licence/);
  });

  it('rejects portrait crops and small sources', () => {
    expect(rejected(page('File:2008 Mazda MX-5.jpg', { width: 1200, height: 1600 }))).toMatch(/landscape/);
    expect(rejected(page('File:2008 Mazda MX-5.jpg', { width: 600, height: 400 }))).toMatch(/too small/);
  });

  it('rejects formats a browser will not treat as a photo', () => {
    expect(rejected(page('File:2008 Mazda MX-5.svg'))).toMatch(/format/);
    expect(rejected(page('File:2008 Mazda MX-5.tif'))).toMatch(/format/);
  });
});

describe('candidate scoring', () => {
  const scoreOf = (p: CommonsPage) => {
    const r = scoreCandidate(p, nc);
    if ('rejected' in r) throw new Error(`unexpectedly rejected: ${r.rejected}`);
    return r.score;
  };

  it('prefers an in-generation year over no year', () => {
    expect(scoreOf(page('File:2008 Mazda MX-5.jpg'))).toBeGreaterThan(
      scoreOf(page('File:Mazda MX-5 roadster.jpg')));
  });

  it('prefers a matching generation code', () => {
    expect(scoreOf(page('File:2008 Mazda MX-5 NC roadster.jpg'))).toBeGreaterThan(
      scoreOf(page('File:2008 Mazda MX-5 roadster.jpg')));
  });

  it('prefers a front three-quarter angle', () => {
    expect(scoreOf(page('File:2008 Mazda MX-5 front.jpg'))).toBeGreaterThan(
      scoreOf(page('File:2008 Mazda MX-5 rear quarter view.jpg')));
  });

  it('carries the licence and cleaned author through', () => {
    const r = scoreCandidate(page('File:2008 Mazda MX-5.jpg', { licence: 'cc0', artist: '<b>Jo Bloggs</b>' }), nc);
    expect(r).not.toHaveProperty('rejected');
    expect((r as { licence: string }).licence).toBe('cc0');
    expect((r as { author: string }).author).toBe('Jo Bloggs');
  });
});

describe('gallery selection', () => {
  it('returns the best candidates in order, one per author', () => {
    const pages = [
      page('File:Mazda MX-5 parked.jpg', { artist: 'A' }),
      page('File:2008 Mazda MX-5 NC front.jpg', { artist: 'B' }),
      page('File:2010 Mazda MX-5 side.jpg', { artist: 'C' }),
      page('File:2011 Mazda MX-5 front.jpg', { artist: 'B' }), // same author as the second
      page('File:1994 Mazda MX-5.jpg', { artist: 'D' }),       // wrong generation
      page('File:2009 Mazda MX-5 interior.jpg', { artist: 'E' }),
    ];
    const picked = pickBest(pages, nc, 4);
    expect(picked[0]!.page.title).toBe('File:2008 Mazda MX-5 NC front.jpg');
    const authors = picked.map((p) => p.author);
    expect(new Set(authors).size).toBe(authors.length);
    expect(picked.map((p) => p.page.title)).not.toContain('File:1994 Mazda MX-5.jpg');
    expect(picked.map((p) => p.page.title)).not.toContain('File:2009 Mazda MX-5 interior.jpg');
  });

  it('returns nothing rather than something wrong', () => {
    const pages = [
      page('File:2019 Mazda MX-5 ND.jpg'),
      page('File:2008 Honda Civic.jpg'),
      page('File:2008 Mazda MX-5.jpg', { licence: 'All rights reserved' }),
    ];
    expect(pickBest(pages, nc, 4)).toHaveLength(0);
  });

  it('honours the requested limit', () => {
    const pages = Array.from({ length: 20 }, (_, i) =>
      page(`File:200${i % 9} Mazda MX-5 front.jpg`, { artist: `Author ${i}` }));
    expect(pickBest(pages, nc, 3)).toHaveLength(3);
  });
});

describe('file naming', () => {
  it('is deterministic and keeps the source extension', () => {
    expect(fileNameFor(nc, 0, 'File:Foo.JPG')).toBe('mazda-mx5-nc-0.jpg');
    expect(fileNameFor(nc, 2, 'File:Foo.png')).toBe('mazda-mx5-nc-2.png');
  });
});
