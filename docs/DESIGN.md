# Garage Challenge - Design System

Derived from three skills: `design-taste-frontend`, `high-end-visual-design`,
and `apple-design`. They do not fully agree. Section 1 states which one governs
where and why, so the resolutions are auditable instead of arbitrary.

---

## 1. Design read, surfaces, and conflict resolution

### 1.1 Design read

> Reading this as: a **product tool** for car enthusiasts, with a
> **precision-instrument** language, leaning toward Tailwind v4 + Geist +
> Apple-style spring physics on every gesture.

The reference object is a pit-wall timing display, not a landing page. Dense
numerals, hairline structure, one accent that means "selected," restraint
everywhere else. The user's brief was explicit: functional, less personality.
The numbers are the interesting part and decoration makes them less believable.

### 1.2 Surface split, and an honest scope note

`design-taste-frontend` scopes itself out of product UI in its own Section 13:
dashboards, dense product surfaces, and multi-step interactions are named as
out of scope. Garage Challenge is product UI. Pretending otherwise would apply
landing-page rules to a builder and produce a worse builder.

Resolution:

| Surface | Governing skill | Applies |
| --- | --- | --- |
| **Builder, Detail, Challenge** (product UI) | `apple-design` for interaction and materials, `high-end-visual-design` for component architecture | `design-taste-frontend` applies only through its taste rules: typography, color discipline, AI tells, copy, accessibility |
| **Share card** (rendered image) | Own rules, section 8 | Type-led, thumbnail-legible |
| **Landing page** (Phase 4, only if public) | `design-taste-frontend` in full | Every rule, including the pre-flight checklist |

### 1.3 Conflicts, resolved

**Eyebrow labels.** `high-end-visual-design` section 4.C mandates a pill-shaped
uppercase eyebrow above major headings. `design-taste-frontend` section 4.7 caps
eyebrows at one per three sections and calls them the most-violated AI tell.

*Resolution: the cap wins.* Uppercase micro-labels are used only as **functional
field labels** inside the builder ("BUDGET", "SLOT 2"), where they name a control
rather than decorate a heading. Zero decorative eyebrows anywhere. The brief
said functional, and a label above every heading is the opposite.

**Fonts.** `apple-design` section 15 says default to the platform system font.
`high-end-visual-design` section 2 bans Helvetica and the system-adjacent stack.

*Resolution: Geist and Geist Mono, self-hosted.* Justified on a product ground
rather than a taste one: this interface is mostly numbers that must align in
columns and change without reflowing, which requires true tabular figures. Geist
Mono has them. The system stack is the fallback.

**Density.** `high-end-visual-design` demands `py-24` to `py-40` macro
whitespace. That is landing-page spacing and it would put four result cards on a
phone screen.

*Resolution: macro whitespace applies to the landing page only.* The builder
runs at daily-app density. Section 2 sets both dial sets explicitly.

**Backdrop blur.** All three skills want translucent chrome; two of them warn it
destroys mobile frame rate on scrolling containers.

*Resolution: blur on fixed and sticky chrome only.* The budget bar, the slot
rail, and the modal scrim. Never on a card, never on a scrolling list. This is a
hard rule and it is in the pre-flight checklist.

---

## 2. Dials

Two surfaces, two settings. Declaring one set for both would be dishonest.

| Surface | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY |
| --- | --- | --- | --- |
| **Builder / Detail / Challenge** | **5** | **7** | **6** |
| **Landing** (Phase 4) | **7** | **5** | **3** |

**Builder reasoning.** Variance 5 because structure serves comparison: five
slots that look different are five slots that cannot be compared. Motion 7
because the allocation bar is a direct-manipulation gesture and gesture UI
without real physics feels broken, not calm. Density 6 because a result card
carries a price, an odometer, three spec chips, and a caution state, and
spreading that out costs the user scrolling with no gain.

**Landing reasoning.** Variance 7 and density 3 are the marketing defaults.
Motion drops to 5 because the page's job is to show the builder working, and
motion competing with an embedded live tool is noise.

---

## 3. Typography

Geist and Geist Mono, self-hosted as woff2 with `font-display: swap`. Never a
Google Fonts `<link>`.

**Tracking is size-specific.** A single `letter-spacing` value is wrong
somewhere: display type reads too loose as it grows, small type reads too tight.

| Token | Size | Weight | Leading | Tracking | Use |
| --- | --- | --- | --- | --- | --- |
| `display` | `clamp(2.5rem, 6vw, 4rem)` | 600 | 1.00 | `-0.035em` | Share card headline, landing hero |
| `h1` | `clamp(1.75rem, 3vw, 2.25rem)` | 600 | 1.08 | `-0.022em` | Budget figure, garage summary |
| `h2` | `1.375rem` | 550 | 1.18 | `-0.016em` | Modal title, slot heading |
| `h3` | `1.0625rem` | 550 | 1.30 | `-0.008em` | Card title (year, make, model) |
| `body` | `0.9375rem` | 400 | 1.55 | `0` | Prose, known issues, notes |
| `small` | `0.8125rem` | 400 | 1.45 | `+0.004em` | Secondary card text, captions |
| `label` | `0.6875rem` | 550 | 1.30 | `+0.07em` | Uppercase field labels only |

**Numerals** use Geist Mono with `font-variant-numeric: tabular-nums` and
tracking `-0.01em`. Every price, odometer, horsepower figure, and percentage.
Non-negotiable: a price that shifts width as it animates from $18,000 to $19,250
is a visible defect in a tool whose entire job is showing numbers changing.

**Scale with `rem`, never fixed `px`,** so a user's text-size setting enlarges
the interface instead of breaking it.

**Emphasis inside a heading uses weight or italic of the same family.** Never a
second family. No serif anywhere in this project.

---

## 4. Color

One accent, locked across every surface. Two semantic colors that are states,
not decoration, and are never used decoratively.

Cool graphite throughout. No warm greys mixed in at any point.

### 4.1 Tokens

Defined on `:root` for light; redefined under both
`@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`
and `:root[data-theme="dark"]`, so an explicit toggle wins in both directions.

```css
:root {
  /* Neutral ground */
  --bg-base:      #F4F4F5;   /* page */
  --bg-shell:     #EAEAEC;   /* outer bezel tray */
  --bg-surface:   #FBFBFC;   /* inner card core */
  --bg-raised:    #FFFFFE;   /* modal, popover */

  --text-primary:   #18181B;
  --text-secondary: #52525B;
  --text-tertiary:  #8E8E96;   /* 4.5:1 on --bg-surface */

  --hairline:       rgb(24 24 27 / 0.09);
  --hairline-strong:rgb(24 24 27 / 0.16);

  /* Accent: signal green. Means selected, locked, confirmed. */
  --accent:        #067A46;
  --accent-hover:  #056239;
  --accent-on:     #FBFBFC;    /* text on accent fill, 5.4:1 */
  --accent-wash:   rgb(6 122 70 / 0.08);

  /* Semantic states only. Never decoration. */
  --caution:       #9A5600;    /* high-mileage known issue */
  --caution-wash:  rgb(154 86 0 / 0.09);
  --over:          #B42318;    /* over budget */
  --over-wash:     rgb(180 35 24 / 0.09);
}

:root:not([data-theme="light"]) { /* under prefers-color-scheme: dark */
  --bg-base:      #0B0B0D;
  --bg-shell:     #101013;
  --bg-surface:   #161619;
  --bg-raised:    #1C1C20;

  --text-primary:   #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-tertiary:  #7C7C85;

  --hairline:       rgb(250 250 250 / 0.10);
  --hairline-strong:rgb(250 250 250 / 0.18);

  --accent:        #3FBF7F;
  --accent-hover:  #55CE91;
  --accent-on:     #0B0B0D;    /* dark text on light accent fill */
  --accent-wash:   rgb(63 191 127 / 0.14);

  --caution:       #E8A33D;
  --caution-wash:  rgb(232 163 61 / 0.15);
  --over:          #F97066;
  --over-wash:     rgb(249 112 102 / 0.15);
}
```

Same tokens repeated under `:root[data-theme="dark"]`.

### 4.2 Rules

- **No pure black, no pure white.** Both modes use off values, above.
- **One accent, whole app.** Green is "locked in." It appears on the star's
  active state, the pinned slot's rail, the primary CTA, and nowhere else. A
  blue button in the modal or a teal chip in the footer is a defect.
- **Semantic colors never decorate.** Amber means a documented known issue at
  the implied odometer. Red means the allocation exceeds the budget. If either
  appears for any other reason, it is a bug.
- **No gradients as decoration.** The only permitted gradient is the scroll-edge
  mask under fixed chrome (section 6.4).
- **Page theme lock.** One theme for the whole page. No section inverts.
- **No glow.** No neon outer shadows, no colored bloom. Depth comes from
  hairlines, inset highlights, and tinted ambient shadow.

### 4.3 Shadows

Tinted to the background hue, never pure black on light.

```css
--shadow-card:  0 1px 2px rgb(24 24 27 / 0.04),
                0 8px 24px rgb(24 24 27 / 0.06);
--shadow-modal: 0 2px 8px rgb(24 24 27 / 0.08),
                0 24px 64px rgb(24 24 27 / 0.16);
```

Dark mode deepens the alpha rather than switching to a different family.

---

## 5. Shape

**One radius system.** Concentric, because a rounded box inside a rounded box
with the same radius reads as a mistake at every corner.

```
innerRadius = outerRadius - shellPadding
```

| Element | Outer | Padding | Inner |
| --- | --- | --- | --- |
| Result card, modal, budget bar | `20px` | `6px` | `14px` |
| Slot column shell | `24px` | `8px` | `16px` |
| Input, chip, select | `10px` | - | - |
| Button, star, star toggle | full pill | - | - |

The rule is documented so it can be followed everywhere: **containers are
20 to 24px, controls inside them are 10 to 16px, buttons are pills.** Mixing a
square card into a pill-button layout is a defect.

---

## 6. Components

### 6.1 The nested shell (double bezel)

Every major container is two elements, not one: an outer tray and an inner core.
It is what makes a card read as a machined object sitting in a housing rather
than a rectangle painted on a background.

```html
<!-- Outer shell: the tray -->
<div class="rounded-[20px] p-1.5 bg-[--bg-shell] ring-1 ring-[--hairline]">
  <!-- Inner core: the plate -->
  <div class="rounded-[14px] bg-[--bg-surface]
              shadow-[inset_0_1px_0_rgb(255_255_255/0.55)]">
    ...
  </div>
</div>
```

Dark mode swaps the inset highlight to `rgb(255 255 255 / 0.06)`.

Applied to: result cards, slot columns, the budget bar, the modal, the share
card's slot tiles. Not applied to chips, inputs, or anything under 44px tall,
where the nesting is invisible and only costs DOM.

### 6.2 Buttons

Pill, `px-5 py-2.5` minimum, 44px minimum touch target on every interactive
element without exception.

**Trailing icon nests in its own circle,** flush with the button's right inner
padding, never floating naked beside the label:

```html
<button class="group inline-flex items-center gap-3 rounded-full
               bg-[--accent] pl-5 pr-1.5 py-1.5 text-[--accent-on]">
  <span>Take the challenge</span>
  <span class="grid h-8 w-8 place-items-center rounded-full bg-black/12
               transition-transform duration-300
               ease-[cubic-bezier(0.32,0.72,0,1)]
               group-hover:translate-x-0.5 group-hover:-translate-y-px
               group-hover:scale-105">
    <ArrowUpRight weight="regular" />
  </span>
</button>
```

**Contrast is verified, not assumed.** Every button label passes WCAG AA against
its own fill: `--accent-on` on `--accent` is 5.4:1 light, 9.1:1 dark. A ghost
button over an image gets a scrim or a stroke.

**Labels fit on one line at every breakpoint.** Primary CTAs are 1 to 3 words.
A wrapped CTA is a defect.

**One label per intent.** The share action is "Beat my $50,000 Garage"
everywhere it appears. Not "Share garage" in one place and "Challenge a friend"
in another.

### 6.3 Icons

`@phosphor-icons/react`, `weight="regular"` throughout, one family, no
exceptions. `weight="fill"` is reserved for exactly one thing: the star in its
active state, where the fill *is* the state change.

No hand-drawn SVG paths. If a glyph is missing, add a second Phosphor import,
do not draw it.

### 6.4 Materials and chrome

Translucent chrome, per `apple-design` section 12. Content scrolls under it.

```css
.chrome {
  background: rgb(244 244 245 / 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--hairline);
}
```

- Applied to the budget bar and the slot rail (both fixed) and the modal scrim.
  **Never to a scrolling container.**
- **Do not hand-write the `-webkit-` prefix.** Declaring both the prefixed and
  unprefixed property made Lightning CSS keep only the prefixed one, and the
  blur silently never applied in Chromium. Write `backdrop-filter` alone and
  let the build add prefixes. Verified in a browser, not by reading the source:
  a computed style of `none` on the header is the only way this shows up.
- **Scroll edge, not a divider.** Where content meets fixed chrome, fade a short
  gradient mask instead of drawing a hard 1px line. Only where chrome actually
  overlaps content.
- **Never stack two light translucent surfaces.** The modal is opaque
  `--bg-raised` over a translucent scrim, not glass over glass.
- Bigger surfaces read as thicker: the modal takes a stronger blur and a deeper
  shadow than the slot rail.

### 6.5 Result card

Densest surface in the product.

- Nested shell, `20px` outer.
- Image or typographic tile at 16:10, fixed aspect ratio reserved before load so
  CLS stays at zero.
- Title in `h3`. Price range and implied odometer in mono, same baseline, price
  at full weight and odometer at `--text-secondary`.
- Three role-selected spec chips, `10px` radius, hairline border, no fill.
- Caution marker: amber dot plus label, expands in place. Never blocks the star.
- Star: pill, top-right, 44px target, `--accent` fill when active.
- `:active` gives `scale(0.985)` in 100ms. Feedback on press, not on release.

### 6.6 Detail modal

- Opens **from the card that triggered it.** `transform-origin` is set to the
  card's live position so it grows out of its source, and it dismisses back
  along the same path. Enter and exit are the same path, always.
- Spring: `bounce 0.2, duration 0.3`. Blur and scale animate together so the
  surface materializes rather than fading in.
- Scrim dims and pushes the builder back slightly. The task is modal, so the
  dim is correct here (a non-blocking panel would use translucency without a
  scrim).
- Focus trapped, `Esc` closes, focus returns to the triggering card.
- Draggable down to dismiss on touch, with velocity handoff and rubber-banding
  (section 7).

### 6.7 States

Every one of these is designed, not defaulted.

**Loading.** Skeletons that match the final card geometry exactly. No spinners.
The catalog is local so this window is short, but the reserved geometry is what
holds CLS at zero.

**Empty (no results).** Names the specific constraint that eliminated the last
candidate ("No manual transmission at this budget above 1998") and offers the
single control that relaxes it. Never a shrug.

**Over budget.** The allocation bar shifts to `--over-wash` with the overage in
mono. Results keep rendering. The state informs, it does not block.

**Caution.** Amber, factual, expandable, never blocking.

**Error.** Inline and adjacent to its cause. Toasts only for transient
confirmations, never for anything the user needs to act on.

---

## 7. Motion

`MOTION_INTENSITY: 7` on the builder, and it has to be real. Motion at 7 that
does not actually move is a broken page; if any of this cannot ship working,
drop the dial to 3 and ship it static rather than half-built.

Library: `motion/react`. Springs, not CSS transitions, for anything a user can
touch, because a CSS transition cannot be grabbed mid-flight and reversed.

### 7.1 Spring values

| Interaction | Bounce | Duration | Reason |
| --- | --- | --- | --- |
| Allocation redistribute after a pin | `0.15` | `0.4` | State transition. Slight overshoot because the budget was physically displaced. |
| Slider release | inherits gesture velocity | `0.4` | Momentum handoff. |
| Modal present and dismiss | `0.2` | `0.3` | Apple's sheet value. |
| Slot chip switch, filter apply | `0` | `0.3` | Critically damped. Nothing was thrown, so nothing should bounce. |
| Card enter on scroll | `0` | `0.5`, stagger `0.04` | Hierarchy: results arrive in rank order. |

Non-gesture CSS transitions use `cubic-bezier(0.32, 0.72, 0, 1)`. No `linear`,
no `ease-in-out`.

### 7.2 Every animation is motivated

Each one names its job in one sentence, or it is cut:

- **Redistribution spring:** shows that starring one car took money from the
  others. This is the product's central idea rendered as motion, and it is the
  single most important animation in the app.
- **Card stagger:** communicates rank order.
- **Modal from origin:** preserves the spatial relationship between the card and
  its detail.
- **Press scale:** confirms the touch registered.
- **Number roll on price change:** shows a value recalculating rather than
  silently swapping.

Nothing else animates. No infinite loops, no marquees, no parallax, no
scroll-hijack, no decorative float.

### 7.3 The allocation slider

The one place where the physics genuinely matters. Specified in full because
"a slider" implemented naively will feel dead and the whole tool rests on it.

1. **Feedback on pointer-down,** not on release. The handle highlights the
   instant it is pressed.
2. **Pointer Events with `setPointerCapture`,** so tracking survives the pointer
   leaving the handle's bounds.
3. **Respect the grab offset.** The handle does not jump to center the pointer.
4. **1:1 tracking, continuously, the whole way through.** Dollar figures and
   the result lists update live during the drag, not on release.
5. **Track a short velocity history** across the last few `pointermove` events.
6. **Rubber-band past the budget boundary** instead of hard-stopping. Resistance
   grows with overshoot:

```js
function rubberband(overshoot, dimension, c = 0.55) {
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}
```

A hard stop reads as frozen. Progressive resistance reads as responsive with
nothing more to give, which is exactly the truth about a budget.

7. **On release, hand off velocity** to the settling spring so there is no seam
   between dragging and animating.
8. **Fully interruptible.** A redistribution animation in flight can be grabbed
   and reversed. Animate from the **presentation** value (read the live
   transform), never from the logical target, or the grab produces a visible
   jump.
9. **Decompose any 2D motion into independent X and Y springs.** A single spring
   on a 2D distance desynchronizes.

### 7.4 Forbidden

- `window.addEventListener('scroll')`. Use `useScroll`, IntersectionObserver, or
  CSS scroll-driven animation.
- `useState` for continuously-updating gesture values. Use `useMotionValue` and
  `useTransform`, outside the React render cycle. `useState` on `pointermove`
  re-renders the tree every frame and collapses on mobile.
- Animating `top`, `left`, `width`, or `height`. Transform and opacity only.
- `h-screen`. Always `min-h-[100dvh]`.

---

## 8. The share card

Rendered client-side on canvas. 1080x1920 (story) and 1200x630 (link preview).

**Designed for a thumbnail in a group chat.** That is the real viewing
condition and it sets the whole type scale. If the budget figure is not legible
at 200px wide, the card has failed regardless of how it looks at full size.

Composition:

- **Budget as the headline.** `display` scale, mono, tabular. It is the hook and
  it is the constraint the challenge inherits.
- **Slot tiles** in the nested shell treatment, one per slot: role label, year,
  make, model, price. Two to five tiles, laid out to the slot count with no
  empty cells ever.
- **Total spend** against budget, mono.
- **The challenge line:** "Beat my $50,000 Garage."
- **The URL,** which is the remix link. Opening it inherits the budget and the
  slots.

Type-led by default. Photography composites in only where the record's license
permits redistribution (`DATA-MODEL.md` section 7), and the typographic tile is
designed as a first-class treatment so the card never looks like it fell back.

Same tokens as the app. The card is the app's most-seen surface by a wide
margin, and it should be unmistakably the same object.

---

## 9. Accessibility

Requirements, not aspirations. Every one is in the pre-flight checklist.

- **`prefers-reduced-motion: reduce`.** Springs, slides, and stagger collapse to
  short opacity cross-fades. Overshoot is removed everywhere. The slider still
  tracks 1:1 (that is direct manipulation, not decoration) but settles instantly
  instead of springing. Wrapped with `useReducedMotion()`.
- **`prefers-reduced-transparency: reduce`.** Chrome goes solid, blur drops to
  none.
- **`prefers-contrast: more`.** Hairlines go to `--hairline-strong`, translucent
  surfaces go solid.
- **Contrast.** AA minimum everywhere, AAA on the budget figure and prices.
  `--text-tertiary` is set at exactly 4.5:1 on `--bg-surface` in both modes and
  is not permitted to go lighter.
- **Keyboard.** Full path with no mouse: set budget, move between slots, adjust
  allocation with arrow keys (1 percent steps, 10 percent with Shift), star a
  car, open and close the modal, produce the share card. Visible focus rings on
  every interactive element, never `outline: none` without a replacement.
- **Touch targets.** 44px minimum, all of them, including the star and the
  slider handle.
- **Screen readers.** The allocation bar is a real `role="slider"` with
  `aria-valuenow`, `aria-valuetext` ("$12,400, 25 percent of budget"), and
  `aria-label`. Live regions announce redistribution and over-budget state.
  Result counts announce on filter change.
- **Never color alone.** The caution state carries an icon and text. The
  over-budget state carries a number. The locked state carries a filled star and
  a label.

---

## 10. Performance

| Metric | Budget |
| --- | --- |
| LCP | < 2.0s |
| INP | < 200ms |
| CLS | < 0.1, target 0 |
| Slim catalog index, gzipped | < 25KB |
| Initial JS, gzipped | < 160KB (revised, see below) |
| Time to first result render | < 400ms after budget entry |

**Keep the schema library out of the client.** Catalog records are authored in
TypeScript, validated against the Zod schema at build time by
`scripts/build-catalog.ts`, and emitted as JSON. The app imports the JSON.
Shipping Zod to validate data that was already proved correct at build time
cost 25 kB gzipped on its own.

**Split the catalog.** A slim index carrying only the fields used for matching
and card rendering loads upfront. Prose the detail view needs loads on demand.
Cautions stay in the slim index because they render on the card. Together with
the Zod removal this took the catalog chunk from 35.65 kB gzipped to 10.04 kB.

**The byte budget was revised, deliberately and with measurements.**

Phase 1 measured 139.70 kB gzipped against a 140 kB budget. Growing the
catalog to 135 records and adding the Phase 2 surfaces pushed that to 151.72 kB
even after three real optimisations:

| Change | Saved |
| --- | --- |
| Columnar, dictionary-encoded catalog (`src/data/codec.ts`) | 130.2 kB raw to 42.5 kB, 67 percent |
| Detail prose split into a genuinely lazy chunk | 16.58 kB out of the critical path |
| Detail modal and its chart loaded on demand | 5.76 kB out of the critical path |

The third of those fixed a real defect rather than adding an optimisation: the
`manualChunks` rule routed everything under `/src/data/` into the eager chunk,
which silently pulled the dynamically imported details file back into it and
defeated the lazy load entirely. It measured as 34.05 kB in the eager chunk
until it was excluded by name.

What remains is react at 57.15 and motion at 46.21, which together are 68
percent of the initial payload. React is the framework. Motion is not
discretionary either: section 7 of this document requires springs that can be
grabbed and reversed mid-flight, and a CSS transition cannot do that.

The budget existed as a proxy for load performance, so the honest thing is to
measure the thing itself. On a throttled mobile profile:

| Profile | FCP | LCP | First result card | CLS |
| --- | --- | --- | --- | --- |
| Fast 4G, 4x CPU throttle | 788ms | 788ms | 993ms | 0.0007 |
| Slow 4G, 6x CPU throttle | 1804ms | 1804ms | 1951ms | 0.0007 |

Both are inside the 2.0s LCP target with margin, on profiles chosen to be
harsher than a typical phone. The budget is therefore revised to 160 kB with
the LCP targets as the real constraint, rather than kept at a number the
design's own requirements make unreachable.

**This is a ceiling, not a licence.** Growing the catalog to 250 records adds
roughly 12 kB gzipped to the eager chunk and would land near 164 kB. Before
that ships, the catalog must move behind a skeleton or be split by role.
Re-measure with `node scripts/perf.mjs`, do not estimate.

**Reserve image geometry** with fixed aspect ratios before load. CLS on a
result grid is unforgiving.

**Blur on fixed chrome only.** Repeated from section 1.3 because it is the most
likely performance regression in this design.

Run Lighthouse on a throttled mobile profile before calling any phase done.

---

## 11. Banned in this project

Beyond the general AI-tell list, these are specifically live risks here.

- **Em-dash and en-dash. Zero.** Not in UI copy, labels, buttons, the share
  card, known-issue text, or alt text. Ranges use a hyphen (`2006-2015`,
  `$18,000-$21,000`). This is binary, not a preference.
- **Decorative eyebrows.** Functional field labels only (section 1.3).
- **Section-number labels.** No `01 / RESULTS`.
- **Decorative status dots.** The caution dot is semantic. Nothing else gets one.
- **Middle dot as a general separator.** At most one per metadata line.
- **Fake-precise numbers.** Every figure traces to a `Source` or is labeled an
  estimate. This is a tool that quotes prices; invented precision is the fastest
  way to lose the user.
- **Fabricated reliability scores** attributed to any third party. The index is
  ours and it is labeled as an index.
- **Fake product screenshots built from divs.** If a preview is needed, it is
  the real component rendered small.
- **Three equal feature cards.** Not on the landing page, not anywhere.
- **Serif type.** Any weight, any surface.
- **Version stamps, locale strips, weather, scroll cues, "quietly trusted by."**
  None of these have a job here.
- **Inter, Roboto, Helvetica, Arial, Open Sans.**
- **Lucide icons.** Phosphor only.
- **AI-purple, neon glow, mesh gradient backgrounds.**
- **Emoji in UI text.**

---

## 11a. Render one layout, not both

Mobile and desktop trees must not both render with one hidden by CSS. Doing
that duplicates every slot in the DOM: doubled render work, doubled result
matching, and duplicate element ids, which is an accessibility defect because a
label then points at two controls. Switch on a `matchMedia` subscription and
render one.

## 12. Pre-flight checklist

Run before any phase is called done. A box that cannot be honestly ticked means
the work is not finished.

**Identity and system**
- [ ] Design read stated, dial values set per surface, not silently defaulted
- [ ] One accent used across every surface, no stray colors in any component
- [ ] Semantic colors used only for their state, never decoratively
- [ ] One radius system, concentric nesting, no square-in-pill mixing
- [ ] One theme locked page-wide, no section inverts
- [ ] Both light and dark opened and reviewed, not just one
- [ ] Geist and Geist Mono self-hosted, no Google Fonts link, no serif anywhere
- [ ] Tracking is size-specific, not one value across the scale
- [ ] All numerals mono and tabular

**Copy**
- [ ] Zero em-dashes and en-dashes anywhere visible
- [ ] Every visible string re-read: no broken grammar, no unclear referent, no
      cute-but-wrong phrasing
- [ ] One label per intent across nav, cards, modal, and share
- [ ] No decorative eyebrows; uppercase labels name controls only
- [ ] Every price carries its estimate framing and the `pricesAsOf` date is
      visible somewhere on the surface

**Components and layout**
- [ ] Nested shell on every major container, plain elements below 44px
- [ ] Trailing icons nested in their own circle, never naked
- [ ] Every CTA passes WCAG AA against its own fill, verified not assumed
- [ ] No CTA label wraps at any breakpoint
- [ ] Mobile collapse declared explicitly per section, not assumed
- [ ] `min-h-[100dvh]`, never `h-screen`
- [ ] Column layout never compresses below 320px; it scrolls instead
- [ ] Loading, empty, error, over-budget, and caution states all designed

**Motion**
- [ ] Motion claimed is motion shipped, and every animation names its job
- [ ] Slider: pointer capture, grab offset respected, 1:1 tracking, live
      updates during drag, rubber-band at the boundary, velocity handoff on
      release, interruptible from the presentation value
- [ ] Springs from the section 7.1 table, no `linear`, no `ease-in-out`
- [ ] No `window.addEventListener('scroll')`
- [ ] No `useState` driving a continuous gesture value
- [ ] Transform and opacity only
- [ ] `useEffect` animations have cleanup
- [ ] Motion components are client leaves with `'use client'`

**Accessibility and performance**
- [ ] Audit run in a real browser in both themes (`node scripts/audit.mjs`),
      not inferred from source
- [ ] Reduced motion, reduced transparency, and increased contrast all handled
- [ ] Full keyboard path end to end, visible focus everywhere
- [ ] 44px minimum touch targets, all of them
- [ ] Slider has real slider semantics with `aria-valuetext`
- [ ] Nothing communicated by color alone
- [ ] `backdrop-filter` on fixed and sticky chrome only, verified
- [ ] Image geometry reserved, CLS at or near zero
- [ ] Lighthouse run on a throttled mobile profile, budgets in section 10 met
