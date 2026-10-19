import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyOperationalContext } from "../../core/session/storage";
import type { OperationalContext } from "../../core/session/types";
import type {
  ExistingOrder,
  OfficialSalesOrderLine,
} from "../../features/orders/orderTypes";

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  mutations: vi.fn(),
  update: vi.fn(),
  cancel: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../app/providers/SessionProvider", () => ({
  useSession: () => ({
    context: {
      ...emptyOperationalContext("detail-test-account"),
      company: {
        id: "CO",
        name: "Company",
        defaultCurrency: "GTQ",
        availableCurrencies: ["GTQ"],
      },
    } satisfies OperationalContext,
  }),
}));
vi.mock("../../features/orders/orderQueries", () => ({
  useOrderDetail: (id: string) => mocks.detail(id),
  useOrderMutations: (id: string) => mocks.mutations(id),
}));
import OrderDetailPage from "./OrderDetailPage";

const order: ExistingOrder = {
  companyId: "CO",
  salesOrderNumber: "OV-9",
  currencyCode: "GTQ",
  createdDate: "",
  deliveryDate: "",
  status: "Orden Abierta",
  customerAccount: "C",
  customerName: "Cliente",
  salesGroup: "V",
  paymentTerms: "",
  creditManagement: "",
  creditStatus: "",
  salesAmount: 10,
  address: "",
  confirmDocumentNumber: "",
  observations: "",
  customerReference: "",
  matchingAgreement: null,
  agreementId: "",
};
const line: OfficialSalesOrderLine = {
  dataAreaId: "CO",
  salesOrderNumber: "OV-9",
  lineNumber: 1,
  inventoryLotId: "LOT",
  itemId: "I",
  itemName: "Item",
  quantity: 1,
  price: 10,
  lineAmount: 10,
  currencyCode: "GTQ",
  salesUnitSymbol: "ea",
  status: "Orden Abierta",
  isBonification: false,
  suppItemGroupId: "",
  matchingAgreementLine: null,
  shippingSiteId: "SITE",
  shippingWarehouseId: "WH",
  configurationId: "",
  colorId: "",
  sizeId: "",
  styleId: "",
  versionId: "",
  lineDiscountPercentage: 0,
};
let client: QueryClient;
const mount = () => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/pedidos/OV-9"]}>
        <Routes>
          <Route
            path="/pedidos/:salesOrderNumber"
            element={<OrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.detail.mockReturnValue({
    header: { isLoading: false, isError: false, data: order, refetch: vi.fn() },
    lines: { isLoading: false, isError: false, data: [line], refetch: vi.fn() },
  });
  mocks.mutations.mockReturnValue({
    update: { mutateAsync: mocks.update, isPending: false },
    cancel: { mutateAsync: mocks.cancel, isPending: false },
    delete: { mutateAsync: mocks.delete, isPending: false },
    confirm: { mutateAsync: vi.fn(), isPending: false },
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("OrderDetailPage direct route", () => {
  it("loads by URL and safely blocks line mutation without InventoryLotId", () => {
    // Keep the line open so the missing identifier is the reason for the block.
    mocks.detail.mockReturnValue({
      header: {
        isLoading: false,
        isError: false,
        data: order,
        refetch: vi.fn(),
      },
      lines: {
        isLoading: false,
        isError: false,
        data: [{ ...line, inventoryLotId: "" }],
        refetch: vi.fn(),
      },
    });
    mount();
    expect(mocks.detail).toHaveBeenCalledWith("OV-9");
    for (const action of ["Editar", "Cancelar", "Eliminar"]) {
      const button = screen.getByRole("button", { name: action + " línea 1" });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("logically blocks double cancellation and confirmation submits", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let releaseCancel!: (value: { success: boolean }) => void;
    let releaseConfirm!: (value: {
      success: boolean;
      confirmed: boolean;
    }) => void;
    const cancel = vi.fn(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          releaseCancel = resolve;
        }),
    );
    const confirm = vi.fn(
      () =>
        new Promise<{ success: boolean; confirmed: boolean }>((resolve) => {
          releaseConfirm = resolve;
        }),
    );
    mocks.mutations.mockReturnValue({
      update: { mutateAsync: vi.fn(), isPending: false },
      cancel: { mutateAsync: cancel, isPending: false },
      delete: { mutateAsync: vi.fn(), isPending: false },
      confirm: { mutateAsync: confirm, isPending: false },
    });
    mount();
    const cancelButton = screen.getByRole("button", {
      name: "Cancelar línea 1",
    });
    fireEvent.click(cancelButton);
    fireEvent.click(cancelButton);
    const confirmButton = screen.getByRole("button", {
      name: "Confirmar pedido",
    });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    expect(cancel).toHaveBeenCalledExactlyOnceWith({
      companyId: "CO",
      inventoryLotId: "LOT",
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(window.confirm).toHaveBeenCalledTimes(2);
    await act(async () => {
      releaseCancel({ success: true });
      releaseConfirm({ success: true, confirmed: true });
    });
    expect(screen.getByText("Pedido confirmado.")).toBeInTheDocument();
  });
});
