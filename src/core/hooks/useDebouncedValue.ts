import { useEffect, useState } from 'react';
export const useDebouncedValue = <T>(value: T, delay = 1000): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
};
