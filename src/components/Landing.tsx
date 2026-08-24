import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { m, useReducedMotion } from 'motion/react';
import { CATALOG, PRICES_AS_OF, byId } from '../data/catalog';
import { ROLE_LABEL } from '../data/types';
import { findMatches } from '../lib/matching';
import { estimatedPrice, formatMiles, formatUsd, milesAffordable, plausibleMinMiles } from '../lib/pricing';
import { allocate, initialGarage, pinSlot, setSlotBudget, MIN_SLOT, type GarageState } from '../state/garage';
import { AllocationSlider } from './AllocationSlider';
import { Shell } from './primitives';

/**
 * The landing page. docs/SPEC.md section 7, governed by design-taste-frontend
 * in full (docs/DESIGN.md section 1.2). Dials: variance 7, motion 5, density 3.
 *
 * The rule that shapes everything here: show the tool, do not describe it. The
 * hero is not a screenshot of the allocation mechanic, it is the allocation
 * mechanic, running against the real catalog. The price examples are computed
 * by the same functions the builder uses. The share card is rendered by the
 * same canvas renderer the share panel uses. Nothing on this page is a mockup,
 * because a mockup of a tool this small is more work than the tool.
 */
export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-[--bg-base]">
      <Nav onStart={onStart} />
      <main>
        <Hero onStart={onStart} />
        <Curve />
        <Loop />
        <Breadth />
        <Limits />
        <Close onStart={onStart} />
      </main>
      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------- chrome

function Nav({ onStart }: { onStart: () => void }) {
  return (
    <header className="chrome sticky top-0 z-20 border-b border-[--hairline]">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4">
        <span className="t-h3 text-[--text-primary]">Garage Challenge</span>
        <Cta onClick={onStart} />
      </div>
    </header>
  );
}

/**
 * One label for one intent, used in the nav, the hero and the closing band.
 * Pill, per the shape system in docs/DESIGN.md section 5.
 */
function Cta({ onClick, size = 'sm' }: { onClick: () => void; size?: 'sm' | 'lg' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pl-5 pr-1.5 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
        size === 'lg' ? 'h-14 t-h3' : 'h-11 t-small'
      }`}
      style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
    >
      Build your garage
      <span
        className={`grid place-items-center rounded-full bg-black/12 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 ${
          size === 'lg' ? 'h-11 w-11' : 'h-8 w-8'
        }`}
      >
        <ArrowRight size={size === 'lg' ? 18 : 15} />
      </span>
    </button>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[--hairline]">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-8">
        <span className="t-small text-[--text-tertiary]">
          Price estimates as of {PRICES_AS_OF}. US market.
        </span>
        <a
          href="#credits"
          className="inline-flex min-h-11 items-center t-small text-[--text-secondary] underline decoration-[--hairline-strong] underline-offset-4"
        >
          Photo credits and licences
        </a>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------- hero

const SECTION = 'mx-auto max-w-[1400px] px-4 py-16 md:py-24';

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto grid max-w-[1400px] gap-10 px-4 pb-16 pt-12 md:grid-cols-12 md:gap-12 md:pb-24 md:pt-20 lg:gap-16">
      <div className="flex flex-col items-start gap-6 md:col-span-5 md:justify-center md:self-center">
        <h1 className="t-display text-[--text-primary]">One budget. A whole garage.</h1>
        <p className="t-body max-w-[46ch] text-[--text-secondary]">
          Set a total, say what each car is for, and see what the money actually buys at
          every odometer reading.
        </p>
        <Cta onClick={onStart} size="lg" />
      </div>

      <div className="md:col-span-7">
        <LiveAllocation />
      </div>
    </section>
  );
}

/**
 * The hero asset: three real slots, the real drag, the real catalog. Dragging
 * one slider moves money out of the others and re-picks their cars, which is
 * the whole product in one gesture.
 */
function LiveAllocation() {
  const [state, setState] = useState<GarageState>(() => initialGarage(50_000, 3));
  const alloc = useMemo(() => allocate(state), [state]);

  const rows = state.slots.map((slot) => {
    const budget = alloc.perSlot.get(slot.id) ?? 0;
    const top = findMatches(CATALOG, {
      budget, role: slot.role, maxMiles: slot.maxMiles, filters: slot.filters,
    }).matches[0];
    return { slot, budget, top };
  });

  return (
    <Shell outer={24} pad={8} className="w-full" data-product="live-allocation">
      <div className="flex flex-col gap-5 p-4 md:gap-6 md:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="t-label text-[--text-tertiary]">Total budget</span>
          <span className="num t-h1 text-[--text-primary]">{formatUsd(state.budget)}</span>
        </div>

        <ul className="flex flex-col gap-5">
          {rows.map(({ slot, budget, top }) => (
            <li key={slot.id} className="flex flex-col gap-2">
              <AllocationSlider
                value={budget}
                headroom={alloc.headroom(slot.id)}
                scale={state.budget}
                min={MIN_SLOT}
                pinned={false}
                over={alloc.over > 0}
                label={slot.role ? ROLE_LABEL[slot.role] : 'Any car'}
                onChange={(v) => setState((s) => setSlotBudget(s, slot.id, v))}
                onCommit={(v) => setState((s) => setSlotBudget(s, slot.id, v))}
              />
              <p className="t-small text-[--text-secondary]">
                {top ? (
                  <>
                    {top.vehicle.years[0]} to {top.vehicle.years[1]} {top.vehicle.make}{' '}
                    {top.vehicle.model}, around{' '}
                    <span className="num">{formatMiles(top.atMiles)}</span>
                  </>
                ) : (
                  'Nothing in the catalog reaches this slot yet.'
                )}
              </p>
            </li>
          ))}
        </ul>

        <p className="t-small text-[--text-tertiary]">
          Drag a slider. The others give up the money and pick different cars.
        </p>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- the curve

const CURVE_ID = 'bmw-m3-e90';
const CURVE_BUDGETS = [25_000, 35_000, 45_000];
/** Widths fall as the odometer falls, so the grid carries the same story. */
const SPANS = ['md:col-span-5', 'md:col-span-4', 'md:col-span-3'];

/**
 * The mechanic that makes the tool worth using, shown on one real car at three
 * real budgets. Computed here by the same inversion the builder runs, so these
 * figures cannot drift away from what the tool would actually offer.
 */
function Curve() {
  const vehicle = byId.get(CURVE_ID) ?? CATALOG[0]!;
  const steps = CURVE_BUDGETS.map((budget, i) => {
    const raw = milesAffordable(vehicle.pricing, budget) ?? 0;
    const miles = Math.max(plausibleMinMiles(vehicle.years[1]), raw);
    return { budget, miles, price: estimatedPrice(vehicle.pricing, miles), span: SPANS[i]! };
  });

  return (
    <section className={SECTION}>
      <div className="flex flex-col gap-4">
        <h2 className="t-h1 max-w-[20ch] text-[--text-primary]">
          Every price is a price at a mileage.
        </h2>
        <p className="t-body max-w-[62ch] text-[--text-secondary]">
          A {vehicle.years[0]} to {vehicle.years[1]} {vehicle.make} {vehicle.model} is not one
          price. Raise the odometer you will live with and the same car costs less, which is
          how a $25,000 slot reaches a car that lists at{' '}
          {formatUsd(vehicle.pricing.base)} in good condition.
        </p>
      </div>

      <ol className="mt-10 grid gap-4 md:grid-cols-12">
        {steps.map((step) => (
          <li key={step.budget} className={step.span}>
            <Shell outer={20} pad={6} className="h-full">
              <div className="flex h-full flex-col gap-1 p-5">
                <span className="num t-h1 text-[--text-primary]">{formatUsd(step.budget)}</span>
                <span className="num t-h3 text-[--accent]">{formatMiles(step.miles)}</span>
                <span className="t-small mt-auto pt-4 text-[--text-tertiary]">
                  Estimated price <span className="num">{formatUsd(step.price)}</span> at that odometer
                </span>
              </div>
            </Shell>
          </li>
        ))}
      </ol>

      <p className="t-small mt-6 max-w-[62ch] text-[--text-tertiary]">
        These are estimates from an authored curve per generation, not live listings and not
        an appraisal. They are calibrated against asking prices as of {PRICES_AS_OF} and they
        will drift.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- the loop

/**
 * The share card is rendered on demand by the same canvas code the share panel
 * uses, so what this section shows is the artefact itself rather than a picture
 * of one. Loaded when the section comes into view: nothing above the fold needs
 * the renderer.
 */
function ShareCardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let url: string | null = null;
    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void (async () => {
          const { renderShareCard } = await import('../lib/shareCard');
          // The picks come from the matcher rather than a hardcoded list, so
          // the card on this page can never advertise a car the catalog has
          // since renamed or dropped.
          let state = initialGarage(50_000, 3);
          const picks: (typeof CATALOG)[number][] = [];
          for (const slot of state.slots) {
            const at = allocate(state).perSlot.get(slot.id) ?? 0;
            const best = findMatches(CATALOG, {
              budget: at, role: slot.role, maxMiles: slot.maxMiles, filters: slot.filters,
            }).matches[0];
            if (!best) continue;
            picks.push(best.vehicle);
            state = pinSlot(state, slot.id, best.vehicle.id, best.spend);
          }
          const spend = state.slots.reduce((a, s) => a + s.target, 0);
          try {
            const blob = await renderShareCard(
              { state, picks, spend, shareUrl: 'https://garagechallenge.app/' },
              'link',
            );
            if (cancelled) return;
            url = URL.createObjectURL(blob);
            setSrc(url);
          } catch {
            // A browser without the canvas APIs still gets the whole section,
            // minus one illustration. Not worth a fallback image.
          }
        })();
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden rounded-[20px] border border-[--hairline] bg-[--bg-shell]"
      style={{ aspectRatio: '1200 / 630' }}
    >
      {src && (
        <img
          src={src}
          width={1200}
          height={630}
          alt="The link preview card: a $50,000 garage with three locked cars, their prices and mileages."
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

function Loop() {
  return (
    <section className="border-y border-[--hairline] bg-[--bg-shell]">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:py-24">
        <div className="flex flex-col gap-4">
          <h2 className="t-h1 max-w-[18ch] text-[--text-primary]">
            Then hand it to someone who thinks they can do better.
          </h2>
          <p className="t-body max-w-[52ch] text-[--text-secondary]">
            Lock a car in every slot and the garage becomes a link. Whoever opens it
            inherits your budget and your slots, and starts with nothing picked.
          </p>
          <p className="t-small text-[--text-tertiary]">
            No account. The link is the save file.
          </p>
        </div>
        <ShareCardPreview />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- breadth

/**
 * A number tells you the catalog is big. The names tell you whether the car you
 * are thinking of is in it, which is the only question a reader actually has.
 * The page's one marquee.
 */
function Breadth() {
  const names = useMemo(
    () =>
      CATALOG.filter((_, i) => i % 6 === 0).map((v) => `${v.make} ${v.model}`),
    [],
  );

  return (
    <section className={SECTION}>
      <div className="flex flex-col gap-4">
        <h2 className="t-h1 text-[--text-primary]">
          <span className="num">{CATALOG.length}</span> generations, 1990 to now.
        </h2>
        <p className="t-body max-w-[62ch] text-[--text-secondary]">
          Curated rather than scraped: one record per generation, with the years, the
          engine, the transmissions it came with, and the faults that generation is known
          for.
        </p>
      </div>

      <div className="mt-10 flex overflow-hidden" aria-hidden>
        {[0, 1].map((copy) => (
          <div key={copy} className="marquee-run flex shrink-0 gap-10 pr-10">
            {names.map((n) => (
              <span key={n} className="t-h3 whitespace-nowrap text-[--text-tertiary]">
                {n}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- limits

const LIMITS: { title: string; body: string }[] = [
  {
    title: 'Estimates, not appraisals',
    body: 'Prices come from an authored curve per generation, calibrated against real asking prices. Nothing here is a quote and nothing is live.',
  },
  {
    title: 'No listings, no inventory',
    body: 'The tool tells you what a budget buys. Finding the actual car is a link out to the sites that do that well.',
  },
  {
    title: 'US market, 1990 and newer',
    body: 'Prices, trims and emissions rules stop making sense across borders, and a single market with real data beats four with guesses.',
  },
  {
    title: 'Purchase price only',
    body: 'Insurance, fuel and maintenance are shown on each car but never folded into the budget, because that turns a fun question into a spreadsheet.',
  },
];

function Limits() {
  const reduce = useReducedMotion();
  return (
    <section className={SECTION}>
      <h2 className="t-h1 max-w-[22ch] text-[--text-primary]">What this does not do.</h2>
      <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {LIMITS.map((item, i) => (
          <m.div
            key={item.title}
            className="flex flex-col gap-2"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, delay: i * 0.06, ease: [0.32, 0.72, 0, 1] }}
          >
            <h3 className="t-h3 text-[--text-primary]">{item.title}</h3>
            <p className="t-body max-w-[46ch] text-[--text-secondary]">{item.body}</p>
          </m.div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- close

function Close({ onStart }: { onStart: () => void }) {
  return (
    <section className="border-t border-[--hairline] bg-[--bg-shell]">
      <div className="mx-auto flex max-w-[1400px] flex-col items-start gap-8 px-4 py-16 md:items-center md:py-24">
        <h2 className="t-h1 max-w-[24ch] text-[--text-primary] md:text-center">
          Pick a number and find out what three cars it really buys.
        </h2>
        <Cta onClick={onStart} size="lg" />
      </div>
    </section>
  );
}
