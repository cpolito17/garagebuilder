import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, DownloadSimple, Image as ImageIcon } from '@phosphor-icons/react';
import type { Vehicle } from '../data/types';
import type { GarageState } from '../state/garage';
import { renderShareCard, cardFileName, type CardSize } from '../lib/shareCard';
import { shareUrlFor } from '../lib/urlState';
import { formatUsd } from '../lib/pricing';

/**
 * The share surface. docs/SPEC.md section 6.
 *
 * The link is the product's distribution model, not the image. The image is
 * the advertisement; the URL is the install, because opening it inherits the
 * budget and the slot roles and gives the recipient a move to make.
 */
export function SharePanel({
  state, picks, spend,
}: { state: GarageState; picks: (Vehicle | undefined)[]; spend: number }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<CardSize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const url = shareUrlFor(state);

  useEffect(() => {
    let live = true;
    renderShareCard({ state, picks, spend, shareUrl: url }, 'story')
      .then((blob) => {
        if (!live) return;
        const next = URL.createObjectURL(blob);
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = next;
        setPreview(next);
      })
      .catch(() => { /* the panel still works without a preview */ });
    return () => { live = false; };
  }, [state, picks, spend, url]);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not reach the clipboard. Select the link and copy it manually.');
    }
  }, [url]);

  const download = useCallback(async (size: CardSize) => {
    setBusy(size);
    setError(null);
    try {
      const blob = await renderShareCard({ state, picks, spend, shareUrl: url }, size);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = cardFileName(state, size);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [state, picks, spend, url]);

  return (
    <section className="shell" style={{ borderRadius: 24, padding: 8 }}>
      <div className="core flex flex-col gap-5 p-4" style={{ borderRadius: 16 }}>
        <div className="flex flex-col gap-1">
          <h2 className="t-h2 m-0 text-[--text-primary]">
            Beat my {formatUsd(state.budget)} garage
          </h2>
          <p className="m-0 t-small text-[--text-secondary]">
            Anyone who opens this link gets the same budget and the same slots, with nothing
            picked. That is the whole challenge.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Shareable link to this garage"
            className="num h-11 min-w-0 flex-1 rounded-[10px] border border-[--hairline] bg-[--bg-shell] px-3 t-small text-[--text-secondary]"
          />
          <button
            type="button"
            onClick={copy}
            className="group inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full py-1.5 pl-5 pr-1.5 t-small"
            style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
          >
            {copied ? 'Copied' : 'Copy link'}
            <span className="grid h-8 w-8 place-items-center rounded-full bg-black/12 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {preview && (
            <img
              src={preview}
              alt="Preview of the share card for this garage"
              width={1080}
              height={1920}
              className="w-[132px] shrink-0 rounded-[10px] border border-[--hairline]"
              style={{ aspectRatio: '1080 / 1920', objectFit: 'cover' }}
            />
          )}
          <div className="flex flex-1 flex-col gap-2">
            <span className="t-label text-[--text-tertiary]">Save the card</span>
            <div className="flex flex-wrap gap-2">
              <CardButton size="story" busy={busy} onClick={download} label="Story, 1080 by 1920" />
              <CardButton size="link" busy={busy} onClick={download} label="Link preview, 1200 by 630" />
            </div>
            <p className="m-0 t-small text-[--text-tertiary]">
              The card is designed to be read at thumbnail size in a group chat, which is where it
              will actually be seen.
            </p>
          </div>
        </div>

        {error && (
          <p className="m-0 rounded-[10px] px-3 py-2 t-small" style={{ background: 'var(--over-wash)', color: 'var(--over)' }}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function CardButton({
  size, busy, onClick, label,
}: { size: CardSize; busy: CardSize | null; onClick: (s: CardSize) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onClick(size)}
      disabled={busy !== null}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[--hairline] bg-[--bg-shell] px-4 t-small text-[--text-primary] transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-50"
    >
      {busy === size ? <ImageIcon size={15} /> : <DownloadSimple size={15} />}
      {busy === size ? 'Rendering' : label}
    </button>
  );
}
