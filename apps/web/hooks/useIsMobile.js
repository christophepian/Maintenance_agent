import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport is below 768px (Tailwind `md` breakpoint).
 * Always returns false on the server (SSR) and on first render to prevent
 * hydration mismatches. Updates reactively when the viewport is resized.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsMobile(mql.matches);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
