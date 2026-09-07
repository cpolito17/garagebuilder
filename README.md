# Garage Challenge

Garage Challenge is a free interactive car-budget game. Split one budget across several vehicles, choose what job each garage slot must do, compare condition-adjusted prices, and challenge friends to build a better lineup.

**Play it:** https://garagechallenge.lol/

**Portfolio:** [charliepolito.com](https://charliepolito.com/)

**Source:** [github.com/cpolito17/garagebuilder](https://github.com/cpolito17/garagebuilder)

## Features

- Divide one budget across one to five vehicle slots
- Assign roles such as sports car, daily driver, utility vehicle, or wildcard
- Price vehicles from factory new through beater condition
- Search and filter a curated catalog of hundreds of vehicle generations
- Compare horsepower and garage-wide statistics, then rebalance spending
- Share the complete garage in a URL with a custom social preview
- Start a fair head-to-head challenge with identical constraints
- Use the full experience on mobile, in light or dark mode, without an account

## Pricing model

Each vehicle has a depreciation curve based on baseline value, price floor, mileage, and decay rate. A slot's condition maps to an odometer band and recalculates every candidate's price. This is a creative comparison tool—not a marketplace, appraisal, or source of financial advice.

## Architecture

The client is a React 19 and TypeScript SPA built with Vite. Vehicle records are authored in `src/data/vehicles/`; a Zod-backed catalog script validates them and generates build-time data. Garage state is compactly encoded in the URL, so sharing needs no account or database.

A Cloudflare Worker serves the build, redirects `www` to the canonical apex domain, applies security headers, and injects garage-specific Open Graph and X metadata.

## Local setup

Requires Node.js 24+ and npm.

```bash
npm ci
npm run dev
```

Optional Openverse tooling reads `OPENVERSE_CLIENT_ID` and `OPENVERSE_CLIENT_SECRET`. Store local values in an ignored `.env.local` file and never commit credentials.

## Scripts

- `npm run dev` — generate the catalog and start Vite
- `npm test` — generate the catalog and run Vitest
- `npm run typecheck` — validate catalog and TypeScript
- `npm run build` — create the production bundle
- `npm run audit` — run browser accessibility, smoke, and performance checks
- `npm run coverage` — report catalog role and price-tier coverage
- `npm run images` / `images:review` — fetch and review licensed photography
- `npm run og:default` — regenerate the default social preview
- `npm run worker:deploy` — build and deploy with Wrangler

## Deployment

`wrangler.jsonc` defines the Worker, static asset binding, SPA fallback, and custom domains. Authenticate Wrangler with the intended Cloudflare account and run `npm run worker:deploy`. The canonical production origin is `https://garagechallenge.lol/`; `www` redirects permanently and the `workers.dev` origin is disabled to prevent duplicate indexing.

## Security and privacy

- No account, cookies, analytics database, or server-side garage storage is required.
- Garage choices live in the URL; anyone receiving a shared URL can read that configuration.
- User-controlled URL state is bounded, validated, and HTML-escaped before preview metadata is rendered.
- The Worker applies CSP, anti-framing, MIME-sniffing, HSTS, permissions, and referrer protections.
- CI installs from the lockfile, audits high-severity dependencies, tests, builds, and runs browser checks.

Report security issues privately to the repository owner rather than publishing exploit details.

## Data and image credits

Vehicle values are curated estimates and may not reflect current listings. Photography and attribution are managed through the reproducible image workflow; the app's [image credits and licences](https://garagechallenge.lol/#credits) view lists image sources and licenses.

## Status

Actively maintained. The garage builder, catalog, responsive UI, URL sharing, social previews, and challenge flow are implemented.

## License

Source code is available under the [MIT License](LICENSE). Third-party images retain their original licenses and attribution requirements.
