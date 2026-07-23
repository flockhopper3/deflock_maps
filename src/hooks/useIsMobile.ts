import { useEffect, useState } from 'react';

/** Tailwind's `lg` breakpoint — the single source of truth for mobile layout. */
export const MOBILE_BREAKPOINT = 1024;

/**
 * Tracks whether the viewport is below the `lg` breakpoint.
 *
 * Deliberately width-only: an embed narrower than 1024px gets the mobile
 * layout, same as any other narrow viewport. Two components previously kept
 * private copies of this state and disagreed in embed mode.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}
