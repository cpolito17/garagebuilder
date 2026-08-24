# Garage Challenge

A tool for deciding how to spend one car budget across several cars that each do
a different job.

Set a total budget. Choose how many slots you want and what each is for. The
tool shows what that money buys in each slot, including the odometer reading the
budget implies. Lock one car per slot, then send it to someone as a challenge:
same budget, same slots, beat it.

**Status:** Phases 1 to 4 built. The math, the catalog of 250 vehicle
generations, the allocation mechanic, the detail view, the garage summary, the
landing page and the whole share and challenge loop work end to end.

Photographs are the one thing missing, and only because the build environment's
network policy blocks every image host. The system around them is complete: run
`npm run images` where there is network access and they appear. Until then every
vehicle renders its typographic identity band, which is a designed state.

```bash
npm install
npm run dev          # development server
npm test             # 152 tests
npm run build        # validates the catalog, typechecks, builds
npm run preview      # then, against the running preview:
                     #   node scripts/audit.mjs   accessibility audit, both themes
                     #   node scripts/smoke.mjs   end to end interaction check
                     #   node scripts/perf.mjs    LCP and CLS on throttled mobile

npm run images       # fetch vehicle photography from Wikimedia Commons
npm run coverage     # role and price-tier coverage report for the catalog
npm run placeholders # flat test patterns, to check photo layout without network

npm run og:default   # regenerate the default link preview from the real app
npm run worker:deploy # build, then deploy the static site behind the OG Worker
```

`npm run catalog` regenerates `src/data/generated/*.json` from the authored
records in `src/data/vehicles/`. It runs automatically before test and build,
and a record that fails schema validation fails the build.

---

## Documents

| File | Contents |
| --- | --- |
| [`docs/SPEC.md`](docs/SPEC.md) | Product spec. Scope, screens, interactions, the share loop, build phases. |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design system. Tokens, type, components, motion physics, accessibility, pre-flight checklist. |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Catalog schema, the price model and its inversion, sourcing, licensing, authoring plan. |
| [`docs/CATALOG_EXPANSION_TUTORIAL.md`](docs/CATALOG_EXPANSION_TUTORIAL.md) | Agent procedure for researching and adding balanced vehicle batches, with extra high-price coverage. |

Read `SPEC.md` first. `DATA-MODEL.md` section 3 is the part everything else
depends on.

---

## The idea in one equation

Every vehicle in the catalog has a price curve against odometer:

```
price(m) = floor + (base - floor) * (1 - decay) ^ ((m - baselineMiles) / 10000)
```

Run it backwards and you get the mechanic the whole product is built on:

```
milesAffordable(B) = baselineMiles + 10000 * ln((B - floor) / (base - floor))
                                            / ln(1 - decay)
```

So a slot does not ask "which cars cost under $18,000." It asks **"at $18,000,
what odometer does each car require."** Run against calibrated curves, that one
budget returns an 18,000 mile MX-5, a 108,000 mile Civic Si, and a 115,000 mile
E63 AMG, each labeled with the mileage the budget actually buys.

`decay` is authored per generation, which is why a high-mileage Land Cruiser and
a high-mileage 7 Series behave like different products instead of the same
discount. That per-car tuning is the catalog's whole value.

---

## Stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Build | Vite + React + TypeScript | No server and no SSR needed. Next.js would add a framework for a static output. |
| Styling | Tailwind v4 | `@tailwindcss/postcss` or the Vite plugin, never the v3 `tailwindcss` PostCSS plugin. |
| Motion | `motion/react` | Springs are interruptible and velocity-aware, which the allocation slider requires. |
| Icons | `@phosphor-icons/react` | One family, `weight="regular"`. |
| Fonts | Geist + Geist Mono, self-hosted | Tabular figures. The interface is mostly numbers. |
| Validation | Zod | Catalog records validate at build time. A bad record fails the build. |
| State | URL, base64url-encoded compact JSON | No backend, no accounts. The link is the save file and the distribution model. |
| Hosting | Cloudflare Workers static assets | Static, plus one Worker for link previews. |

Everything the user builds lives in `?g=`. There is nothing to log into and
nothing to lose.

### Routes

| URL | Shows |
| --- | --- |
| `/` | The landing page, on a cold visit only. |
| `/#build` | The builder. |
| `/?g=...` | A shared garage: the builder, or the challenge view when the link carries picks. Never the landing page. |
| `/#credits` | Photo credits and licences. |

### Link previews

A static site cannot serve per-garage Open Graph tags, so every pasted link
would show the same generic card. `worker/index.ts` fixes that: it sits in
front of the same `dist/` assets, decodes the state parameter, and rewrites the
meta tags so the link reads *"Beat my $50,000 garage - Mazda MX-5 Miata, Honda
S2000, Toyota 4Runner..."*. Anything that is not HTML passes straight through,
and an unreadable link still serves a working page with the generic preview.

The preview *image* stays generic on purpose. Rendering one per garage at the
edge needs a WebAssembly rasteriser and an embedded font, measured at 1,359 kB
gzipped against Cloudflare's 1,024 kB free-tier limit, to reproduce an image
the client already renders. `public/og-default.png` is the app's own share card,
captured from the running app by `npm run og:default`.

```bash
npm run worker:deploy   # npm run build && wrangler deploy
```

The app is unaffected if the Worker is not deployed: `dist/` is a complete
static site on its own. See `SPEC.md` section 6.4.

---

## Prior art

Checked before speccing. The gap is specific.

- **[Dream Car Garage](https://www.dreamcargarage.app/)** and
  **[GarageWish](https://www.garagewish.com/)** are fantasy garage builders over
  supercar catalogs. No budget tension, no roles, no reason a given slot exists.
- **[DreamBuild](https://dreambuild.app/homepage)** manages cars you already
  own. Different job.
- **[CarGurus](https://www.cargurus.com/research/articles/how-to-find-the-right-car-for-you)**
  and **[Edmunds](https://www.sherpaautotransport.com/guides/edmunds-review/)**
  are single-car buyer tools driven by live listings. Neither has any concept of
  a set of vehicles that collectively cover a life.
- The **format** is already proven entertainment:
  [Grassroots Motorsports' $2000 Challenge](https://www.ebay.com/motors/blog/grassroots-motorsports-2014-challenge-revs-up-again),
  Mighty Car Mods' budget battles,
  [Top Gear USA's $500 Challenge](https://pro.imdb.com/title/tt2024299).
  Constrained-budget car picking has a large audience and no tool. It lives in
  YouTube comments and forum threads.

Fantasy garages are covered at the top, ownership apps at the bottom. The middle
is empty: a budget you could plausibly have, split across cars that do different
jobs.

---

## Open decisions

1. **Images.** 250 hero images cannot be produced in the current environment.
   Recommendation is typographic tiles through Phase 3, photography sourced in
   Phase 4. `DATA-MODEL.md` section 7.
2. **Reliability index.** Consumer Reports and J.D. Power data are licensed and
   cannot be republished. The index must come from free inputs (NHTSA complaint
   and recall data, authored known-issue costs) and be labeled as an index.
3. **Desktop layout above 3 slots.** Horizontal scroll is specified, but a
   scroll that hides a slot also hides the comparison the tool exists to make.
   Worth testing against a real 5-slot garage before committing.

---

## Scope boundaries

US market. Model years 1990 to current. New and used. Budget means purchase
price only. Estimates from an offline catalog, stamped with a date, never
presented as listings, quotes, or advice.
