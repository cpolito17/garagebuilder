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
