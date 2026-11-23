import { useEffect, useRef, useState } from 'react';
import { saveLocal } from '../lib/storage';

/** Estado React persistido en localStorage (con debounce). */
export function usePersistentState<T>(key: 'signals' | 'settings' | 'log', init: () => T) {
  const [state, setState] = useState<T>(init);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => saveLocal(key, state), 250);
    return () => window.clearTimeout(t.current);
  }, [key, state]);
  return [state, setState] as const;
}
