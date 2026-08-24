# Catalog Expansion Tutorial

Use this document as the operating guide for an AI agent that adds vehicle
generations to Garage Challenge. The immediate goal is to add more expensive
choices without turning the catalog into a list of supercars. Expand the full
price spectrum and preserve useful choices for every role.

## Agent assignment

Add one batch of **25 vehicle generations**. Work from `main`. Research each
record before editing the catalog. Do not invent, estimate from memory, or copy
an existing record and change only its name.

For each batch, use this target distribution. Classify a vehicle by
`pricing.base`, the estimated US asking price of a clean example at
`pricing.baselineMiles`.

| Typical clean-example price | Records per batch |
| --- | ---: |
| Under $15,000 | 3 |
| $15,000 to $29,999 | 3 |
| $30,000 to $59,999 | 4 |
| $60,000 to $99,999 | 4 |
| $100,000 to $199,999 | 4 |
| $200,000 to $499,999 | 4 |
| $500,000 and above | 3 |

This mix intentionally puts 15 of 25 additions above $60,000 while still
adding ten choices below that level. Treat the counts as batch acceptance
criteria. Do not move a car into a tier by changing a defensible price.

Expensive additions must also span different jobs:

- No more than 10 of the 25 records can have `sports`, `track`, or
  `grand-tourer` as their primary role.
- At least four records above $60,000 must cover `family`, `offroad`, `tow`, or
  `cargo`.
- At least two records above $60,000 must cover `commuter` or `winter`.
- Include current and discontinued vehicles. Do not make the batch entirely
  new cars or entirely collector cars.
- Add second and third choices, not only the most famous model in each class.

If a defensible 25-car batch cannot meet this matrix, stop and report the
specific empty cells. Do not fill a quota with bad data.

## Read before editing

Read these files in order:

1. `docs/DATA-MODEL.md`, especially sections 2 through 6.
2. `src/data/schema.ts` for the enforced field ranges and enum values.
3. `src/data/types.ts` for runtime meanings.
4. `src/lib/pricing.ts` for the current and used price curves.
5. `src/lib/matching.ts` for ranking and role behavior.
6. `src/data/catalog.test.ts` and `src/data/codec.test.ts` for catalog
   invariants.
7. At least two existing files in `src/data/vehicles/` that contain vehicles
   similar to the proposed additions.

The schema is the executable authority when a document and the code disagree.
Report the disagreement and update the document in the same change.

## Step 1: inventory the existing catalog

Search before selecting candidates. A generation must appear once, even if it
has several trims, body variants, or powertrains.

```bash
rg -n "make:|model:|generation:|years:" src/data/vehicles
rg -n "candidate model name|candidate generation code" src/data/vehicles
npm run coverage
```

Reject or revise a candidate if its model-year span overlaps an existing
record for the same make, model, and generation. Do not evade duplicate checks
with a different ID or generation spelling.

Use a separate record only when the vehicle is a materially different
generation. Put trim-level differences in `notes.packages`. A rare trim does
not become a separate vehicle merely because it is expensive.

Before authoring, write a proposed batch table with these columns:

| Vehicle | Years | Primary role | Other roles | Target tier | New or used | Existing overlap checked |
| --- | --- | --- | --- | --- | --- | --- |

## Step 2: research and retain evidence

The catalog currently exposes catalog-level provenance. It does not have a
per-record source field. Do not use that limitation as permission to discard
research.

Create a batch log at:

```text
docs/catalog-research/YYYY-MM-DD-batch-N.md
```

For every vehicle, record:

- Source URL and retrieval date.
- The fields supported by that source.
- At least three current US asking-price observations when practical.
- Mileage, trim, condition, and price for each price observation.
- Why outliers were included or rejected.
- Any field that remains an editorial judgment.

Use this source order:

1. Manufacturer specifications, archived brochures, and official press kits.
2. EPA fuel-economy data for MPG or MPGe.
3. NHTSA for recalls and safety defects.
4. Specialist technical references for known mechanical issues and service
   intervals.
5. Current US listings and recent US auction results for price calibration.

Do not use a search-result snippet as a source. Do not treat one exceptional
auction result as the market. Do not copy proprietary reliability scores.

The catalog is for the US market. Keep currency in USD and use US model years,
specifications, trims, and fuel-economy figures.

## Step 3: choose the generation boundaries

One record describes one generation-wide market estimate. Split a model when a
new generation changes its platform, body, or powertrain family enough that
one price curve and one specification would mislead the user.

Do not combine long spans only because the model name stayed the same. A
generation spanning many years makes the year filter conservative: the whole
record must start on or after the user's minimum year.

Use the representative US specification that best describes the generation.
State important engine or facelift differences in `whatToLookFor` or
`packages`. If no single representative value is honest, split the generation.

## Step 4: calibrate pricing

These fields drive matching. They need more care than the prose.

```ts
pricing: {
  base: 85000,          // clean example at baselineMiles
  baselineMiles: 40000,
  floor: 35000,         // lower market bound as mileage becomes extreme
  decay: 0.08,          // above-floor value lost per 10,000 miles
  spread: 0.16,         // retained uncertainty metadata; not displayed
  msrpNew: 112000,      // required only for current generations
}
```

Rules:

- `base` is not original MSRP. It is today's typical asking price at the stated
  mileage.
- `baselineMiles` must describe the observations used for `base`.
- `floor` must be positive and below `base`. It is not the cheapest damaged or
  salvage example found online.
- `msrpNew` is required for `status: 'current'`. It must be at least `base`.
- Current vehicles use two anchors: MSRP at zero miles and `base` at
  `baselineMiles`.
- Discontinued vehicles use the normal mileage curve. Their maximum modeled
  price comes from the curve and `lowMileCap`.
- Collector vehicles that barely depreciate should use a low defensible decay,
  not a false zero. The schema permits `0.02` through `0.30`.
- This model assumes price falls as mileage rises. It does not model auction
  provenance, one-off specifications, or appreciation over time. Exclude a
  vehicle if those factors dominate its value so strongly that mileage is not
  a useful price input.

If two observed points are available after choosing a floor, use this as a
calibration check:

```text
decay = 1 - ((price2 - floor) / (base - floor))
              ^ (10000 / (miles2 - baselineMiles))
```

Then test several mileages with `priceAtMiles`. Do not select `decay` only to
make the vehicle appear at a preferred budget.

For a high-priced vehicle, verify that the modeled delivery or low-mileage
price is plausible. The result ranking uses the highest price the filtered
catalog can attain, so an inflated ceiling can distort every large-budget
search in that role.

## Step 5: author the record

Add new batches as new files after the current last group, for example
`src/data/vehicles/group-p.ts`. Export an `unknown[]`; build-time Zod validation
will produce the trusted type.

Use this template:

```ts
export const groupP: unknown[] = [
  {
    id: 'make-model-generation',
    make: 'Make',
    model: 'Model',
    generation: 'Generation code or clear generation name',
    years: [2021, 2026],
    status: 'current',
    roles: ['grand-tourer', 'sports'],
    bodyStyle: 'coupe',
    spec: {
      seats: 4,
      doors: 2,
      drivetrain: 'AWD',
      transmissions: ['automatic'],
      cylinders: 8,
      displacementL: 4.0,
      aspiration: 'turbo',
      horsepower: 600,
      torqueLbFt: 590,
      curbWeightLb: 4400,
      fuel: 'gas',
      mpgCombined: 18,
      towingLb: null,
      cargoCuFt: 12.0,
      groundClearanceIn: 5.0,
    },
    pricing: {
      base: 85000,
      baselineMiles: 40000,
      floor: 35000,
      decay: 0.08,
      spread: 0.16,
      msrpNew: 112000,
    },
    ownership: {
      reliabilityIndex: 3,
      insuranceIndex: 5,
      partsAvailability: 3,
      annualMaintenanceUsd: 2800,
      diyFriendliness: 1,
    },
    notes: {
      summary: 'One factual sentence about why this generation belongs in the catalog.',
      knownIssues: [
        {
          text: 'Specific documented issue and affected system',
          onsetMiles: 60000,
          typicalCostUsd: 3500,
          severity: 'expensive',
        },
      ],
      whatToLookFor: [
        'Preferred model years or revision and why',
        'Inspection item that materially changes purchase risk',
      ],
      packages: [
        {
          name: 'Package or trim',
          years: [2022, 2026],
          adds: 'Material equipment included by the package',
          premiumUsd: 6000,
        },
      ],
      milestoneServices: [
        {
          atMiles: 60000,
          item: 'Specific scheduled service',
          costUsd: 1800,
        },
      ],
    },
  },
];
```

Allowed values are in `src/data/schema.ts`. Important details:

- IDs use lowercase letters, numbers, and hyphens.
- Put the primary role first. Ranking distinguishes primary from secondary
  roles.
- Use `null` for a measurement that is not applicable or not available. Do not
  use zero as a substitute for unknown.
- `knownIssues` can be empty when no defensible issue is found. Inventing an
  issue is worse than an empty list.
- `packages` and `milestoneServices` are optional. Omit them when evidence is
  weak.
- `spread` is still required by the authored format, although the interface now
  shows one rounded price.
- Do not force an accurate vehicle into the schema. If a real specification is
  outside a current limit, propose a schema change with a test. Never clamp or
  alter the fact to pass validation.

## Step 6: connect the batch

Import the new group in `scripts/build-catalog.ts` and append it to `RAW`.
Keep group order stable.

If the batch introduces a new make, add its country code to `ORIGIN` in
`src/lib/garageSummary.ts`. The origin coverage test must recognize every make.

Update `CATALOG_UPDATED_AT` in `src/data/provenance.ts` to the research date.
Do not change `PRICES_AS_OF` unless the batch also recalibrates the older
catalog prices.

Run `npm run catalog` and commit both authored files and regenerated files in
`src/data/generated/`.

## Step 7: validate the batch

Run all commands from the repository root:

```bash
npm ci
npm run catalog
npm run coverage
npm test
npm run build
npm run audit
git diff --check
git status --short
```

Do not weaken an existing test to admit new data. Fix the record or explain why
the invariant itself is wrong.

Perform these manual checks after the automated checks:

1. Search each new ID and make/model to confirm no duplicate.
2. Test every role represented by the batch at $15k, $30k, $60k, $100k,
   $200k, $500k, and $1m slot budgets.
3. Confirm that expensive results lead large-budget searches when relevant.
4. Confirm that lower tiers remain visible at lower budgets.
5. Open at least one new current vehicle and one discontinued vehicle in the
   detail modal.
6. Check that each displayed price is plausible at its displayed odometer.
7. Check known-issue cautions both below and above their onset mileage.
8. Confirm new makes do not inflate the country count as unknown values.

## Step 8: report the result

The final pull-request description must include:

- Number of generations added.
- Count by the seven price tiers in this document.
- Count by primary role.
- Current versus discontinued count.
- New makes introduced.
- Research-log path.
- Commands run and their results.
- Any weak data, model limitation, or schema change.
- A short list of the highest-priced additions and their calibrated ceilings.

Do not report the task as complete if the generated catalog, tests, build, or
audit fails.

## Common failure modes

- Adding mostly sports cars because expensive sports cars are easy to name.
- Treating trims as generations and crowding results with one model.
- Using MSRP as `base` for a discontinued car.
- Using a zero-mile MSRP with a nonzero `baselineMiles` but omitting `msrpNew`.
- Copying specifications from a non-US market.
- Using peak optional-engine output while pricing the base version.
- Assigning roles generously to improve coverage.
- Guessing maintenance costs or issue onset mileages.
- Selecting a price curve that makes a desired search result appear.
- Adding an unknown make without updating `ORIGIN`.
- Editing generated JSON by hand.
- Discarding source links after authoring because the runtime schema does not
  yet store per-record citations.

Missing data is visible and correctable. Fabricated precision is not.
