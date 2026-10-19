import { useCallback } from 'react';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';
import { runUiAction } from '../async/uiAction';

type SafeNavigate = {
  (to: To, options?: NavigateOptions): void;
  (delta: number): void;
};

/** Handles both synchronous BrowserRouter navigation and rejected async router transitions. */
export const useSafeNavigate = (): SafeNavigate => {
  const navigate = useNavigate();
  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      runUiAction(() => {
        if (typeof to === 'number') return navigate(to);
        return navigate(to, options);
      });
    },
    [navigate],
  );
};
