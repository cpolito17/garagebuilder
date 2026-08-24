import { decodeGarage } from '../src/lib/urlState';
import { byId } from '../src/data/catalog';
import { summarise } from '../src/lib/garageSummary';
import type { Vehicle } from '../src/data/types';

/**
 * Per-garage link previews. docs/SPEC.md section 6.4.
 *
 * A static site cannot serve per-garage Open Graph tags, so every pasted link
 * shows the same generic card in iMessage, Discord and X. That is a direct tax
 * on the only distribution mechanism this product has.
 *
 * These functions are pure so they can be tested without a Worker runtime.
 */

const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export type Preview = {
  title: string;
  description: string;
  /** True when the URL carried a readable garage. */
  specific: boolean;
};

export const DEFAULT_PREVIEW: Preview = {
  title: 'Garage Challenge',
  description:
    'Split one car budget across several cars that each do a different job. Set a budget, pick what each slot is for, and see what the money actually buys.',
  specific: false,
};

export function previewFor(stateParam: string | null): Preview {
  const garage = decodeGarage(stateParam);
  if (!garage) return DEFAULT_PREVIEW;

  const picks = garage.slots
    .map((s) => (s.pick ? byId.get(s.pick) : undefined))
    .filter(Boolean) as Vehicle[];

  // A garage with nothing picked is someone's saved work, not a challenge.
  if (picks.length === 0) {
    return {
      title: `A ${fmt(garage.budget)} garage, ${garage.slots.length} ${garage.slots.length === 1 ? 'car' : 'cars'}`,
      description: DEFAULT_PREVIEW.description,
      specific: true,
    };
  }

  const s = summarise(picks);
  const names = picks.map((v) => `${v.make} ${v.model}`);
  const spend = garage.slots.reduce((a, x) => a + x.target, 0);

  // The title is the hook and the constraint the challenge inherits.
  const title = `Beat my ${fmt(garage.budget)} garage`;

  const listed = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
  const description =
    `${listed}. ${fmt(spend)} spent, ` +
    `${s.combinedHorsepower.toLocaleString()} hp, ${s.pedals} pedals. ` +
    `Same budget, same slots. Do better.`;

  return { title, description, specific: true };
}

/** Escape for an HTML attribute. Garage state is user controlled. */
export function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Rewrite the meta tags in the served HTML.
 *
 * Replaces rather than appends, because a second og:title does not override
 * the first on any platform that matters, it just makes the markup wrong.
 */
export function injectMeta(html: string, preview: Preview, canonicalUrl: string, imageUrl: string): string {
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Garage Challenge" />`,
    `<meta property="og:title" content="${escapeAttr(preview.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(preview.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeAttr(imageUrl)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(preview.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(preview.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(imageUrl)}" />`,
  ].join('\n    ');

  // Drop any existing description and social tags so there is exactly one of each.
  const stripped = html
    .replace(/\s*<meta\s+name="description"[^>]*>/gi, '')
    .replace(/\s*<meta\s+property="og:[^"]*"[^>]*>/gi, '')
    .replace(/\s*<meta\s+name="twitter:[^"]*"[^>]*>/gi, '');

  const description = `<meta name="description" content="${escapeAttr(preview.description)}" />`;
  return stripped.replace('</head>', `  ${description}\n    ${tags}\n  </head>`);
}
