import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const flow = (overrides: Record<string, unknown> = {}) => ({
  submission: null,
  active: false,
  busy: false,
  unresolved: false,
  submit: vi.fn().mockResolvedValue(undefined),
  verifyPending: vi.fn().mockResolvedValue(undefined),
  retryPending: vi.fn().mockResolvedValue(undefined),
  discardRecovery: vi.fn(),
  createAnother: vi.fn(),
  ...overrides,
});
const submissionOf = (
  draft: ReturnType<typeof validDraft>,
  overrides: Partial<OrderSubmission> = {},
): OrderSubmission => ({
  schemaVersion: 1,
  accountId: draft.accountId,
  companyId: draft.dataAreaId,
  draftId: draft.id,
  salesOrderNumber: 'OV-100',
  status: 'completed',
  headerAmbiguous: false,
  headerIdempotencyKey: 'header-key',
  headerTracking: 'completed',
  createdAt: draft.updatedAt,
  updatedAt: draft.updatedAt,
  snapshot: draft,
  lines: draft.lines.map((line) => ({
    localId: line.localId,
    idempotencyKey: `key-${line.localId}`,
    tracking: 'completed',
    status: 'created',
    attempts: 1,
    error: null,
    backendLineNumber: 1,
    draftLine: line,
  })),
  error: null,
  ...overrides,
});
const renderPage = () =>
  render(
    <MemoryRouter>
      <OrderDraftReviewPage />
    </MemoryRouter>,
  );

describe('OrderDraftReviewPage transaction flow', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => `id-${Math.random()}` });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(cleanup);
  const setDraft = (draft = validDraft()) => {
    mocks.draft.mockReturnValue({
      draft,
      attachments: [],
      updateLine: vi.fn(),
      removeLine: vi.fn(),
      reset: vi.fn(),
    });
    return draft;
  };

  it('confirms a real submission and renders the successful result', async () => {
    const draft = setDraft();
    const value = flow();
    mocks.submission.mockReturnValue(value);
    const view = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /crear pedido real/i }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Dynamics 365'));
    await waitFor(() => expect(value.submit).toHaveBeenCalledTimes(1));
    mocks.submission.mockReturnValue(flow({ submission: submissionOf(draft) }));
    view.rerender(
      <MemoryRouter>
        <OrderDraftReviewPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Pedido creado correctamente')).toBeInTheDocument();
    expect(screen.getByText('OV-100')).toBeInTheDocument();
  });

  it('offers only a status check while a line is awaiting confirmation', () => {
    const draft = setDraft(validDraft(2));
    const base = submissionOf(draft);
    const submission = submissionOf(draft, {
      status: 'awaiting-confirmation',
      lines: [
        base.lines[0],
        { ...base.lines[1], tracking: 'awaiting-confirmation', status: 'unconfirmed' },
      ],
    });
    const value = flow({ submission, unresolved: true });
    mocks.submission.mockReturnValue(value);
    renderPage();
    expect(screen.getByText('Esperando confirmación del Backend')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reintentar líneas pendientes/i })).toBeNull();
    expect(screen.getAllByText(/reintento bloqueado/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /consultar estado/i }));
    expect(value.verifyPending).toHaveBeenCalledTimes(1);
    expect(value.retryPending).not.toHaveBeenCalled();
    expect(value.submit).not.toHaveBeenCalled();
  });

  it('checks an unconfirmed header with the same operation instead of resubmitting', () => {
    const draft = setDraft();
    const submission = submissionOf(draft, {
      salesOrderNumber: null,
      status: 'failed',
      headerAmbiguous: true,
      headerTracking: 'awaiting-confirmation',
      error: 'pendiente',
      lines: submissionOf(draft).lines.map((line) => ({ ...line, tracking: 'not-sent', status: 'pending' })),
    });
    const value = flow({ submission, unresolved: true });
    mocks.submission.mockReturnValue(value);
    renderPage();
    expect(screen.queryByRole('button', { name: /reintentar encabezado/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /crear pedido real/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /consultar estado del encabezado/i }));
    expect(value.verifyPending).toHaveBeenCalledTimes(1);
  });

  it('allows retrying lines only when the backend confirmed the failure', () => {
    const draft = setDraft(validDraft(2));
    const base = submissionOf(draft);
    const submission = submissionOf(draft, {
      status: 'partial-failure',
      lines: [base.lines[0], { ...base.lines[1], tracking: 'failed', status: 'failed' }],
    });
    const value = flow({ submission });
    mocks.submission.mockReturnValue(value);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /reintentar líneas pendientes/i }));
    expect(value.retryPending).toHaveBeenCalledTimes(1);
  });

  it('asks to verify Mis pedidos before a new header request after a confirmed Failed', async () => {
    const draft = setDraft();
    const submission = submissionOf(draft, {
      salesOrderNumber: null,
      status: 'failed',
      headerAmbiguous: false,
      headerTracking: 'failed',
      error: 'falló',
      lines: submissionOf(draft).lines.map((line) => ({ ...line, tracking: 'not-sent', status: 'pending' })),
    });
    const value = flow({ submission });
    mocks.submission.mockReturnValue(value);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /reintentar encabezado/i }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('comprobará en el Backend'));
    expect(value.retryPending).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /reintentar encabezado/i }));
    await waitFor(() => expect(value.retryPending).toHaveBeenCalledTimes(1));
    expect(value.submit).not.toHaveBeenCalled();
  });

  it('disables the commands while one is running', () => {
    const draft = setDraft(validDraft(2));
    const base = submissionOf(draft);
    const submission = submissionOf(draft, {
      status: 'partial-failure',
      lines: [base.lines[0], { ...base.lines[1], tracking: 'rejected', status: 'failed' }],
    });
    mocks.submission.mockReturnValue(flow({ submission, busy: true }));
    renderPage();
    expect(screen.getByRole('button', { name: /reintentar líneas pendientes/i })).toBeDisabled();
  });
});
