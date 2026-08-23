import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validDraft } from '../../features/orders/testFixtures';
import type { OrderSubmission } from '../../features/orders/types';
const mocks = vi.hoisted(() => ({ draft: vi.fn(), submission: vi.fn() }));
vi.mock('../../features/orderDraft/OrderDraftProvider', () => ({
  useOrderDraft: () => mocks.draft(),
}));
vi.mock('../../features/orders/OrderSubmissionProvider', () => ({
  useOrderSubmission: () => mocks.submission(),
}));
import OrderDraftReviewPage from './OrderDraftReviewPage';

describe('OrderDraftReviewPage transaction flow', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => `id-${Math.random()}` });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  it('confirms a real submission and renders the successful result', async () => {
    const draft = validDraft();
    const submit = vi.fn().mockResolvedValue(undefined);
    const draftValue = { draft, updateLine: vi.fn(), removeLine: vi.fn(), reset: vi.fn() };
    mocks.draft.mockReturnValue(draftValue);
    mocks.submission.mockReturnValue({
      submission: null,
      active: false,
      submit,
      retryPending: vi.fn(),
      discardRecovery: vi.fn(),
      createAnother: vi.fn(),
    });
    const view = render(
      <MemoryRouter>
        <OrderDraftReviewPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /crear pedido real/i }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Dynamics 365'));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const completed: OrderSubmission = {
      schemaVersion: 1,
      accountId: draft.accountId,
      companyId: draft.dataAreaId,
      draftId: draft.id,
      salesOrderNumber: 'OV-100',
      status: 'completed',
      headerAmbiguous: false,
      createdAt: draft.updatedAt,
      updatedAt: draft.updatedAt,
      snapshot: draft,
      lines: draft.lines.map((line) => ({
        localId: line.localId,
        status: 'created',
        attempts: 1,
        error: null,
        backendLineNumber: 1,
        draftLine: line,
      })),
      error: null,
    };
    mocks.submission.mockReturnValue({
      submission: completed,
      active: false,
      submit,
      retryPending: vi.fn(),
      discardRecovery: vi.fn(),
      createAnother: vi.fn(),
    });
    view.rerender(
      <MemoryRouter>
        <OrderDraftReviewPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Pedido creado correctamente')).toBeInTheDocument();
    expect(screen.getByText('OV-100')).toBeInTheDocument();
  });
});
