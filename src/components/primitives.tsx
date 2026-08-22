import type { ReactNode } from 'react';

/**
 * The nested shell. docs/DESIGN.md section 6.1.
 * An outer tray and an inner core with concentric radii, so a container reads
 * as a machined object in a housing rather than a rectangle on a background.
 * Not used below 44px, where the nesting is invisible and only costs DOM.
 */
export function Shell({
  children, className = '', outer = 20, pad = 6, as: Tag = 'div', ...rest
}: {
  children: ReactNode; className?: string; outer?: number; pad?: number;
  as?: 'div' | 'section' | 'article';
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={`shell ${className}`}
      style={{ borderRadius: outer, padding: pad }}
      {...rest}
    >
      <div className="core h-full" style={{ borderRadius: outer - pad }}>
        {children}
      </div>
    </Tag>
  );
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`t-label text-[--text-tertiary] ${className}`}>{children}</span>;
}

/** Spec chip. Hairline, no fill, 10px radius per the shape system. */
export function Chip({ icon, children, title }: { icon?: ReactNode; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-[--hairline] px-2 py-1 t-small text-[--text-secondary] whitespace-nowrap"
    >
      {icon}
      {children}
    </span>
  );
}

export function Num({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`num ${className}`}>{children}</span>;
}
