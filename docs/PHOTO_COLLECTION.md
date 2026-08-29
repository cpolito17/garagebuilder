# Photo collection

Garage Challenge uses Wikimedia Commons photography under CC0, public-domain,
CC BY, or CC BY-SA terms. The app stores every author, licence, source page and
alt description in `src/data/generated/images.json`. Photo binaries live in
`public/vehicles/` while collecting or deploying, but stay out of Git as the
repository's existing data and licensing plan requires.

## Review one vehicle

```bash
npm run images -- --only mazda-mx5-nc
```

The command regenerates the catalog first, searches the generation and model
years, rejects unrecognised licences and unverifiable generations, and writes
one hero plus up to two gallery images. Review every downloaded image before
keeping its manifest entry:

1. Confirm the generation and model variant.
2. Prefer an unobstructed front three-quarter hero with a useful landscape crop.
3. Reject interiors, parts, wrecks, drawings, miniatures, event graphics and
   images dominated by another vehicle.
4. Confirm that the manifest has an author, source page, licence and accurate
   alt text.
5. Add visually unsuitable Commons file titles to
   `scripts/image-exclusions.json`, then rerun the vehicle. Do not hand-edit the
   generated order; exclusions make the review reproducible.

## Review by eye

```bash
npm run images:review      # then open http://127.0.0.1:4180
```

One photograph at a time. Right arrow or a swipe right keeps it, left rejects
it, backspace undoes. When a batch is judged, Apply records the rejects in
`scripts/image-exclusions.json`, re-fetches the affected vehicles, and brings
the replacements back into the queue. Repeat until the queue is empty, which is
what "every photograph approved" means.

Approvals live in `scripts/image-approvals.json`, keyed by Commons file title
rather than by local filename. A re-fetch reuses filenames for different
photographs, so a filename-keyed approval would silently bless a photograph
nobody looked at. Committing the file means a clone starts where the last
review pass finished rather than at the beginning.

The list below is the same mechanism without the browser, for when a filename
is already in hand.

## Replace a photograph you have rejected

Looking at pictures is how bad ones are found, so the tool takes what you have
in front of you: the filename. Paste the rejects into `scripts/image-rejects.txt`,
one per line, then:

```bash
npm run images:reject -- --dry-run   # what would happen, changes nothing
npm run images:reject               # record the exclusions and re-fetch
```

Each line is resolved against the manifest and recorded permanently in
`scripts/image-exclusions.json`, then the affected vehicles are re-fetched so
Commons picks different photographs from what remains. A local filename (with
or without its `@2x` suffix or its directory), a Commons title, a Commons URL,
or a bare vehicle id for a whole set all work. Text after `#` is a note. A line
that matches nothing is reported rather than skipped, because a typo that
silently does nothing leaves a bad photograph on the card while the reviewer
believes it is gone.

Never swap a file by hand. The manifest entry keeps the previous photographer's
name, licence and source page, so the credits page and the detail view would
attribute your replacement to someone else under a licence they chose for a
different photograph. Re-fetching keeps every credit true. Hand-swapping also
loses the `@2x` twin, which is what dense displays actually load, so the old
photograph survives on exactly the devices most people are holding.

When Commons has nothing else free and in-generation, the run says so and the
vehicle keeps what it had. The exclusion stays recorded, so a later run picks
up anything newly uploaded.

## Continue the collection

```bash
npm run images
```

This processes records without manifest entries and records whose local files
are missing. Every result is still a candidate until a person reviews it. For a
small batch, prefer repeated `--only` runs so the review set stays bounded.

On a clean checkout, re-fetch reviewed records one at a time with `--only` and
review them again before building. Commons search results can change, so the
manifest preserves attribution and source decisions but is not a byte-for-byte
binary archive.

Commit the manifest, collector changes and review exclusions. Do not commit
`public/vehicles/`. A deployment that should contain the pilot photography must
build from the reviewed collection workspace so those ignored binaries are
present in the deployment artifact. Do not add an unbounded image fetch to a
production deployment until the resulting catalog has been reviewed.

## Pilot batch — 2026-08-25

The first manually reviewed batch covers eight different catalog jobs and
naming patterns:

| Vehicle ID | Coverage exercised | Result |
| --- | --- | --- |
| `mazda-mx5-nc` | generation code, sports | accepted |
| `honda-civic-fl` | ordinal generation, commuter | accepted |
| `ford-f150-13th` | ordinal generation, tow/cargo | accepted |
| `tesla-model3` | descriptive generation, EV/winter | accepted after visual exclusion |
| `mercedes-e63-w212` | hyphenated make, grand tourer | accepted |
| `volvo-v60-cc` | ordinal generation, wagon | accepted |
| `toyota-sienna-xl30` | minivan/family | accepted |
| `toyota-4runner-n280` | SUV/off-road | accepted |

Each accepted record has one hero and two gallery images. The pilot therefore
adds 24 reviewed photographs across eight of the current 325 catalog records:
18 CC BY-SA, four CC BY, one CC0 and one public-domain image. The typographic
identity band remains the designed fallback for the remaining records.
