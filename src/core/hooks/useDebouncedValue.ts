import { useEffect, useState } from 'react';
/**
 * Retrasa la publicación de un valor hasta que transcurra un periodo sin cambios.
 *
 * @param value Valor observado.
 * @param delay Espera en milisegundos antes de actualizar el resultado.
 * @returns Último valor estabilizado.
 */
export const useDebouncedValue = <T>(value: T, delay = 1000): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
};
