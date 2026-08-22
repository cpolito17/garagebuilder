import { useSyncExternalStore } from 'react';

/**
 * Render one layout, not both.
 *
 * Showing the mobile tree and the desktop tree together and hiding one with
 * CSS duplicates every slot in the DOM: doubled render work, doubled result
 * matching, and duplicate element ids, which is an accessibility defect
 * because a label can then point at two controls.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false, // server and pre-hydration default to the mobile layout
  );
}

export const useIsDesktop = () => useMediaQuery('(min-width: 768px)');
