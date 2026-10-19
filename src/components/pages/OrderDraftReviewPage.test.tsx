let fixtureId = 0;
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validDraft } from "../../features/orders/testFixtures";
import type { OrderSubmission } from "../../features/orders/types";
const mocks = vi.hoisted(() => ({ draft: vi.fn(), submission: vi.fn() }));
vi.mock("../../features/orderDraft/OrderDraftProvider", () => ({
  useOrderDraft: () => mocks.draft(),
}));
vi.mock("../../features/orders/OrderSubmissionProvider", () => ({
  useOrderSubmission: () => mocks.submission(),
}));
import OrderDraftReviewPage from "./OrderDraftReviewPage";

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

describe("OrderDraftReviewPage recovery, editing and navigation coverage", () => {
  const Location = () => (
    <output data-testid="location">{useLocation().pathname}</output>
  );
  const mount = () =>
    render(
      <MemoryRouter>
        <OrderDraftReviewPage />
        <Location />
      </MemoryRouter>,
    );
  const setup = (overrides: Record<string, unknown> = {}) => {
    const draft = validDraft();
    const state = {
      draft,
      attachments: [] as { file: File; description: string }[],
      updateLine: vi.fn(),
      removeLine: vi.fn(),
      reset: vi.fn(),
    };
    const value = flow(overrides);
    mocks.draft.mockReturnValue(state);
    mocks.submission.mockReturnValue(value);
    return { state, value, draft };
  };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ["Ver detalle real", "/pedidos/OV-100"],
    ["Agregar adjuntos", "/pedidos/OV-100/adjuntos"],
    ["Crear otro pedido", "/crear-pedido"],
    ["Volver al inicio", "/home"],
  ])("routes completed orders through %s", (label, path) => {
    const { draft, value } = setup();
    mocks.submission.mockReturnValue({
      ...value,
      submission: submissionOf(draft),
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByTestId("location")).toHaveTextContent(path);
    expect(value.createAnother).toHaveBeenCalledTimes(
      Number(label === "Crear otro pedido"),
    );
    expect(value.submit).not.toHaveBeenCalled();
  });
  it("edits quantities and removes local lines without submitting", () => {
    const { state, draft, value } = setup();
    mount();
    fireEvent.change(screen.getByLabelText("Cantidad I1"), {
      target: { value: "3" },
    });
    expect(state.updateLine).toHaveBeenCalledExactlyOnceWith(
      draft.lines[0].localId,
      {
        quantity: 3,
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(state.removeLine).toHaveBeenCalledExactlyOnceWith(
      draft.lines[0].localId,
    );
    expect(value.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Editar encabezado" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/crear-pedido");
    fireEvent.click(screen.getByRole("button", { name: "Editar líneas" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/crear-pedido/linea",
    );
  });
  it.each([false, true])(
    "requires confirmation to discard an editable draft (%s)",
    (confirmed) => {
      const { state, value } = setup();
      vi.mocked(window.confirm).mockReturnValue(confirmed);
      mount();
      fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
      expect(state.reset).toHaveBeenCalledTimes(Number(confirmed));
      expect(value.submit).not.toHaveBeenCalled();
      if (confirmed)
        expect(screen.getByTestId("location")).toHaveTextContent(
          "/crear-pedido",
        );
    },
  );
  it.each(["busy", "unresolved", "cancelled"])(
    "blocks creation when %s without another transaction",
    async (state) => {
      const { value } = setup({
        busy: state === "busy",
        unresolved: state === "unresolved",
      });
      if (state === "cancelled")
        vi.mocked(window.confirm).mockReturnValue(false);
      mount();
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Crear pedido real" }),
        );
      });
      expect(value.submit).not.toHaveBeenCalled();
    },
  );
  it("reports a rejected submit without creating an automatic retry", async () => {
    const { value } = setup();
    value.submit.mockRejectedValue(new Error("offline"));
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    mount();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Crear pedido real" }),
      );
    });
    expect(value.submit).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it("disables creation and displays validation failures for an incomplete draft", () => {
    const { state } = setup();
    state.draft = {
      ...state.draft,
      customer: null,
      currencyCode: "",
      deliveryAddress: null,
      deliveryMode: null,
      salesOrigin: null,
      lines: [],
    };
    mount();
    expect(
      screen.getByText("El borrador aún no está listo"),
    ).toBeInTheDocument();
    expect(screen.getByText("El cliente es obligatorio.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear pedido real" }),
    ).toBeDisabled();
  });
  it("blocks creation with an invalid attachment without dispatching it", () => {
    const { state, value } = setup();
    state.attachments = [
      { file: new File(["x"], "unsafe.exe"), description: "" },
    ];
    mount();
    expect(
      screen.getByRole("button", { name: "Crear pedido real" }),
    ).toBeDisabled();
    expect(value.submit).not.toHaveBeenCalled();
  });
  it("locks linked bonus quantities but preserves independent bonus editing and labels", () => {
    const { state } = setup();
    const normal = state.draft.lines[0];
    state.draft.lines = [
      {
        ...normal,
        localId: "bonus-linked",
        itemId: "B1",
        isBonification: true,
        parentLineId: "relation",
        promotion: {
          groupId: "PROMO",
          name: "Promoción",
          forecastDiscount: 10,
        },
      },
      {
        ...normal,
        localId: "bonus-alone",
        itemId: "B2",
        isBonification: true,
        parentLineId: null,
      },
    ];
    mount();
    expect(screen.getByLabelText("Cantidad B1")).toBeDisabled();
    expect(screen.getByLabelText("Cantidad B2")).toBeEnabled();
    expect(screen.getByText("Bonus PROMO")).toBeInTheDocument();
    expect(screen.getByText("Bonus independiente")).toBeInTheDocument();
  });
  it.each([false, true])(
    "does not discard ambiguous header tracking without user confirmation (%s)",
    (confirmed) => {
      const { draft, value } = setup();
      mocks.submission.mockReturnValue({
        ...value,
        submission: submissionOf(draft, {
          salesOrderNumber: null,
          status: "failed",
          headerTracking: "awaiting-confirmation",
          headerAmbiguous: true,
          headerIdempotencyKey: null,
        }),
      });
      vi.mocked(window.confirm).mockReturnValue(confirmed);
      mount();
      expect(
        screen.queryByRole("button", {
          name: "Consultar estado del encabezado",
        }),
      ).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Descartar recuperación local" }),
      );
      expect(value.discardRecovery).toHaveBeenCalledTimes(Number(confirmed));
      expect(value.submit).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Ir a Mis pedidos" }));
      expect(screen.getByTestId("location")).toHaveTextContent("/pedidos");
    },
  );
  it("retries an unsent header explicitly and permits returning to the draft", async () => {
    const { draft, value } = setup();
    mocks.submission.mockReturnValue({
      ...value,
      submission: submissionOf(draft, {
        salesOrderNumber: null,
        status: "failed",
        headerTracking: "not-sent",
      }),
    });
    mount();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Reintentar encabezado" }),
      );
    });
    expect(value.submit).toHaveBeenCalledTimes(1);
    expect(value.retryPending).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Volver al borrador" }));
    expect(value.discardRecovery).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])(
    "retains a failed header recovery until discard is confirmed (%s)",
    (confirmed) => {
      const { draft, value } = setup();
      mocks.submission.mockReturnValue({
        ...value,
        submission: submissionOf(draft, {
          salesOrderNumber: null,
          status: "failed",
          headerTracking: "rejected",
        }),
      });
      vi.mocked(window.confirm).mockReturnValue(confirmed);
      mount();
      fireEvent.click(
        screen.getByRole("button", { name: "Descartar recuperación local" }),
      );
      expect(value.discardRecovery).toHaveBeenCalledTimes(Number(confirmed));
      fireEvent.click(screen.getByRole("button", { name: "Ir a Mis pedidos" }));
      expect(screen.getByTestId("location")).toHaveTextContent("/pedidos");
    },
  );
  it("handles rejection of a new header request without resubmitting it", async () => {
    const { draft, value } = setup();
    value.retryPending.mockRejectedValue(new Error("offline"));
    mocks.submission.mockReturnValue({
      ...value,
      submission: submissionOf(draft, {
        salesOrderNumber: null,
        status: "failed",
        headerTracking: "failed",
      }),
    });
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    mount();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Reintentar encabezado" }),
      );
    });
    expect(value.retryPending).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(value.submit).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "allows attachment retry only with confirmed permission (%s)",
    async (allowed) => {
      const { draft, value } = setup();
      value.retryPending.mockRejectedValue(new Error("offline"));
      mocks.submission.mockReturnValue({
        ...value,
        submission: submissionOf(draft, {
          status: "partial-failure",
          attachmentError: "Adjunto sin confirmar",
          attachmentRetryAllowed: allowed,
        }),
      });
      const alert = vi
        .spyOn(window, "alert")
        .mockImplementation(() => undefined);
      mount();
      expect(
        screen.queryByRole("button", { name: "Reintentar líneas pendientes" }),
      ).not.toBeInTheDocument();
      if (allowed) {
        await act(async () => {
          fireEvent.click(
            screen.getByRole("button", {
              name: "Reintentar carga del comprobante",
            }),
          );
        });
        expect(value.retryPending).toHaveBeenCalledTimes(1);
        expect(alert).toHaveBeenCalledTimes(1);
      } else
        expect(
          screen.queryByRole("button", {
            name: "Reintentar carga del comprobante",
          }),
        ).not.toBeInTheDocument();
      vi.mocked(window.confirm).mockReturnValueOnce(false);
      fireEvent.click(
        screen.getByRole("button", { name: "Descartar recuperación" }),
      );
      expect(value.discardRecovery).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", { name: "Descartar recuperación" }),
      );
      expect(value.discardRecovery).toHaveBeenCalledTimes(1);
    },
  );
  it("shows upload progress and attachment errors while all editing stays locked", () => {
    const { draft, value } = setup();
    mocks.submission.mockReturnValue({
      ...value,
      busy: true,
      submission: submissionOf(draft, {
        status: "uploading-attachments",
        attachmentError: "Verificación pendiente",
      }),
    });
    mount();
    expect(screen.getByText("Subiendo adjuntos...")).toBeInTheDocument();
    expect(screen.getByText("Verificación pendiente")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad I1")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
  });
  it("shows a zero-line recovery and handles a rejected manual verification", async () => {
    const { draft, value } = setup();
    value.verifyPending.mockRejectedValue(new Error("offline"));
    mocks.submission.mockReturnValue({
      ...value,
      unresolved: true,
      submission: submissionOf(draft, {
        status: "awaiting-confirmation",
        lines: [],
      }),
    });
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    mount();
    expect(screen.getByText("0 / 0")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    });
    expect(value.verifyPending).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Ir a Mis pedidos" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/pedidos");
  });
});
const submissionOf = (
  draft: ReturnType<typeof validDraft>,
  overrides: Partial<OrderSubmission> = {},
): OrderSubmission => ({
  schemaVersion: 1,
  accountId: draft.accountId,
  companyId: draft.dataAreaId,
  draftId: draft.id,
  salesOrderNumber: "OV-100",
  status: "completed",
  headerAmbiguous: false,
  headerIdempotencyKey: "header-key",
  headerTracking: "completed",
  createdAt: draft.updatedAt,
  updatedAt: draft.updatedAt,
  snapshot: draft,
  lines: draft.lines.map((line) => ({
    localId: line.localId,
    idempotencyKey: `key-${line.localId}`,
    tracking: "completed",
    status: "created",
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

describe("OrderDraftReviewPage transaction flow", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => `id-${++fixtureId}` });
    vi.spyOn(window, "confirm").mockReturnValue(true);
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

  it("confirms a real submission and renders the successful result", async () => {
    const draft = setDraft();
    const value = flow();
    mocks.submission.mockReturnValue(value);
    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: /crear pedido real/i }));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Dynamics 365"),
    );
    await waitFor(() => expect(value.submit).toHaveBeenCalledTimes(1));
    mocks.submission.mockReturnValue(flow({ submission: submissionOf(draft) }));
    view.rerender(
      <MemoryRouter>
        <OrderDraftReviewPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Pedido creado correctamente")).toBeInTheDocument();
    expect(screen.getByText("OV-100")).toBeInTheDocument();
  });

  it("offers only a status check while a line is awaiting confirmation", () => {
    const draft = setDraft(validDraft(2));
    const base = submissionOf(draft);
    const submission = submissionOf(draft, {
      status: "awaiting-confirmation",
      lines: [
        base.lines[0],
        {
          ...base.lines[1],
          tracking: "awaiting-confirmation",
          status: "unconfirmed",
        },
      ],
    });
    const value = flow({ submission, unresolved: true });
    mocks.submission.mockReturnValue(value);
    renderPage();
    expect(
      screen.getByText("Esperando confirmación del Backend"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reintentar líneas pendientes/i }),
    ).toBeNull();
    expect(screen.getAllByText(/reintento bloqueado/i).length).toBeGreaterThan(
      0,
    );
    fireEvent.click(screen.getByRole("button", { name: /consultar estado/i }));
    expect(value.verifyPending).toHaveBeenCalledTimes(1);
    expect(value.retryPending).not.toHaveBeenCalled();
    expect(value.submit).not.toHaveBeenCalled();
  });

  it("checks an unconfirmed header with the same operation instead of resubmitting", () => {
    const draft = setDraft();
    const submission = submissionOf(draft, {
      salesOrderNumber: null,
      status: "failed",
      headerAmbiguous: true,
      headerTracking: "awaiting-confirmation",
      error: "pendiente",
      lines: submissionOf(draft).lines.map((line) => ({
        ...line,
        tracking: "not-sent",
        status: "pending",
      })),
    });
    const value = flow({ submission, unresolved: true });
    mocks.submission.mockReturnValue(value);
    renderPage();
    expect(
      screen.queryByRole("button", { name: /reintentar encabezado/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /crear pedido real/i }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /consultar estado del encabezado/i }),
    );
    expect(value.verifyPending).toHaveBeenCalledTimes(1);
  });

  it("allows retrying lines only when the backend confirmed the failure", () => {
    const draft = setDraft(validDraft(2));
    const base = submissionOf(draft);
    const submission = submissionOf(draft, {
      status: "partial-failure",
      lines: [
        base.lines[0],
        { ...base.lines[1], tracking: "failed", status: "failed" },
      ],
    });
    const value = flow({ submission });
    mocks.submission.mockReturnValue(value);
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: /reintentar líneas pendientes/i }),
    );
    expect(value.retryPending).toHaveBeenCalledTimes(1);
  });

  it("asks to verify Mis pedidos before a new header request after a confirmed Failed", async () => {
    const draft = setDraft();
    const submission = submissionOf(draft, {
      salesOrderNumber: null,
      status: "failed",
      headerAmbiguous: false,
      headerTracking: "failed",
      error: "falló",
      lines: submissionOf(draft).lines.map((line) => ({
        ...line,
        tracking: "not-sent",
        status: "pending",
      })),
    });
    const value = flow({ submission });
    mocks.submission.mockReturnValue(value);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: /reintentar encabezado/i }),
    );
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("comprobará en el Backend"),
    );
    expect(value.retryPending).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: /reintentar encabezado/i }),
    );
    await waitFor(() => expect(value.retryPending).toHaveBeenCalledTimes(1));
    expect(value.submit).not.toHaveBeenCalled();
  });

  it("disables the commands while one is running", () => {
    const draft = setDraft(validDraft(2));
    const base = submissionOf(draft);
    const submission = submissionOf(draft, {
      status: "partial-failure",
      lines: [
        base.lines[0],
        { ...base.lines[1], tracking: "rejected", status: "failed" },
      ],
    });
    mocks.submission.mockReturnValue(flow({ submission, busy: true }));
    renderPage();
    expect(
      screen.getByRole("button", { name: /reintentar líneas pendientes/i }),
    ).toBeDisabled();
  });
});
