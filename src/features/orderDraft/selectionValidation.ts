import type { OrderDraftLine } from './types';
import { validateDraftLine } from './validation';

/** Preview rows have transient local IDs. Their errors use the commercial/bonus identity instead. */
export const validateLineSelection = (lines: OrderDraftLine[]) =>
  lines.flatMap((line) =>
    validateDraftLine(line).map((error) => ({
      ...error,
      key: JSON.stringify([
        line.itemId,
        line.presentationCode,
        line.isBonification,
        error.code,
        error.field,
      ]),
    })),
  );
