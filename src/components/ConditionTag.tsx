import { conditionById, type ConditionId } from '../lib/condition';

/**
 * The condition a price was quoted at, wherever that price is shown.
 *
 * A number without its condition is not an estimate, it is a claim. This chip
 * is what keeps "$18,500" honest on a result card, in the detail view, and in
 * a shared garage where the recipient never touched the control that set it.
 *
 * The colour is the band's own, so the tag is recognisable before it is read.
 */
export function ConditionTag({
  condition, showRange = false, className = '',
}: { condition: ConditionId; showRange?: boolean; className?: string }) {
  const c = conditionById(condition);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 t-small ${className}`}
      style={{ background: c.wash, color: c.color, border: `1px solid ${c.color}33` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
      {c.label}
      {showRange && <span className="num opacity-70">{c.range}</span>}
    </span>
  );
}
