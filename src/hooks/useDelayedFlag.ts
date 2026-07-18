import { useEffect, useState } from 'react';

/**
 * Returns true only after `active` has been continuously true for `delayMs`.
 * Gates loading placeholders so fast loads render content directly with no flash.
 */
export function useDelayedFlag(active: boolean, delayMs = 150): boolean {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!active) {
      setDelayed(false);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return delayed;
}
