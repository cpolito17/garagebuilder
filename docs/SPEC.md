# Garage Challenge - Product Spec

A tool for deciding how to spend one car budget across several cars that each
do a different job.

Set a total budget. Choose how many slots you want to fill and what each one is
for. The tool shows what that money actually buys in each slot, including the
odometer reading the budget implies. Lock one car per slot, then send the
finished garage to someone as a challenge: same budget, same slots, beat it.

**Status:** specification. No implementation yet.

---

## 1. Scope

### Locked decisions

| Decision | Value |
| --- | --- |
| Market | United States only |
| Model years | 1990 to current |
| New cars | Included, alongside used |
| Budget means | Purchase price only. Not tax, title, registration, insurance, or running costs. |
| Catalog | ~250 hand-authored vehicle generations |
| Voice | Functional. It is a real tool, not a bit. |
| Share loop | "Beat my $50,000 Garage" - same budget, same slots, head to head |
| Architecture | Static site, full state in the URL, no backend, no accounts |
| Ambition | A tool worth using. Public release only if it turns out to be good. |

### What it is not

Not a listings site. Not a valuation service. Not a dealer lead generator. It
quotes estimates from an offline catalog and says so on every price it shows.

### A revision to the earlier proposal

An earlier draft of this concept leaned on archetype names, a roast mode, and
joke copy on the caution badges. That is cut. The tool reads as an instrument:
the numbers are the interesting part, and dressing them up makes them less
believable, not more fun. The one place personality survives is the share
challenge, because a challenge needs a voice to be a challenge.

The high-mileage caution data stays, written factually. "Timing chain guides
wear at 80,000 to 120,000 miles, about $2,400" is more useful, more shareable,
and more credible than a punchline about it.

---

## 2. Core model

**Budget.** One number, entered once, at the top. Purchase price only.

**Slot.** One car you intend to buy. Between 1 and 5 of them. A slot has a
role, a share of the budget, a mileage ceiling, a filter set, and eventually a
locked pick.

**Role.** What the slot is for. Roles preset filters and bias ranking. They
never hide a control.

`sports` / `commuter` / `family` / `offroad` / `tow` / `winter` /
`grand-tourer` / `cargo` / `track` / `project`

**Pick.** The starred car for a slot. Starring pins that slot's budget to the
car's actual price and redistributes the remainder across the unpinned slots.

**Garage.** The full set. It is the thing that gets shared, and it is scored as
a set, not as five independent results.

---

## 3. Screens

Three surfaces. Two of them are product UI, one is marketing.

| Surface | Purpose |
| --- | --- |
| **Builder** | The application. Budget, slots, filters, results, locking. |
| **Detail** | Modal over the builder. Everything known about one vehicle. |
| **Challenge** | What a recipient sees when they open a shared link. |
| **Landing** | Marketing page. Only exists if the tool goes public. |

---

## 4. Builder

### 4.1 Layout

**Mobile is the primary layout.** Every share this tool produces gets opened on
a phone. Columns are the desktop expression of the design, not its basis.

**Mobile (below 768px)**
- Budget control pinned to the top as a translucent bar.
- Slot rail directly beneath it: horizontally scrolling chips, one per slot,
  each showing role, allocated dollars, and lock state. Tap to switch.
- Active slot's filters collapse into a sheet behind a single control.
- Results as a single-column feed.

**Desktop (768px and up)**
- Budget control as a full-width bar at the top.
- Slots as columns, 1 to 5, each with its own allocation handle, filter set,
  and result list.
- At 4 and 5 slots the columns become horizontally scrollable rather than
  compressing below a legible width. A column never goes narrower than 320px.

### 4.2 The allocation bar

This is the central interaction and the most likely thing to get wrong.

**The mistake to avoid:** requiring the user to set five percentages before
anything happens. Nobody knows that a fun car "should be" 22 percent of their
money. They know they want a small convertible, a truck, and something for
winter, and they find out what that costs afterward.

**The model:** allocation is an output that can be overridden, not an input that
must be supplied.

1. User sets a total budget and picks roles for each slot.
2. The tool allocates immediately using per-role weights, so results appear
   before the user has touched a slider.
3. Each slot is either **fluid** (shares the unallocated remainder in proportion
   to its handle) or **pinned** (consumes exactly its picked car's price).
4. Starring a car pins that slot. The remainder redistributes across the
   fluid slots, and their results re-filter live.
5. Dragging a fluid slot's handle redistributes among the other fluid slots
   only. Pinned slots never move.

**Overspending is allowed.** Dragging past the remainder does not clamp. The
bar enters an over-budget state, shows the overage in dollars, and the affected
slots keep showing results. A slider that silently refuses to move reads as
broken; one that lets you go over and tells you reads as a tool.

**Underspending is allowed too.** With two or more fluid slots the others
absorb whatever one slot gives up, so the total holds at the budget. With a
single slot there is nothing to absorb it, and dragging down simply spends
less. That is a real choice, not an error, and the allocation reports it as
unspent dollars rather than snapping back.

**The books always balance to the dollar.** Allocation seats every slot at its
floor first and apportions the surplus by largest remainder. Naive per-slot
rounding drifted the total by $371 across five slots, and a naive floor clamp
broke the sum outright.

**Default role weights** for first allocation:

| Role | Weight |
| --- | --- |
| sports, track, grand-tourer | 1.3 |
| family, tow, offroad | 1.2 |
| cargo | 1.0 |
| commuter | 0.8 |
| winter, project | 0.5 |

Normalized across the chosen slots. These exist to produce a sane first screen,
nothing more.

**Auto-allocate** is a persistent control, not a one-time step. It re-solves the
split across all fluid slots to maximize total ranking score under the budget
constraint. It is the fastest path to a good garage and it re-runs cleanly after
any pin.

A plain greedy marginal allocation does not work, and the reason is worth
recording. A slot's value function is not concave: an off-road slot is worth
nothing at all until it clears the cheapest 4x4's price floor, then jumps.
Marginal-gain greedy sees zero gain from every step below that cliff, never
invests, and starves the slot permanently. Measured directly on a four slot
$55,000 garage: sports and commuter were funded to $20k and $28k while family
and off-road were left at $3,282 and $2,836 with no matches at all.

The shipped solver seats every slot at its entry price first, cheapest first so
a limited pot funds as many working slots as it can, then distributes the rest
by gain per dollar over a lookahead window rather than a single step. On the
same garage it raised total pick quality from 2.43 to 3.25 and funded every
slot.

When the pot genuinely cannot fund every slot the tool says so rather than
leaving a silent gap. A $25,000 three car garage with sports, commuter and
family slots needs $31,750 to give all three something, and the header states
that plainly.

### 4.3 The mileage control

One control per slot: a **mileage ceiling**, from 0 up to 250,000, default
120,000.

It is not a filter on a mileage field. It reads the price curve backwards. For
a given slot budget, every vehicle has a required odometer (see
`DATA-MODEL.md` section 3.2). The ceiling decides which required odometers are
acceptable.

Raise the ceiling and expensive cars enter the list, each labeled with the
mileage that budget actually buys:

> **$18,000 buys:** Mazda MX-5 (NC) at ~18,000 miles. Honda Civic Si at
> ~108,000 miles. Mercedes-AMG E63 (W212) at ~115,000 miles.

Every result card states its implied odometer next to its price, because the
odometer is half the offer.

A card shows a caution marker when the implied odometer has passed the onset of
any documented issue. There is no arbitrary mileage gate: an issue that starts
at 60,000 miles is exactly as relevant when buying at 80,000 as one starting at
120,000 is when buying at 140,000, and an earlier draft's 100,000 mile
threshold would have hidden the first case. The marker is factual and expands
to the issue, its mileage window, and the typical cost. It never blocks
selection.

Cautions are ordered by cost, so the expensive one is read first.

### 4.4 Filters

Per slot, in a disclosure below the role. Presets from the role are visible and
editable. Full list in `DATA-MODEL.md` section 5.

Filter changes apply instantly. No apply button.

Every filter shows its result count impact before it is applied where that is
cheap to compute, so the user does not filter themselves into an empty list
blind. An empty result set renders a designed empty state naming the specific
constraint that eliminated the last candidate, with a control to relax it.

The empty state distinguishes four causes, because they have different fixes:

| Cause | What it says |
| --- | --- |
| Mileage ceiling | Names the closest vehicle and the odometer it needs, with a button that raises the limit to exactly that |
| Below every price floor | Names the closest vehicle and how much more it needs at any odometer |
| Odometer implausible for the age | Says the budget is too low for this slot |
| Filter combination | Names the pairing to relax |

A budget sitting exactly on a vehicle's price floor has a shortfall of zero, so
the shortfall message never promises below one $500 step. "Needs about $0 more"
is not a sentence.

### 4.5 Result card

Contains, in order of visual weight:

1. Vehicle image (or typographic tile, per `DATA-MODEL.md` section 7)
2. Year span, make, model, generation
3. One rounded estimated price for this slot
4. Implied odometer
5. Three spec chips chosen by the slot's role (a sports slot shows power,
   drivetrain, transmission; a family slot shows seats, cargo, MPG)
6. Caution marker, when applicable
7. Star control

The card is the densest surface in the product. It is where `VISUAL_DENSITY`
runs highest and where the mono numerals earn their place.

### 4.6 Starring and locking

One star per slot. Starring:

- Pins the slot to the displayed estimated price.
- Redistributes the remainder across fluid slots with a spring, not a jump.
- Collapses the slot to a compact locked state showing the pick.
- Leaves an obvious unlock control.

When every slot is pinned, the garage summary becomes available.

### 4.7 Garage summary

Appears once all slots are locked. It evaluates the set, which is the part no
other tool does.

- **Total spend** against budget, with the delta.
- **Coverage.** Which of the standard capabilities the garage can and cannot
  do: carry more than two people, carry more than four, tow, handle snow,
  handle unpaved roads, and cover miles cheaply. Rendered as
  present or absent, factually, from the spec fields. No score, no grade.
- **Overlap.** Where two slots return substantially the same capability
  profile, it is stated once, plainly. Two RWD manual coupes is a fact about
  the garage, and a fact is enough.
- **Running cost.** Combined annual maintenance estimate and combined fuel cost
  at 12,000 miles per garage per year, split evenly between its cars. Shown alongside the budget, never
  folded into it, because the budget decision is purchase price only.

This section is where the tool is most useful and where it must be least
clever. State the facts.

---

## 5. Detail modal

Opens over the builder from the card that triggered it, anchored to that card's
position (see `DESIGN.md` section 6.3). Dismisses along the same path.

Contents:

1. **Gallery.** 3 to 6 images, swipeable, with license attribution.
2. **Identity.** Years, generation code, body, what it replaced and what
   replaced it.
3. **Price curve.** A small chart: price against odometer, with the slot's
   current budget marked as a horizontal line and the implied odometer marked
   on the curve. This one visual explains the entire product in about two
   seconds and it belongs here.
4. **Specs.** Full spec block, grouped, mono numerals.
5. **Options and packages.** Name, what it adds, typical premium. This is the
   "what to actually look for" content and it is a real reason to open the
   modal.
6. **Known issues.** Each with its mileage window, typical cost, and severity.
7. **Service milestones.** What is due at what odometer and what it costs.
8. **Ownership.** Reliability, insurance, and parts indices; annual maintenance;
   DIY friendliness. Indices are labeled as indices.
9. **Sources and image credits.**

Keyboard: `Esc` closes, focus is trapped while open, focus returns to the
triggering card on close.

---

## 6. The share loop

The share is not a feature bolted on at the end. It is the distribution model,
and it is the only surface where the tool is allowed a voice.

### 6.1 What gets produced

**A link.** The full garage encoded in the URL. Opening it loads that exact
garage.

**A card.** A rendered image for posting, generated client-side on canvas.
1080x1920 for stories, 1200x630 for link previews.

The card contains: the budget as the headline, the slot count, each slot's role
and locked pick with year and price, the total spend, and the challenge line.

It is type-led. Photography appears only where the record's license permits
redistribution. See `DATA-MODEL.md` section 7.

### 6.2 The challenge

The share CTA is **"Beat my $50,000 Garage."**

A recipient opening the link lands on the **Challenge** surface, not the empty
builder. It shows the sender's garage, read-only, and one primary action:

> **Take the challenge**

Taking it opens the builder with the **same total budget** and the **same slot
count and roles**, all slots empty. The constraint is inherited so the comparison
is fair. That fairness is the entire reason the loop works: an open-ended "build
a garage" is a blank page, while "you have $50,000 and these four jobs to cover,
do better than this" is a game with a move to make.

On completing a challenge garage, a **head to head** view puts both garages side
by side with their spends, picks, and coverage, and produces a second card that
shows both. That second card is the one that gets posted back, which is what
turns one share into a thread.

### 6.3 What the loop needs to work

- The link must always open. Schema version is permanent and old links are
  supported forever (`DATA-MODEL.md` section 9).
- The card must be legible at thumbnail size in a group chat. That is the real
  viewing condition, and it constrains the type scale hard.
- No signup, ever, anywhere in the loop. An account gate at the share step
  would kill it outright.

### 6.4 Per-garage link previews

A static site cannot serve per-garage Open Graph tags, so every pasted link
would show the same generic card in iMessage, Discord, and X. That is a direct
tax on the only distribution mechanism this product has, so it is fixed by a
small Cloudflare Worker in front of the same static assets (`worker/index.ts`,
`wrangler.jsonc`). The app is unchanged and still works without it: the Worker
decodes the state parameter it already receives, rewrites the meta tags in the
served HTML, and passes everything that is not HTML straight through.

A garage with pinned picks previews as:

> **Beat my $50,000 garage**
> Mazda MX-5 Miata, Honda S2000, Toyota 4Runner. $50,000 spent, 674 hp,
> 2 manual-equipped cars. Same budget, same slots. Do better.

A link with no readable state gets the generic preview; a garage saved with
nothing pinned yet is someone's work in progress rather than a challenge, so it
previews as `A $50,000 garage, 3 cars`. Garage state is attacker controlled,
so every injected value is escaped for an HTML attribute and a test asserts
that a hostile payload cannot break out of one.

**The preview image is not rendered per garage.** Doing that at the edge needs
a WebAssembly SVG rasteriser plus an embedded font, which measured 1,359 kB
gzipped against Cloudflare's 1,024 kB free-tier limit, to reproduce an image
the client already renders locally. Every link therefore points at
`/og-default.png`, which is not a mock: `npm run og:default` drives the real
app in a browser, locks three cars, and downloads the app's own 1200x630 share
card. The title and description carry the specifics, and those are what every
platform renders as text. If per-garage images later prove worth a paid plan,
the client-side renderer in `src/lib/shareCard.ts` is already the source of
truth for the layout.

---

## 7. Landing page

Built. `src/components/Landing.tsx`. A marketing surface, so
`design-taste-frontend` governs it in full including its pre-flight checklist
(see `DESIGN.md` section 1.2), at dials 7 / 5 / 3.

### 7.1 Where it sits

A cold visit to `/` gets the landing page. Everything else goes straight to the
builder: `#build`, `#credits`, and above all any URL carrying `?g=`. A shared
link that stopped at a marketing page would break the only loop this product
has, so the landing page is an entry, never a gate. The builder writes its
state to the URL with `replaceState`, and that write is suppressed while the
landing page is showing, so browsing the landing page never leaves a garage
nobody built in the address bar.

### 7.2 What is on it

Six sections, six different layout families, one call to action ("Build your
garage") used three times with no second intent anywhere on the page.

1. **Hero.** Asymmetric split. Two-line headline, one sentence, the CTA, and
   the real allocation mechanic running beside it: three slots, three real
   sliders, the real catalog behind them. Dragging one moves money out of the
   others and re-picks their cars, which is the entire product in one gesture.
   No screenshot, no mockup.
2. **The curve.** One real car at three real budgets, computed by the same
   inversion the builder runs, so the figures on the marketing page cannot
   drift from what the tool would actually offer. Tile widths fall as the
   odometer falls. Carries the honest statement about estimates: authored
   curves calibrated against asking prices, not listings, not an appraisal,
   and they will drift.
3. **The loop.** The share card, rendered on scroll into view by the same
   canvas renderer the share panel uses, with its picks derived from the
   matcher rather than a hardcoded list so it cannot advertise a car the
   catalog has since dropped.
4. **Breadth.** The catalog count, then the one marquee on the page. A number
   says the catalog is big; the names answer the only question a reader
   actually has, which is whether their car is in it.
5. **Limits.** What the tool does not do, in four short statements.
6. **Close.** The same CTA, centred.

No testimonials, no logo wall, no pricing table, no eyebrows, no scroll cues,
no fabricated names or numbers. There is nothing to sell.

### 7.3 Verified mechanically

`scripts/audit.mjs` runs the checkable half of the pre-flight list against the
rendered page in both themes: zero em-dashes, eyebrow count against the
sections-over-three cap, one call to action, nav on one line under 80px, hero
headline within two lines with the subtext under 20 words and the CTA above the
fold, one marquee, radii inside the shape system, no section inverting the page
theme, 44px targets, no duplicate ids, and WCAG AA on every text and background
pair. `scripts/smoke.mjs` covers the routing: the landing renders cold, its
hero slider actually moves the allocation, the CTA reaches the builder, and a
link carrying a garage skips the landing entirely.

---

## 8. Build phases

Ordered so the riskiest thing is proved first.

**Phase 1 - The math and the mechanic. Built.**
- Catalog schema, Zod validation, 60 records (Wave 1).
- Price curve and the mileage inversion as pure, unit-tested functions.
- Budget bar with fluid and pinned slots, mobile layout.
- Result list, star and lock, redistribution.
- No modal, no share, typographic tiles for all vehicles.

Delivered with 63 tests, a mechanical accessibility audit, and both themes
verified in a browser. One small addition beyond the listed scope: a manual
transmission toggle, because it exercises the filter plumbing end to end and is
the single filter an enthusiast reaches for first. Full filters remain Phase 2.

The goal of Phase 1 was to answer one question: does watching the budget
squeeze when you star a car feel good. It does. Starring a $29,448 GR86 in a
$50,000 three slot garage visibly pulls the other two columns down and
re-filters both lists, and the total holds at exactly $50,000.

**Phase 2 - Depth. Built.**
- Detail modal with the price curve chart.
- Filters in full, role presets, empty and error states.
- Garage summary with coverage and overlap.
- Catalog to 135 records (Wave 2), every role at twelve or more vehicles
  across three price tiers.

Two catalog gaps were found by the coverage checks rather than by inspection:
the family role had nothing under $12,000 and the off-road role had no cheap
4x4 at all. Both are now filled, because someone on a small budget who needs to
move people, or who wants a Cherokee XJ, is exactly who this tool is for.

**Phase 3 - The loop. Built.**
- URL encoding and restore. A three car garage is 305 characters.
- Share card rendering on canvas, both aspect ratios.
- Challenge surface and inherited constraints.
- Head to head view.

Verified end to end in a fresh browser context: link copied, opened cold,
presented as a challenge, budget and slot roles inherited, picks cleared, head
to head rendered.

**Phase 4 - Polish and scale. Built.**
- Real photography system, licensing page: built. The photographs themselves
  are fetched by `npm run images` and could not be downloaded in the build
  environment, whose network policy blocks every image host.
- Outbound search links to listings sites: built, in the detail view.
- Catalog to 250: done. Every role carries well over the twelve vehicle target
  across three price tiers, and the payload stayed inside the ceiling because
  the headroom was bought first (DESIGN.md section 10).
- OG Worker: built. Per-garage titles and descriptions on every shared link,
  with the generic preview as the fallback for anything unreadable. The
  preview image stays generic on purpose (section 6.4).
- Landing page: built, section 7.

---

## 9. Out of scope

Explicitly not building, in any phase, without a new decision:

- Accounts, saved garages, history.
- Live market data, listings, inventory, VIN decode.
- Non-US markets and currencies.
- Financing, payments, insurance quotes, dealer contact.
- Trim-level or option-level pricing.
- Total cost of ownership folded into the budget constraint.
- Any recommendation presented as advice rather than as an estimate.

---

## 10. Open questions

1. **Images.** Resolved in design, blocked in execution. The photography system
   is built: a manifest with per-file licence and author, a fetcher that filters
   Commons by licence and generation, attribution in the detail view and on a
   credits page, and a typographic fallback that is a designed state rather
   than a gap. No photographs could be fetched here because the build
   environment's network policy denies every image host. Run `npm run images`
   somewhere with network access. Details in `DATA-MODEL.md` section 7.
2. **Reliability index derivation.** Consumer Reports and J.D. Power data are
   licensed and cannot be republished. The index has to come from free inputs
   or be authored editorially and labeled as such.
3. **Slot count above 3 on desktop.** Horizontal scroll at 4 and 5 columns is
   specified, but it is worth checking against a real 5-slot garage before
   committing, because a scroll that hides a slot also hides the comparison
   that makes the tool work.
