import { describe, it, expect } from 'vitest';
import {
  buildQueries, extractYear, generationSignals, normaliseArtist, classifyLicence,
  scoreCandidate, pickBest, fileNameFor, distinctiveTokens, isNearDuplicate,
  type CommonsPage, type VehicleKey,
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
  it('searches generation, model year, then make and model', () => {
    expect(buildQueries(nc)).toEqual([
      'Mazda MX-5 Miata NC convertible',
      'Mazda MX-5 Miata 2006',
      'Mazda MX-5 Miata',
    ]);
  });
});

describe('generation signals', () => {
  it('keeps codes and expands ordinal names', () => {
    expect(generationSignals('AP1 and AP2')).toEqual(['ap1', 'ap2']);
    expect(generationSignals('second gen')).toEqual(['second', '2nd']);
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

  it('does not mistake Toyota for a toy', () => {
    const toyota = { ...nc, id: 'toyota-mx5', make: 'Toyota' };
    expect(scoreCandidate(page('File:2008 Toyota MX-5 front.jpg'), toyota)).not.toHaveProperty('rejected');
  });

  it('rejects an unverified generation when the title has no year or generation code', () => {
    expect(rejected(page('File:Mazda MX-5 roadster.jpg'))).toMatch(/generation not verifiable/);
  });

  it('rejects a different car entirely', () => {
    expect(rejected(page('File:2008 Honda Civic Type R.jpg'))).toMatch(/make not in title/);
    expect(rejected(page('File:2008 Mazda RX-8.jpg'))).toMatch(/model not in title/);
  });

  it('does not accept a different Tesla just because both names contain model', () => {
    const model3: VehicleKey = {
      id: 'tesla-model3', make: 'Tesla', model: 'Model 3',
      generation: 'first gen', years: [2017, 2023], bodyStyle: 'sedan',
    };
    expect(scoreCandidate(page('File:2018 Tesla Model S front.jpg'), model3)).toEqual({
      rejected: 'model not in title',
    });
    expect(scoreCandidate(page('File:2018 Tesla Model 3 front.jpg'), model3)).not.toHaveProperty('rejected');
  });

  it('rejects a performance trim when the record describes the base model', () => {
    expect(rejected(page('File:2008 Mazda MX-5 Type R front.jpg'))).toMatch(/different trim/);
  });

  it('requires the performance trim when the record names one', () => {
    const typeR = { ...nc, model: 'MX-5 Type R' };
    expect(scoreCandidate(page('File:2008 Mazda MX-5 front.jpg'), typeR)).toEqual({
      rejected: 'trim not verified (type r)',
    });
    expect(scoreCandidate(page('File:2008 Mazda MX-5 Type R front.jpg'), typeR)).not.toHaveProperty('rejected');
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

  it('prefers an in-generation year over a generation code alone', () => {
    expect(scoreOf(page('File:2008 Mazda MX-5.jpg'))).toBeGreaterThan(
      scoreOf(page('File:Mazda MX-5 NC roadster.jpg')));
  });

  it('prefers a matching generation code', () => {
    expect(scoreOf(page('File:2008 Mazda MX-5 NC roadster.jpg'))).toBeGreaterThan(
      scoreOf(page('File:2008 Mazda MX-5 roadster.jpg')));
  });

  it('prefers a front three-quarter angle', () => {
    expect(scoreOf(page('File:2008 Mazda MX-5 front.jpg'))).toBeGreaterThan(
      scoreOf(page('File:2008 Mazda MX-5 rear quarter view.jpg')));
  });

  it('prefers a neutral angle over a rear view', () => {
    expect(scoreOf(page('File:2008 Mazda MX-5 side.jpg'))).toBeGreaterThan(
      scoreOf(page('File:2008 Mazda MX-5 rear.jpg')));
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
      page('File:Mazda MX-5 NC parked.jpg', { artist: 'A' }),
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

// ---------------------------------------------------------------- quality

const scoreOf = (title: string, v: VehicleKey = nc) => {
  const r = scoreCandidate(page(title), v);
  return 'rejected' in r ? null : r.score;
};
const rejectionOf = (title: string, v: VehicleKey = nc) => {
  const r = scoreCandidate(page(title), v);
  return 'rejected' in r ? r.rejected : null;
};

describe('a car that is not the catalog car', () => {
  it('rejects a modified, liveried or replica example', () => {
    // A widebody drift car is a different object from the vehicle someone
    // would be shopping for, so it is worse than no photograph.
    for (const title of [
      'File:2008 Mazda MX-5 Miata modified.jpg',
      'File:2008 Mazda MX-5 Miata widebody.jpg',
      'File:2008 Mazda MX-5 Miata drift car.jpg',
      'File:2008 Mazda MX-5 Miata race car.jpg',
      'File:2008 Mazda MX-5 Miata replica.jpg',
      'File:2008 Mazda MX-5 Miata custom build.jpg',
      'File:2008 Mazda MX-5 Miata police car.jpg',
      'File:2008 Mazda MX-5 Miata concept.jpg',
    ]) {
      expect(rejectionOf(title), title).toMatch(/not a stock car/);
    }
  });

  it('still accepts an ordinary stock photograph', () => {
    expect(rejectionOf('File:2008 Mazda MX-5 Miata front right.jpg')).toBeNull();
  });
});

describe('framing', () => {
  it('prefers a quarter view over a flat head-on shot', () => {
    const quarter = scoreOf('File:2008 Mazda MX-5 Miata front right.jpg')!;
    const headOn = scoreOf('File:2008 Mazda MX-5 Miata front.jpg')!;
    expect(quarter).toBeGreaterThan(headOn);
  });

  it('demotes a show, a crowd, several cars, and frames too far or too close', () => {
    const plain = scoreOf('File:2008 Mazda MX-5 Miata front right.jpg')!;
    for (const title of [
      'File:2008 Mazda MX-5 Miata front right at the Geneva auto show.jpg',
      'File:2008 Mazda MX-5 Miata front right in a crowd.jpg',
      'File:2008 Mazda MX-5 Miata front right lineup.jpg',
      'File:2008 Mazda MX-5 Miata front right aerial.jpg',
      'File:2008 Mazda MX-5 Miata front right detail.jpg',
    ]) {
      expect(scoreOf(title), title).toBeLessThan(plain);
    }
  });

  it('demotes a title naming a second car with an ampersand', () => {
    // Real case: "Tesla Model 3 & Chevy Bolt EV DCA 08 2018". The ampersand is
    // stripped by phrase normalisation, so it is matched on the raw title.
    const alone = scoreOf('File:2008 Mazda MX-5 Miata in Durham.jpg')!;
    const pair = scoreOf('File:2008 Mazda MX-5 Miata & Honda S2000 in Durham.jpg')!;
    expect(pair).toBeLessThan(alone);
  });

  it('demotes rather than rejects, so a show photo is still better than nothing', () => {
    expect(rejectionOf('File:2008 Mazda MX-5 Miata front right at the Geneva auto show.jpg'))
      .toBeNull();
  });

  it('leaves the engine-photo rejection of "motor" alone', () => {
    // "Geneva Motor Show" is rejected outright rather than penalised, because
    // REJECT_TITLE already treats a bare "motor" as an engine close-up. The
    // outcome is the one we want either way, so the lists do not fight.
    expect(rejectionOf('File:2008 Mazda MX-5 Miata at the Geneva Motor Show.jpg'))
      .toMatch(/motor/);
  });
});

describe('the same photograph twice', () => {
  it('reduces a title to the occasion it records', () => {
    expect([...distinctiveTokens('File:Mazda MX-5 Miata NC Genf 2018.jpg', nc)]).toEqual(['genf']);
    // Framing words and dates say nothing about which photograph this is.
    expect([...distinctiveTokens('File:Mazda MX-5 Miata front right 06-08-2023.jpg', nc)]).toEqual([]);
  });

  it('calls two frames of one occasion the same photograph', () => {
    const a = distinctiveTokens('File:Mazda MX-5 Miata Genf 2018.jpg', nc);
    const b = distinctiveTokens('File:Mazda MX-5 Miata Back Genf 2018.jpg', nc);
    expect(isNearDuplicate(a, b)).toBe(true);
  });

  it('does not call two unrelated photographs duplicates', () => {
    const a = distinctiveTokens('File:Mazda MX-5 Miata in Durham.jpg', nc);
    const b = distinctiveTokens('File:Mazda MX-5 Miata Marble White.jpg', nc);
    expect(isNearDuplicate(a, b)).toBe(false);
  });

  it('treats a title with nothing distinctive left as unknown, not identical', () => {
    // Two plain "front right" titles may well be different cars entirely.
    const a = distinctiveTokens('File:Mazda MX-5 Miata front right.jpg', nc);
    const b = distinctiveTokens('File:Mazda MX-5 Miata front left.jpg', nc);
    expect(isNearDuplicate(a, b)).toBe(false);
  });

  it('keeps only one of a set taken at the same event', () => {
    const picked = pickBest([
      page('File:Mazda MX-5 Miata 2008 front right Genf.jpg', { artist: 'A' }),
      page('File:Mazda MX-5 Miata 2009 front left Genf.jpg', { artist: 'B' }),
      page('File:Mazda MX-5 Miata 2010 front right Durham.jpg', { artist: 'C' }),
    ], nc, 3);
    const titles = picked.map((c) => c.page.title);
    expect(titles).toHaveLength(2);
    expect(titles.some((t) => t.includes('Durham'))).toBe(true);
    expect(titles.filter((t) => t.includes('Genf'))).toHaveLength(1);
  });
});
