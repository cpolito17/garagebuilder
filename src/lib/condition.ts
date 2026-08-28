/**
 * Condition bands. docs/SPEC.md section 4.3.
 *
 * The odometer used to be a continuous dial. It asked the user to have an
 * opinion about 137,500 miles, which nobody has. What people actually have an
 * opinion about is condition: a nearly-new car, an ordinary used one, or a
 * beater they can wear out without grieving. Six named bands ask that question
 * directly, and each one carries the odometer the price model needs.
 *
 * Every band prices at its ceiling — the most miles the band allows. That is
 * the most car the money buys inside the band, and it makes the label honest:
 * "under 60k" priced at 60,000 can only be a pleasant surprise in the real
 * world, never a disappointment.
 */

export type ConditionId = 'new' | 'minimal' | 'tested' | 'worn' | 'high' | 'beater';

export type Condition = {
  id: ConditionId;
  label: string;
  /** The odometer every result in the slot is priced at. */
  miles: number;
  /** How the band reads, in the user's terms rather than the model's. */
  range: string;
  /**
   * CSS custom property holding this band's colour. Paired with
   * `var(--cond-<id>-wash)` for the chip background. Defined in app.css so the
   * palette stays in the token file with every other colour decision.
   */
  color: string;
  wash: string;
};

/**
 * The wire order. Links encode the index, so bands may be renamed, recoloured
 * or re-anchored, but never reordered or removed without breaking every link
 * ever shared.
 */
export const CONDITIONS: Condition[] = [
  { id: 'new', label: 'Factory New', miles: 0, range: '0 mi', color: 'var(--cond-new)', wash: 'var(--cond-new-wash)' },
  { id: 'minimal', label: 'Minimal Wear', miles: 30_000, range: 'under 30k mi', color: 'var(--cond-minimal)', wash: 'var(--cond-minimal-wash)' },
  { id: 'tested', label: 'Road-Tested', miles: 60_000, range: 'under 60k mi', color: 'var(--cond-tested)', wash: 'var(--cond-tested-wash)' },
  { id: 'worn', label: 'Well Worn', miles: 100_000, range: 'under 100k mi', color: 'var(--cond-worn)', wash: 'var(--cond-worn-wash)' },
  { id: 'high', label: 'High Mileage', miles: 200_000, range: 'under 200k mi', color: 'var(--cond-high)', wash: 'var(--cond-high-wash)' },
  { id: 'beater', label: 'Beater', miles: 250_000, range: 'over 200k mi', color: 'var(--cond-beater)', wash: 'var(--cond-beater-wash)' },
];

export const CONDITION_ORDER: ConditionId[] = CONDITIONS.map((c) => c.id);

/**
 * Where a slot starts. Well Worn is the odometer the dial used to default to,
 * and it is what most people picture when they picture a used car.
 */
export const DEFAULT_CONDITION: ConditionId = 'worn';

const BY_ID = new Map(CONDITIONS.map((c) => [c.id, c]));

/** Falls back to the default rather than throwing: a bad id is a bad link, and a bad link still has to open. */
export function conditionById(id: ConditionId | string | null | undefined): Condition {
  return BY_ID.get(id as ConditionId) ?? BY_ID.get(DEFAULT_CONDITION)!;
}

export function milesFor(id: ConditionId): number {
  return conditionById(id).miles;
}

/**
 * The band a raw odometer belongs to, by nearest anchor.
 *
 * Only links written before conditions existed carry an arbitrary odometer.
 * Snapping them keeps the tag and the price telling the same story, which
 * matters more than preserving a number the sender never chose deliberately.
 */
export function conditionForMiles(miles: number): Condition {
  let best = CONDITIONS[0]!;
  for (const c of CONDITIONS) {
    if (Math.abs(c.miles - miles) < Math.abs(best.miles - miles)) best = c;
  }
  return best;
}

/**
 * The cheapest band that reaches at least `miles`, or null when even a beater
 * does not go far enough. This is what lets the empty state offer a band to
 * switch to instead of an odometer to type.
 */
export function conditionAtLeast(miles: number): Condition | null {
  return CONDITIONS.find((c) => c.miles >= miles) ?? null;
}

/** "Well Worn, under 100k mi". One string for share text and link previews. */
export function conditionSentence(id: ConditionId): string {
  const c = conditionById(id);
  return `${c.label}, ${c.range}`;
}

/**
 * How a whole garage describes its condition: one band when every slot agrees,
 * the span when they do not. A garage of five different bands is a real answer
 * to the question, so it gets a real phrase rather than "mixed".
 */
export function conditionSpan(ids: ConditionId[]): string {
  if (ids.length === 0) return '';
  const indices = ids.map((id) => CONDITION_ORDER.indexOf(conditionById(id).id));
  const low = Math.min(...indices);
  const high = Math.max(...indices);
  if (low === high) return conditionSentence(CONDITION_ORDER[low]!);
  return `${conditionById(CONDITION_ORDER[low]).label} to ${conditionById(CONDITION_ORDER[high]).label}`;
}
