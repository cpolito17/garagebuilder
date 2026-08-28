# Garage Challenge - Data Model and Pricing

Canonical reference for the vehicle catalog, the price model, and the rules
that turn a dollar figure into a list of cars.

Everything in this document is offline data. There is no live market feed.

---

## 1. The unit of data is the generation

Not the year. Not the trim. The generation.

`Mazda MX-5 (NC), 2006-2015` is one record. `Toyota 4Runner (N280, 5th gen),
2010-2024` is one record. A generation is the smallest unit an enthusiast
actually shops for, and it is the largest unit whose price behaves as one curve.

Roughly 250 records covers the entire realistic conversation for a US buyer.
Going to 2,000 records by splitting trims and model years multiplies the
authoring work by 8x and improves the results by approximately nothing.

**Catalog boundaries (locked):**

| Boundary | Value |
| --- | --- |
| Market | United States only |
| Earliest model year | 1990 |
| Latest | Current model year, including new cars |
| Currency | USD, nominal, stamped with `pricesAsOf` |
| Condition assumed | Clean, running, no accident history, private-party to light-dealer asking price |

New cars are not a separate concept. A current-generation vehicle is simply a
generation whose price curve is anchored at 0 miles with MSRP, and whose
`status` is `current`. The same math runs on a new Civic and a 1994 Land
Cruiser.

---

## 2. Record schema

```ts
type VehicleId = string;   // "mazda-mx5-nc", "toyota-4runner-n280"

type Role =
  | "sports" | "commuter" | "family" | "offroad" | "tow"
  | "winter" | "track" | "grand-tourer" | "cargo" | "project";

type Vehicle = {
  id: VehicleId;
  make: string;
  model: string;
  generation: string;              // "NC", "E90", "5th gen"
  years: [number, number];         // inclusive model-year span
  status: "current" | "discontinued";

  roles: Role[];                   // which slot archetypes this can fill
  bodyStyle: "coupe" | "sedan" | "hatchback" | "wagon" | "convertible"
           | "suv" | "truck" | "van" | "targa";

  spec: {
    seats: number;
    doors: number;
    drivetrain: "FWD" | "RWD" | "AWD" | "4WD";
    transmissions: ("manual" | "automatic" | "dct" | "cvt" | "single-speed")[];
    cylinders: number;             // 0 for EV
    displacementL: number;         // 0 for EV
    aspiration: "na" | "turbo" | "supercharged" | "hybrid" | "electric";
    horsepower: number;
    torqueLbFt: number;
    curbWeightLb: number;
    fuel: "gas" | "diesel" | "hybrid" | "phev" | "ev";
    mpgCombined: number;           // EPA combined; MPGe for EV
    towingLb: number | null;
    cargoCuFt: number | null;
    groundClearanceIn: number | null;
    zeroToSixty: number | null;    // seconds, manufacturer or press-tested
  };

  pricing: PriceCurve;
  ownership: Ownership;
  notes: Notes;
  packages: Package[];
  media: Media;

  sources: Source[];               // provenance, see section 6
  updatedAt: string;               // ISO date
};
```

### PriceCurve

```ts
type PriceCurve = {
  base: number;          // USD asking price today, clean example, at baselineMiles
  baselineMiles: number; // the odometer that `base` assumes
  floor: number;         // asymptote: what the market pays regardless of miles
  decay: number;         // 0..1, fraction of above-floor value lost per 10k miles
  lowMileCap: number;    // max multiplier over `base` for a garage-queen example
  spread: number;        // retained calibration uncertainty; not displayed
  msrpNew?: number;      // required when status === "current"
};
```

### Ownership

```ts
type Ownership = {
  reliabilityIndex: 1 | 2 | 3 | 4 | 5;   // 5 = best
  insuranceIndex: 1 | 2 | 3 | 4 | 5;     // 5 = most expensive
  partsAvailability: 1 | 2 | 3 | 4 | 5;  // 5 = trivial to source
  annualMaintenanceUsd: number;          // typical, out of warranty
  diyFriendliness: 1 | 2 | 3 | 4 | 5;    // 5 = driveway-serviceable
};
```

Insurance is deliberately an index, not a dollar figure. Real premiums swing
3x on driver age, ZIP code, and record. A fake dollar number would be the least
defensible thing in the app.

### Notes

```ts
type Notes = {
  summary: string;              // 2 sentences, factual
  knownIssues: Issue[];
  whatToLookFor: string[];      // options and specs worth paying for
  milestoneServices: Service[];
};

type Issue = {
  text: string;                 // "Timing chain guides wear, N20 engines"
  onsetMiles: number;           // when it typically shows up
  typicalCostUsd: number;
  severity: "annoyance" | "expensive" | "car-ending";
};

type Service = {
  atMiles: number;
  item: string;                 // "Timing belt and water pump"
  costUsd: number;
};
```

`knownIssues` is the field that does the most work in the product. It is
written factually, not as a joke. It drives the high-mileage caution badge
(see SPEC section 5.3).

### Package

```ts
type Package = {
  name: string;                 // "ZHP Performance Package"
  years?: [number, number];     // if not offered across the whole generation
  adds: string;                 // one line, what you actually get
  premiumUsd: number;           // typical price delta over a base car
};
```

### Media

```ts
type Media = {
  heroId: string;               // asset id, see section 7
  galleryIds: string[];         // 3 to 6 images for the detail view
};
```

---

## 3. The price model

One equation drives the whole application.

### 3.1 Price given mileage

```
price(m) = floor + (base - floor) * (1 - decay) ^ ((m - baselineMiles) / 10000)
```

Clamped above by `base * lowMileCap`.

Properties that make this the right shape:

- It **asymptotes to `floor`** instead of going negative. A 240,000 mile Civic
  is worth something. A linear model says it is worth minus four thousand dollars.
- **`decay` is one hand-tunable number with a plain-English meaning:** "this car
  loses X percent of its above-floor value per 10,000 miles." An author can set
  it by feel and be right.
- **It expresses the actual difference between cars,** which is the entire point
  of the app. A per-car decay rate is why a high-mileage Land Cruiser and a
  high-mileage 7 Series are different products, not the same discount.

Reference decay values to calibrate against:

| Vehicle character | `decay` | Reads as |
| --- | --- | --- |
| Body-on-frame Toyota, strong reputation | 0.03 - 0.05 | Miles barely matter |
| Mainstream commuter, huge parts supply | 0.06 - 0.09 | Miles matter normally |
| Enthusiast car with a following | 0.05 - 0.08 | Condition beats odometer |
| German luxury, out of warranty | 0.14 - 0.20 | Falls off a cliff |
| Complex performance flagship | 0.18 - 0.25 | Depreciation is the feature |

Public depreciation rules of thumb land around $50 to $250 per 1,000 miles and
every source that publishes one says there is no universal rate. That variance
is not noise to be averaged away, it is the signal. Hand-tuning `decay` per
generation is the work that makes this catalog worth having.

### 3.2 The inversion: mileage given budget

This is the mechanic the product is actually built on. Solve the same equation
for `m`:

```
milesAffordable(B) = baselineMiles + 10000 * ln((B - floor) / (base - floor))
                                            / ln(1 - decay)
```

Defined only when `B > floor`. When `B <= floor` the car is out of reach at any
odometer. When `B >= base * lowMileCap` the car is affordable at delivery
mileage and the answer clamps to 0.

The inversion is not what the slot runs on any more, but it is still the reason
the product works, and it is still used in one place: when a slot is empty, it
answers "what odometer would bring this car into this budget", which is exactly
the offer the empty state makes.

**What the slot runs on now.** The user sets the odometer, and every vehicle is
priced at it. That is the forward equation, not the inversion, and it is the
change that made the control honest: as a ceiling it was a filter wearing a
dial's clothes, because dragging it made cars appear and disappear while the
prices never moved. As an odometer, dragging it moves the prices, which is the
thing the user is actually trying to tune.

The two directions are the same curve read two ways, and both are needed:

| Question | Function | Used by |
| --- | --- | --- |
| What does this car cost at 120,000 miles? | `priceAtMiles` | Every result in every list |
| What odometer puts this car inside $18,000? | `milesAffordable` | The empty state's offer |

A $19,400 sports slot at 20,000 miles reaches a Prelude, a 335i and an NC
Miata. The same money at 200,000 miles reaches an MR2 Turbo, a WRX STI and a
Jaguar F-Type S. Same budget, same catalog, one control.

### 3.2a Worked calibration

Run against candidate curves at a single $18,000 slot budget. These are the
model's actual outputs, not illustrative figures, and the parameters below are
the starting calibration for catalog authoring.

| Vehicle | `base` | `floor` | `decay` | `baselineMiles` | Odometer at $18,000 |
| --- | --- | --- | --- | --- | --- |
| Mazda MX-5 (NC) | 13,000 | 5,000 | 0.070 | 85,000 | ~18,000 |
| Honda Civic Si (10th gen) | 23,500 | 8,000 | 0.080 | 55,000 | ~108,000 |
| Mercedes-AMG E63 (W212) | 34,000 | 9,500 | 0.175 | 60,000 | ~115,000 |
| BMW M3 (E90) | 33,000 | 14,000 | 0.090 | 75,000 | ~240,000 |
| Toyota 4Runner (N280) | 31,000 | 11,000 | 0.045 | 95,000 | ~323,000 (clipped) |
| Porsche 911 (997.1) | 46,000 | 22,000 | 0.130 | 60,000 | out of reach |

Three findings from this calibration that shape the product:

1. **The mechanic works.** The same $18,000 returns a near-mint MX-5 at 18,000
   miles and a 115,000 mile AMG super-sedan. That contrast is the product.

2. **`plausibleMaxMiles` is load-bearing, and it is not the same thing as a
   quality filter.** Low-decay vehicles asymptote slowly, so the raw equation
   offers a 4Runner at 323,000 miles, which exceeds the hard ceiling and is
   rejected outright.

   The E90 M3 at 240,000 miles is the more interesting case: an 18 year old car
   genuinely can have covered that, so the guard passes it. It is not an
   impossible car, it is a **bad buy**, and those need different answers.
   Impossible odometers are removed silently. Bad buys are shown with their
   known issues surfaced, because the user is entitled to see that $18,000
   technically reaches an M3 and to understand what that particular M3 would
   cost them afterward. Do not use the plausibility guard to hide cars you
   disapprove of.

3. **Out of reach is a real and frequent outcome.** The 997.1 has a `floor` of
   $22,000, so no odometer brings it under $18,000. The UI must handle "this
   slot cannot buy this car at any mileage" as a normal state, and the empty
   state should be able to say that the budget is below a car's floor rather
   than implying no such car exists.

This calibration predates the odometer control and is still the right test of
the curves, because it is the curves being calibrated rather than the UI. Read
it as a column of `milesAffordable` outputs: the same numbers now drive the
empty state's offer instead of the result list, and the same contrast between
an 18,000 mile MX-5 and a 115,000 mile AMG is what the dial now produces
directly, by sweeping the odometer at a fixed budget instead of the reverse.

Round-trip identity holds exactly across the invertible working range:
`price(milesAffordable(B)) === B` for every B between `floor` and
`base * lowMileCap`. Outside that range the clamps bind, which is correct
behavior and must be asserted in tests rather than treated as drift.

### 3.2b A minimum plausible odometer

Added during implementation. `plausibleMaxMiles` has a mirror:

```
plausibleMinMiles(lastYear) = max(0, (currentYear - lastYear) * 1500)
```

Without it the curve offers a 1990 Miata at delivery mileage, because
extrapolating backwards below `baselineMiles` is mathematically fine and
physically absurd. That is not a bargain, it is a car that does not exist, and
it ranked first in early testing because it consumed the least budget.

1,500 miles a year is a cherished, garage-kept, second-car life. Below that is a
museum piece and not what this tool is for. A current-model-year generation
returns 0, so a new car can still show delivery mileage.

Under the odometer model this clamp is visible rather than exclusionary: a car
that cannot be as new as the dial asks is priced at the lowest odometer it could
plausibly show, and the card prints that number.

### 3.3 Displayed price

```
displayed = floor(price(m) / 250) * 250
```

The app shows one conservative rounded estimate so locking a result changes
the garage's leftover budget by the same amount the user just saw. `spread`
is retained only as authored uncertainty for future analysis. The interface
labels the number as an estimate and links to live listing searches; it must
not imply that the figure is an appraisal or quote.

### 3.4 New cars

When `status === "current"`, delivery mileage is anchored to `msrpNew` and
the authored used baseline remains independent:

```
price(0) = msrpNew
price(baselineMiles) = base
```

The curve interpolates monotonically between those anchors, then applies the
normal used-price decay beyond `baselineMiles`. A budget at or above MSRP
renders as "New, 0 miles."

A current generation may also appear as a used option if the generation started
more than three years ago. Author it as one record. The curve handles both.

---

## 4. Matching a vehicle to a slot

A slot holds a budget, a role, an odometer, and a set of hard filters.

```
function matches(vehicle, slot):
  if slot.role and slot.role not in vehicle.roles:        return false
  if not passesHardFilters(vehicle.spec, slot.filters):   return false

  m     = plausibleOdometer(slot.odometer, vehicle.years)
  price = estimatedPrice(vehicle.pricing, m)
  if price > slot.budget:                                 return over-budget

  return { vehicle, atMiles: m, price }
```

No single odometer is plausible for every car in a list, so each vehicle is
priced at the closest odometer its own generation could be showing:

```
plausibleOdometer(odo, [firstYear, lastYear])
  = clamp(odo, plausibleMinMiles(lastYear), plausibleMaxMiles(firstYear))

plausibleMaxMiles = min(300000, (currentYear - firstYear + 1) * 22000)
plausibleMinMiles = max(0, (currentYear - lastYear) * 1500)
```

This stops the model from cheerfully offering a 2023 car at 190,000 miles, or a
1994 car at 5,000, because the math allows it. The clamp is not hidden: every
result card prints the odometer it was actually priced at, so a car that could
not reach the dial's setting says so by showing a different number.

The dial's range is 0 to 300,000, matching the hard cap above. A shorter dial
would make "no odometer brings this car into budget" a statement about the
control rather than about the car.

### Ranking

The matcher first finds the highest price the filtered catalog can attain
without exceeding the slot. This becomes the ranking target when the user's
budget is above the catalog's ceiling. Results sort in five-percent price
bands, nearest to that target first. A quality score orders each band:

```
score = 0.70 * budgetFit        // how completely it uses the attainable target
      + 0.22 * roleFit          // primary role match beats secondary role match
      + 0.08 * ownershipIndex   // normalized reliability, parts, maintenance
```

There is no mileage term. Every car in a list is priced at the same odometer,
so mileage is the constant the user set rather than a way to separate results.
The weight it used to carry moved to the two terms that still discriminate.

`budgetFit` peaks at roughly 85 to 100 percent of the attainable target. It is
continuous below that band, so a $30,000 car and a $100,000 car do not tie at
zero when the slot budget is $1 million. A
$4,000 car in a $30,000 slot is technically a match and is almost never the
answer the user wants. Underspending is penalized about half as hard as
overspending, because underspending is at least recoverable.

### Model diversity

Score alone is not enough. Four generations of Miata are four correct answers
to the same question, and the first build returned exactly that: the top four
sports results at $18,000 were all MX-5s, which tells the user nothing.

After sorting, the best example of each `make|model` keeps its score and
subsequent ones are demoted (second to 0.72, third and beyond to 0.55), then
the list is re-sorted. Breadth first, depth second. Depth is still reachable,
it just does not crowd out the answer the user has not thought of.

---

## 5. Hard filters

Exposed per slot. All optional, all AND-ed.

| Filter | Type | Notes |
| --- | --- | --- |
| Transmission | multi-select | manual, automatic, DCT, CVT |
| Drivetrain | multi-select | FWD, RWD, AWD, 4WD |
| Minimum seats | 2 / 4 / 5 / 6 / 7+ | |
| Body style | multi-select | |
| Fuel | multi-select | gas, diesel, hybrid, PHEV, EV |
| Minimum towing | 0 / 3.5k / 5k / 7k / 10k lb | hides anything without a rating |
| Minimum ground clearance | slider | offroad role only |
| Minimum cargo | slider | family and cargo roles only |
| Model year floor | slider, 1990 to current | |
| Minimum reliability | 1 to 5 | |

**Roles preset these filters, they do not replace them.** Choosing `family`
sets minimum seats to 5 and cargo to a sane floor, then leaves every control
visible and editable. A preset the user cannot see and adjust is a black box,
and a black box in a tool that gives financial estimates is a trust problem.

---

## 6. Sourcing and provenance

The original catalog did not retain a source for every individual figure.
The app now discloses that limitation instead of fabricating precision: every
detail record carries catalog-level field-group provenance, an update date,
and a warning to verify the exact year and trim.

```ts
type Source = {
  fields: string[];
  label: string;
  kind: "official" | "public-dataset" | "editorial";
  url?: string;
  note?: string;
};
```

Suggested source hierarchy:

1. **Specs** (power, weight, seats, drivetrain, towing): manufacturer press kits
   and the EPA fuel economy database. Free, citable, stable.
2. **Fuel economy**: EPA `fueleconomy.gov` datasets. Free bulk download, covers
   1984 to present.
3. **Safety and recalls**: NHTSA. Free API, no key. Complaint and recall counts
   are a legitimate, free, citable input into `reliabilityIndex`.
4. **Prices**: authored by hand from observed asking prices, with the sampling
   date recorded. This is an estimate and the app says so everywhere it appears.

Do not scrape a listings site to populate `base`. It creates a terms-of-service
problem, it puts a maintenance burden on a project that is explicitly meant to
be static, and the numbers go stale silently. Hand-authored prices with a
visible `pricesAsOf` date are more honest and less work.

**Consumer Reports and J.D. Power reliability data are licensed and cannot be
republished.** `reliabilityIndex` must be derived from free inputs (NHTSA
complaint volume normalized by units sold, recall severity, known-issue count
and cost from the `notes` field) or authored as an editorial judgment. Label it
as an index, never as a third party's score.

---

## 7. Images

This is the constraint most likely to be underestimated, so it is specified
rather than deferred.

Roughly 250 hero images plus 3 to 6 gallery images each is 1,000 to 1,750
assets. Real automotive photography is copyrighted, and the share card
**distributes** whatever it contains, which is the exact use where informal
reuse stops being defensible.

**Two-tier strategy.**

**Tier 1, in-app (catalog cards and detail modal): real photography.**
- Source from Wikimedia Commons and manufacturer press libraries, per vehicle,
  recording the license and author in the record.
- Store locally, same-origin. Never hotlink.
- Normalize to one treatment so the grid reads as a single system: front
  three-quarter view where available, consistent crop ratio, unified background.
- Attribution renders in the detail modal and on a `/licenses` page. CC BY-SA
  requires it, and it is cheap to do correctly in a modal.

```ts
type Media = {
  heroId: string;
  galleryIds: string[];
  license: {
    kind: "cc0" | "cc-by" | "cc-by-sa" | "press" | "own";
    author: string;
    sourceUrl: string;
    redistributable: boolean;   // gates Tier 2
  };
};
```

**Tier 2, the share card: type-led, no photography by default.**

The share card is a scorecard, not a photo collage. Setting it in the display
face on the accent plate is the stronger design anyway (the reference this
product keeps invoking is type-led, not photographic), and it removes an entire
class of licensing and canvas-tainting problems in one decision.

Where `license.redistributable` is true, a photo may be composited into the
card. Where it is not, the typographic tile is used. Both are designed as
first-class treatments so the card never looks like it fell back to something.

**Decided for Phase 1:** typographic tiles ship, no photography. An early
version reserved a 16:10 image area and filled it with a body-style glyph; on a
phone that was most of the screen for one card and read as a missing image
rather than a decision. The shipped treatment is a compact identity band
(make, model, generation, years, with the glyph as a small mark), which is
honest about having no photograph and materially denser to read.

**Open item, needs a decision before Phase 4:** no image
generation tool is available in this environment, so the 250 hero images cannot
be produced here. The options are (a) source Wikimedia Commons by hand as part
of catalog authoring, (b) generate a consistent illustrated set elsewhere and
import it, or (c) ship Phase 1 with typographic tiles everywhere and add
photography in Phase 4. Option (c) is the recommendation, because it lets the
interaction work get built and tested without blocking on 1,000 assets, and
because the typographic treatment has to exist for the share card regardless.

Placeholder assets during development use `https://picsum.photos/seed/{vehicleId}/{w}/{h}`
so layout work is done against real image dimensions, never against empty boxes.

---

## 8. Catalog authoring plan

Target 250 records. Author in this order so the app is usable at every step.

| Wave | Count | Content |
| --- | --- | --- |
| 1 | 60 | Two or three obvious answers per role across three price tiers. Enough to build and feel the whole interaction. |
| 2 | +70 | Fill the gaps the ranking exposes. Anywhere a slot returns fewer than 8 results, author more. |
| 3 | +80 | Depth: the second and third choices, the wagons, the oddities, the current-model-year new cars. |
| 4 | +40 | Long tail and requests. |

Store as one JSON file per wave under `data/catalog/`, merged at build time and
validated against a Zod schema. A record that fails validation fails the build.
Bad data in a tool that quotes prices is worse than missing data.

Sanity checks to run in CI over the whole catalog:

- Every role has at least 12 vehicles spanning at least three price tiers.
- No `floor` greater than `base`.
- No `decay` outside 0.02 to 0.30.
- `milesAffordable(base)` returns approximately `baselineMiles` for every record.
- Every `pricing.base` has a `Source` entry.
- `plausibleMaxMiles` is at least 40,000 for every record older than 3 years.

---

## 9. State encoding

The entire garage lives in the URL. There is no backend and no account.

```ts
type GarageState = {
  v: 1;                        // schema version, first field, never moves
  budget: number;
  slots: SlotState[];
  title?: string;              // optional user label
};

type SlotState = {
  role: Role | null;
  share: number;               // 0..1 of remaining budget, fluid slots only
  pinned: boolean;
  pick: VehicleId | null;
  condition: ConditionId;      // index into CONDITION_ORDER on the wire
  filters: Partial<Filters>;   // only non-default values are serialized
};
```

Condition is encoded as an index into a fixed order, so bands may be renamed,
recoloured or re-anchored but never reordered or removed. Links written before
bands existed carry a raw `odometer` instead; those are read and snapped to the
nearest band, so the tag a recipient sees and the price they see come from the
same number.

Encoded as `?g=<version>.<base64url(JSON)>`. Only non-default fields are
serialized, which keeps a typical 4-slot garage under 300 characters.

The `v` field is first and permanent. When the schema changes, old links must
still open. A link that 404s is a link that stops spreading, and the link is
the whole distribution model.

Write with `history.replaceState` on every change, debounced to 400ms, so the
back button still means "back" rather than "undo one slider tick."

---

## 10. What this model deliberately does not do

- **No live pricing.** Estimates, stamped with a date, stated plainly in the UI.
- **No VIN lookup, no listings, no inventory.** Outbound search links to
  AutoTempest or similar are a Phase 4 nicety, not a data dependency.
- **No trim-level pricing.** Packages carry a typical premium and that is the
  resolution the product needs.
- **No regional variation.** US national. Stated in the footer.
- **No total cost of ownership in the budget.** Budget is purchase price only,
  per the product decision. Ownership figures are displayed alongside, never
  folded into the constraint.
