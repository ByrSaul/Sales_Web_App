import { userErrorMessage } from '../api/errors';

/** Reports an unexpected UI failure without exposing tokens, payloads or backend details. */
export const showUiActionError = (error: unknown): void => {
  window.alert(userErrorMessage(error));
};

/** Runs one explicit UI action, handles its failure and never retries it. */
export const runUiAction = (
  action: () => void | Promise<unknown>,
  onError: (error: unknown) => void = showUiActionError,
): void => {
  try {
    const result = action();
    if (result) void result.catch(onError);
  } catch (error) {
    onError(error);
  }
};
