import type { Vehicle } from '../data/types';
import { ROLE_LABEL } from '../data/types';
import type { GarageState } from '../state/garage';
import { summarise } from './garageSummary';
import { formatUsd } from './pricing';

/**
 * The share card. docs/DESIGN.md section 8.
 *
 * Rendered on canvas so it can be saved and posted. Designed for a thumbnail
 * in a group chat, which is the real viewing condition and sets the whole type
 * scale: if the budget is not legible at 200px wide, the card has failed
 * however it looks at full size.
 *
 * One deliberate look, dark, regardless of the viewer's theme. A share image
 * is not theme-aware; it is a fixed object that lands in someone else's feed.
 */

export type CardSize = 'story' | 'link';

const SIZES: Record<CardSize, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  link: { w: 1200, h: 630 },
};

const IN = {
  bg: '#0b0b0d',
  shell: '#141418',
  surface: '#1a1a1f',
  hairline: 'rgba(250,250,250,0.10)',
  text: '#fafafa',
  secondary: '#a1a1aa',
  tertiary: '#7c7c85',
  accent: '#3fbf7f',
  over: '#f97066',
};

const SANS = '"Geist Variable", ui-sans-serif, system-ui, sans-serif';
const MONO = '"Geist Mono Variable", ui-monospace, SFMono-Regular, monospace';

export type CardInput = {
  state: GarageState;
  picks: (Vehicle | undefined)[];
  spend: number;
  shareUrl: string;
  rival?: GarageState;
};

/** Canvas has no border-radius primitive worth the name before roundRect. */
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let out = text;
  while (out.length > 3 && ctx.measureText(out + '...').width > max) out = out.slice(0, -1);
  return out + '...';
}

export async function renderShareCard(input: CardInput, size: CardSize): Promise<Blob> {
  const { w, h } = SIZES[size];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser');

  // Canvas silently falls back to a default face if the font has not loaded,
  // which produces a card that looks nothing like the app.
  if (document.fonts?.ready) {
    try {
      await document.fonts.load(`700 100px ${MONO}`);
      await document.fonts.load(`600 40px ${SANS}`);
      await document.fonts.ready;
    } catch {
      // A fallback face is worse than the real one but better than no card.
    }
  }

  ctx.fillStyle = IN.bg;
  ctx.fillRect(0, 0, w, h);

  if (size === 'story') drawStory(ctx, input, w, h);
  else drawLink(ctx, input, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Card could not be encoded'))), 'image/png');
  });
}

function drawStory(ctx: CanvasRenderingContext2D, input: CardInput, w: number, h: number) {
  const { state, picks, spend, shareUrl } = input;
  const present = picks.filter(Boolean) as Vehicle[];
  const s = summarise(present);
  const pad = 72;
  const inner = w - pad * 2;

  // Brand mark. The only place the product names itself, so it earns its line.
  ctx.textBaseline = 'top';
  ctx.font = `600 26px ${MONO}`;
  ctx.fillStyle = IN.tertiary;
  ctx.letterSpacing = '6px';
  ctx.fillText('GARAGE CHALLENGE', pad, 96);
  ctx.letterSpacing = '0px';

  // The hook. The budget is the constraint the challenge inherits, so it is
  // the largest thing on the card by a wide margin.
  ctx.font = `700 168px ${MONO}`;
  ctx.fillStyle = IN.text;
  ctx.fillText(formatUsd(state.budget), pad, 168);

  ctx.font = `400 38px ${SANS}`;
  ctx.fillStyle = IN.secondary;
  ctx.fillText(`${state.slots.length} ${state.slots.length === 1 ? 'car' : 'cars'}`, pad, 360);

  // Slot tiles, one per slot, never an empty cell. The stack is centred in the
  // region rather than top-aligned, so a three car garage does not leave a
  // dead band where the fourth and fifth would have been.
  const regionTop = 460;
  const regionBottom = h - 430;
  const gap = 20;
  const n = Math.max(1, state.slots.length);
  const tileH = Math.min(230, (regionBottom - regionTop - gap * (n - 1)) / n);
  const blockH = tileH * n + gap * (n - 1);
  const top = regionTop + Math.max(0, (regionBottom - regionTop - blockH) / 2);

  state.slots.forEach((slot, i) => {
    const v = picks[i];
    const y = top + i * (tileH + gap);
    panel(ctx, pad, y, inner, tileH, 26, IN.shell, IN.hairline);

    const midY = y + tileH / 2;
    ctx.font = `600 22px ${MONO}`;
    ctx.fillStyle = IN.accent;
    ctx.letterSpacing = '3px';
    ctx.fillText((slot.role ? ROLE_LABEL[slot.role] : `Slot ${i + 1}`).toUpperCase(), pad + 34, midY - 62);
    ctx.letterSpacing = '0px';

    if (v) {
      ctx.font = `600 46px ${SANS}`;
      ctx.fillStyle = IN.text;
      ctx.fillText(truncate(ctx, `${v.make} ${v.model}`, inner - 300), pad + 34, midY - 26);

      ctx.font = `400 26px ${MONO}`;
      ctx.fillStyle = IN.tertiary;
      ctx.fillText(`${v.generation}, ${v.years[0]}`, pad + 34, midY + 32);

      ctx.textAlign = 'right';
      ctx.font = `700 44px ${MONO}`;
      ctx.fillStyle = IN.text;
      ctx.fillText(formatUsd(slot.target), pad + inner - 34, midY - 18);
      ctx.textAlign = 'left';
    } else {
      ctx.font = `400 40px ${SANS}`;
      ctx.fillStyle = IN.tertiary;
      ctx.fillText('Empty', pad + 34, midY - 16);
    }
  });

  // A number you did not know about yourself.
  const statsY = h - 380;
  const rivalSpend = input.rival?.slots.reduce((sum, slot) => sum + slot.target, 0);
  const stats: [string, string][] = input.rival
    ? [
        ['THEIRS', formatUsd(rivalSpend ?? 0)],
        ['YOURS', formatUsd(spend)],
        ['YOUR POWER', `${s.combinedHorsepower.toLocaleString()} hp`],
      ]
    : [
        ['SPENT', formatUsd(spend)],
        ['POWER', `${s.combinedHorsepower.toLocaleString()} hp`],
        ['MANUALS', String(s.manualCars)],
      ];
  const colW = inner / stats.length;
  stats.forEach(([label, value], i) => {
    const x = pad + i * colW;
    ctx.font = `600 20px ${MONO}`;
    ctx.fillStyle = IN.tertiary;
    ctx.letterSpacing = '4px';
    ctx.fillText(label, x, statsY);
    ctx.letterSpacing = '0px';
    ctx.font = `700 52px ${MONO}`;
    ctx.fillStyle = IN.text;
    ctx.fillText(value, x, statsY + 34);
  });

  // The challenge, which is the only line on this card with a voice.
  panel(ctx, pad, h - 250, inner, 96, 48, IN.accent);
  ctx.textAlign = 'center';
  ctx.font = `600 42px ${SANS}`;
  ctx.fillStyle = IN.bg;
  ctx.fillText(
    input.rival ? `Head to head · ${formatUsd(state.budget)}` : `Beat my ${formatUsd(state.budget)} garage`,
    w / 2,
    h - 222,
  );

  ctx.font = `400 24px ${MONO}`;
  ctx.fillStyle = IN.tertiary;
  ctx.fillText(truncate(ctx, hostOf(shareUrl), inner), w / 2, h - 120);
  ctx.textAlign = 'left';
}

function drawLink(ctx: CanvasRenderingContext2D, input: CardInput, w: number, h: number) {
  const { state, picks, spend } = input;
  const present = picks.filter(Boolean) as Vehicle[];
  const s = summarise(present);
  const pad = 56;

  ctx.textBaseline = 'top';
  ctx.font = `600 20px ${MONO}`;
  ctx.fillStyle = IN.tertiary;
  ctx.letterSpacing = '5px';
  ctx.fillText('GARAGE CHALLENGE', pad, pad);
  ctx.letterSpacing = '0px';

  ctx.font = `700 118px ${MONO}`;
  ctx.fillStyle = IN.text;
  ctx.fillText(formatUsd(state.budget), pad, pad + 46);

  ctx.font = `400 28px ${SANS}`;
  ctx.fillStyle = IN.secondary;
  ctx.fillText(
    `${state.slots.length} cars · ${formatUsd(spend)} spent · ${s.combinedHorsepower.toLocaleString()} hp`,
    pad, pad + 182,
  );

  panel(ctx, pad, h - 128, 520, 72, 36, IN.accent);
  ctx.textAlign = 'center';
  ctx.font = `600 32px ${SANS}`;
  ctx.fillStyle = IN.bg;
  ctx.fillText(
    input.rival ? `Head to head · ${formatUsd(state.budget)}` : `Beat my ${formatUsd(state.budget)} garage`,
    pad + 260,
    h - 108,
  );
  ctx.textAlign = 'left';

  // Right column: one line per slot, never an empty cell.
  const colX = w / 2 + 40;
  const colW = w - colX - pad;
  const n = Math.max(1, state.slots.length);
  const rowH = Math.min(112, (h - pad * 2) / n);
  const colTop = pad + Math.max(0, (h - pad * 2 - rowH * n) / 2);
  state.slots.forEach((slot, i) => {
    const v = picks[i];
    const y = colTop + i * rowH;
    panel(ctx, colX, y, colW, rowH - 10, 18, IN.shell, IN.hairline);

    const mid = y + (rowH - 10) / 2;
    ctx.font = `600 17px ${MONO}`;
    ctx.fillStyle = IN.accent;
    ctx.letterSpacing = '2px';
    ctx.fillText((slot.role ? ROLE_LABEL[slot.role] : `Slot ${i + 1}`).toUpperCase(), colX + 20, mid - 30);
    ctx.letterSpacing = '0px';

    ctx.font = `600 28px ${SANS}`;
    ctx.fillStyle = v ? IN.text : IN.tertiary;
    ctx.fillText(truncate(ctx, v ? `${v.make} ${v.model}` : 'Empty', colW - 170), colX + 20, mid - 4);

    ctx.textAlign = 'right';
    ctx.font = `700 28px ${MONO}`;
    ctx.fillStyle = IN.secondary;
    ctx.fillText(formatUsd(slot.target), colX + colW - 20, mid - 4);
    ctx.textAlign = 'left';
  });
}

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.host + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function cardFileName(state: GarageState, size: CardSize): string {
  return `garage-challenge-${Math.round(state.budget / 1000)}k-${size}.png`;
}
