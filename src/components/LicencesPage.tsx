import { ArrowLeft } from '@phosphor-icons/react';
import { byId } from '../data/catalog';
import {
  allCredits, creditLine, requiresAttribution, LICENCE_LABEL, LICENCE_URL,
  PHOTO_COUNT, PHOTO_VEHICLE_COUNT,
} from '../data/images';

/**
 * Image credits. docs/DATA-MODEL.md section 7.
 *
 * CC BY and CC BY-SA require attribution, so this page exists whether or not
 * anyone visits it. Credits also appear beside the photograph in the detail
 * view, which is where they are actually read.
 */
export function LicencesPage({ onBack }: { onBack: () => void }) {
  const credits = allCredits();
  const attributed = credits.filter((c) => requiresAttribution(c.image.licence));

  return (
    <main className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 py-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-[--hairline] bg-[--bg-shell] px-4 t-small text-[--text-primary]"
      >
        <ArrowLeft size={15} />
        Back to the builder
      </button>

      <header className="flex flex-col gap-2">
        <h1 className="t-h1 m-0 text-[--text-primary]">Image credits</h1>
        <p className="m-0 t-body text-[--text-secondary]">
          Vehicle photographs come from Wikimedia Commons and are used under the licence each
          photographer chose. Only CC0, public domain, CC BY and CC BY-SA files are accepted;
          anything whose licence is not recognised as free is rejected rather than assumed.
        </p>
      </header>

      {credits.length === 0 ? (
        <section
          className="flex flex-col gap-2 rounded-[14px] p-4"
          style={{ background: 'var(--bg-shell)', border: '1px solid var(--hairline)' }}
        >
          <h2 className="t-h3 m-0 text-[--text-primary]">No photographs are installed yet</h2>
          <p className="m-0 t-small text-[--text-secondary]">
            Every vehicle currently renders its typographic identity band, which is a designed
            state rather than a gap. Photographs are fetched separately with{' '}
            <span className="num">npm run images</span>, which queries Wikimedia Commons, filters
            by licence and generation, and writes the manifest this page reads.
          </p>
        </section>
      ) : (
        <>
          <p className="m-0 t-small text-[--text-tertiary]">
            <span className="num">{PHOTO_COUNT}</span> photographs across{' '}
            <span className="num">{PHOTO_VEHICLE_COUNT}</span> vehicles.{' '}
            <span className="num">{attributed.length}</span> require attribution.
          </p>

          <ul className="m-0 flex list-none flex-col p-0">
            {credits.map(({ vehicleId, image }) => {
              const v = byId.get(vehicleId);
              const licenceUrl = LICENCE_URL[image.licence];
              return (
                <li
                  key={`${vehicleId}-${image.file}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[--hairline] py-3"
                >
                  <span className="t-body text-[--text-primary]">
                    {v ? `${v.make} ${v.model}` : vehicleId}
                    {v && <span className="num t-small text-[--text-tertiary]"> {v.generation}</span>}
                  </span>
                  <span className="t-small text-[--text-secondary]">
                    {creditLine(image)}
                    {' · '}
                    <a href={image.sourceUrl} target="_blank" rel="noreferrer noopener" className="underline">
                      file
                    </a>
                    {licenceUrl && (
                      <>
                        {' · '}
                        <a href={licenceUrl} target="_blank" rel="noreferrer noopener" className="underline">
                          {LICENCE_LABEL[image.licence]}
                        </a>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
