import { Info } from '@phosphor-icons/react';

/**
 * Names the constraint that eliminated the last candidate, and where possible
 * offers the exact value that brings something back. docs/DESIGN.md 6.7.
 */
export function EmptyState({
  message, action, onAction,
}: {
  message: string;
  action?: { label: string; value: number } | undefined;
  onAction?: (value: number) => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[14px] p-4"
      style={{ background: 'var(--bg-shell)', border: '1px solid var(--hairline)' }}
    >
      <div className="flex gap-2.5">
        <Info size={17} className="mt-0.5 shrink-0 text-[--text-tertiary]" aria-hidden />
        <p className="t-small text-[--text-secondary] m-0">{message}</p>
      </div>
      {action && onAction && (
        <button
          type="button"
          onClick={() => onAction(action.value)}
          className="self-start rounded-full px-4 py-2 t-small transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
          style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
