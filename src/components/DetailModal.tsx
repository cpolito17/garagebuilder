import { useEffect, useRef, useState } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, Warning, Star, ArrowSquareOut } from '@phosphor-icons/react';
import type { Match } from '../lib/matching';
import type { VehicleDetails } from '../data/types';
import { loadDetails } from '../data/catalog';
import { galleryFor, creditLine, requiresAttribution, LICENCE_URL } from '../data/images';
import { formatUsd, formatMiles } from '../lib/pricing';
import { PriceCurveChart } from './PriceCurveChart';
import { VehiclePhoto } from './VehiclePhoto';
import { Chip } from './primitives';
import { listingSearchUrl } from '../lib/listings';

const SEVERITY_LABEL: Record<string, string> = {
  annoyance: 'Annoyance',
  expensive: 'Expensive',
  'car-ending': 'Ends the car',
};

/**
 * Everything known about one vehicle. docs/SPEC.md section 5.
 *
 * Opens from the card that triggered it and dismisses along the same path,
 * because a panel that arrives one way and leaves another breaks the spatial
 * relationship between the card and its detail.
 */
export function DetailModal({
  match, slotBudget, slotMaxMiles, origin, starred, onStar, onClose,
}: {
  match: Match | null;
  slotBudget: number;
  slotMaxMiles: number;
  origin: DOMRect | null;
  starred: boolean;
  onStar: () => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const [details, setDetails] = useState<VehicleDetails | null>(null);

  const open = match !== null;

  useEffect(() => {
    if (!open || !match) return;
    let live = true;
    setDetails(null);
    loadDetails(match.vehicle.id).then((d) => { if (live) setDetails(d ?? null); });
    return () => { live = false; };
  }, [open, match?.vehicle.id]);

  // Focus moves in on open and returns to the triggering card on close.
  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement;
    const t = setTimeout(() => closeRef.current?.focus(), 60);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.body.style.overflow = '';
      restoreTo.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const v = match?.vehicle;
  const gallery = v ? galleryFor(v.id) : [];

  // Grow out of the card's own position on screen.
  const originStyle = origin
    ? { transformOrigin: `${origin.left + origin.width / 2}px ${origin.top + origin.height / 2}px` }
    : undefined;

  return (
    <AnimatePresence>
      {open && v && match && (
        <m.div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.15 : 0.22 }}
        >
          {/* A modal task, so the scrim dims and pushes the builder back. */}
          <button
            aria-label="Close details"
            onClick={onClose}
            className="chrome absolute inset-0 h-full w-full cursor-default"
            style={{ background: 'rgb(0 0 0 / 0.42)' }}
            tabIndex={-1}
          />

          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${v.make} ${v.model} details`}
            className="relative w-full max-w-[720px] overflow-hidden"
            style={{
              background: 'var(--bg-raised)',
              borderRadius: 24,
              boxShadow: 'var(--shadow-modal)',
              border: '1px solid var(--hairline)',
              ...originStyle,
            }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16, filter: 'blur(6px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12, filter: 'blur(4px)' }}
            transition={reduce ? { duration: 0.15 } : { type: 'spring', bounce: 0.2, duration: 0.3 }}
          >
            <div className="max-h-[88dvh] overflow-y-auto overscroll-contain">
              <header className="chrome sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[--hairline] px-4 py-3">
                <div className="min-w-0">
                  <div className="t-label text-[--text-tertiary]">{v.make}</div>
                  <h2 className="t-h2 m-0 truncate text-[--text-primary]">{v.model}</h2>
                  <div className="num t-small text-[--text-secondary]">
                    {v.generation}, {v.years[0]}
                    {v.status === 'current' ? ' to now' : `-${v.years[1]}`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={onStar}
                    aria-pressed={starred}
                    className="flex h-11 items-center gap-2 rounded-full px-4 t-small transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
                    style={{
                      background: starred ? 'var(--accent)' : 'var(--bg-shell)',
                      color: starred ? 'var(--accent-on)' : 'var(--text-primary)',
                      border: '1px solid var(--hairline)',
                    }}
                  >
                    <Star size={16} weight={starred ? 'fill' : 'regular'} />
                    {starred ? 'Locked in' : 'Lock in'}
                  </button>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close details"
                    className="grid h-11 w-11 place-items-center rounded-full border border-[--hairline] bg-[--bg-shell] transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.92]"
                  >
                    <X size={17} />
                  </button>
                </div>
              </header>

              <div className="flex flex-col gap-6 p-4">
                {gallery.length > 0 && (
                  <div className={gallery.length > 1
                    ? 'flex snap-x snap-mandatory gap-3 overflow-x-auto no-scrollbar'
                    : 'flex'}>
                    {gallery.map((img) => (
                      <div
                        key={img.file}
                        className={`${gallery.length > 1 ? 'w-[86%] shrink-0 snap-center' : 'w-full'} overflow-hidden`}
                        style={{ borderRadius: 14 }}
                      >
                        <VehiclePhoto image={img} sizes="620px" rounded={false} aspect="16 / 9" />
                        {requiresAttribution(img.licence) && (
                          <p className="m-0 px-1 pt-1.5 t-small text-[--text-tertiary]">
                            {creditLine(img)}
                            {LICENCE_URL[img.licence] && (
                              <>
                                {' '}
                                <a href={img.sourceUrl} target="_blank" rel="noreferrer noopener" className="underline">
                                  source
                                </a>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* What this budget buys, and why */}
                <section className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="num t-h1 text-[--text-primary]">
                      {formatUsd(match.spend)}
                    </span>
                    <span className="num t-body text-[--text-secondary]">
                      {match.atMiles < 1000 ? 'New, 0 miles' : `at about ${formatMiles(match.atMiles)}`}
                    </span>
                  </div>
                  <PriceCurveChart
                    curve={v.pricing}
                    firstYear={v.years[0]}
                    budget={slotBudget}
                    selectedPrice={match.spend}
                    atMiles={match.atMiles}
                    ceilingMiles={slotMaxMiles}
                  />
                </section>

                {details?.summary && (
                  <p className="m-0 t-body text-[--text-secondary]">{details.summary}</p>
                )}

                <Section title="Specification">
                  <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    <Spec k="Power" v={`${v.spec.horsepower} hp`} />
                    <Spec k="Torque" v={`${v.spec.torqueLbFt} lb-ft`} />
                    <Spec k="Weight" v={`${v.spec.curbWeightLb.toLocaleString()} lb`} />
                    <Spec k="Drivetrain" v={v.spec.drivetrain} />
                    <Spec k="Gearbox" v={v.spec.transmissions.join(', ')} />
                    <Spec k="Engine" v={v.spec.cylinders === 0 ? 'Electric' : `${v.spec.displacementL}L ${v.spec.cylinders}cyl`} />
                    <Spec k="Seats" v={String(v.spec.seats)} />
                    <Spec k="Economy" v={`${v.spec.mpgCombined} ${v.spec.fuel === 'ev' ? 'MPGe' : 'mpg'}`} />
                    {v.spec.towingLb ? <Spec k="Towing" v={`${v.spec.towingLb.toLocaleString()} lb`} /> : null}
                    {v.spec.cargoCuFt ? <Spec k="Cargo" v={`${v.spec.cargoCuFt} cu ft`} /> : null}
                    {v.spec.groundClearanceIn ? <Spec k="Clearance" v={`${v.spec.groundClearanceIn} in`} /> : null}
                  </dl>
                </Section>

                {details?.packages && details.packages.length > 0 && (
                  <Section title="Options worth paying for">
                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                      {details.packages.map((p) => (
                        <li key={p.name} className="flex flex-col gap-0.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="t-h3 text-[--text-primary]">
                              {p.name}
                              {p.years && (
                                <span className="num t-small text-[--text-tertiary]">
                                  {' '}{p.years[0]}-{p.years[1]}
                                </span>
                              )}
                            </span>
                            <span className="num t-small shrink-0 text-[--text-secondary]">
                              about {formatUsd(p.premiumUsd)} more
                            </span>
                          </div>
                          <span className="t-small text-[--text-secondary]">{p.adds}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {v.knownIssues.length > 0 && (
                  <Section title="Known issues">
                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                      {v.knownIssues.map((i) => {
                        const reached = i.onsetMiles <= match.atMiles;
                        return (
                          <li key={i.text} className="flex gap-2.5">
                            <Warning
                              size={16}
                              className="mt-0.5 shrink-0"
                              style={{ color: reached ? 'var(--caution)' : 'var(--text-tertiary)' }}
                              aria-hidden
                            />
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="t-body text-[--text-primary]">{i.text}</span>
                              <span className="num t-small text-[--text-secondary]">
                                {i.onsetMiles > 0 ? `From ${formatMiles(i.onsetMiles)}` : 'At any mileage'}
                                {i.typicalCostUsd > 0 ? `, about ${formatUsd(i.typicalCostUsd)}` : ''}
                                {' · '}{SEVERITY_LABEL[i.severity]}
                                {reached ? ' · reached at this odometer' : ''}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </Section>
                )}

                {details?.milestoneServices && details.milestoneServices.length > 0 && (
                  <Section title="Service milestones">
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {[...details.milestoneServices].sort((a, b) => a.atMiles - b.atMiles).map((s) => (
                        <li key={`${s.atMiles}-${s.item}`} className="flex items-baseline justify-between gap-3">
                          <span className="t-body text-[--text-primary]">{s.item}</span>
                          <span className="num t-small shrink-0 text-[--text-secondary]">
                            {formatMiles(s.atMiles)}
                            {s.costUsd > 0 ? `, ${formatUsd(s.costUsd)}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {details?.whatToLookFor && details.whatToLookFor.length > 0 && (
                  <Section title="What to look for">
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                      {details.whatToLookFor.map((w) => (
                        <li key={w} className="t-body text-[--text-secondary]">{w}</li>
                      ))}
                    </ul>
                  </Section>
                )}

                <Section title="Running costs">
                  <div className="flex flex-wrap gap-2">
                    <Chip>Maintenance about {formatUsd(v.ownership.annualMaintenanceUsd)} a year</Chip>
                    <Chip title="Our index, not a third party score">Reliability {v.ownership.reliabilityIndex} of 5</Chip>
                    <Chip title="Relative, because real premiums swing on driver and postcode">
                      Insurance {v.ownership.insuranceIndex} of 5
                    </Chip>
                    <Chip>Parts {v.ownership.partsAvailability} of 5</Chip>
                    <Chip>DIY {v.ownership.diyFriendliness} of 5</Chip>
                  </div>
                  <p className="m-0 mt-2 t-small text-[--text-tertiary]">
                    Indices are ours and are relative, not scores from any third party. Insurance is
                    an index rather than a figure because real premiums vary several fold by driver,
                    record and postcode.
                  </p>
                </Section>

                {details?.sources && (
                  <Section title="Data provenance">
                    <p className="m-0 t-small text-[--text-secondary]">
                      Updated {details.updatedAt}. These are generation-wide planning estimates,
                      not a valuation of a particular car. Verify the exact model year, trim,
                      condition, and local market before buying.
                    </p>
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {details.sources.map((source) => (
                        <li key={`${source.label}-${source.fields.join(',')}`} className="t-small text-[--text-tertiary]">
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex min-h-11 items-center underline"
                            >
                              {source.label}
                            </a>
                          ) : source.label}
                          {' · '}{source.fields.join(', ')}
                          {source.note ? ` · ${source.note}` : ''}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                <a
                  href={listingSearchUrl(v, match.spend)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group inline-flex h-11 w-full items-center justify-between gap-2 rounded-full py-1.5 pl-5 pr-1.5 t-small"
                  style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
                >
                  See real listings
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-black/12 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
                    <ArrowSquareOut size={15} />
                  </span>
                </a>

                <p className="m-0 t-small text-[--text-tertiary]">
                  Prices are estimates from an offline catalog, not listings or quotes.
                </p>
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-[--hairline] pt-4">
      <h3 className="t-label m-0 text-[--text-tertiary]">{title}</h3>
      {children}
    </section>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col">
      <dt className="t-small text-[--text-tertiary]">{k}</dt>
      <dd className="num m-0 t-body text-[--text-primary]">{v}</dd>
    </div>
  );
}
