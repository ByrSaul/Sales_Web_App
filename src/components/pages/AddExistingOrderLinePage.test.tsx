import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../core/api/errors";
import { emptyOperationalContext } from "../../core/session/storage";
import type { OperationalContext } from "../../core/session/types";
import type {
  InventoryItem,
  Product,
  ProductVariant,
  PromotionGroup,
} from "../../features/catalogs/types";
import type { OrderAttachment } from "../../features/attachments/attachmentTypes";
import type { OrderDraftLine } from "../../features/orderDraft/types";
import type { ExistingOrder } from "../../features/orders/orderTypes";
import { mapOrder } from "../../features/orders/orderMappers";
import { validDraft } from "../../features/orders/testFixtures";
import AddExistingOrderLinePage from "./AddExistingOrderLinePage";

type Header = {
  data?: ExistingOrder;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
};
type CatalogQuery<T> = {
  data?: { items: T[] };
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
};
type ProductQuery = {
  items: Product[];
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  hasNextPage: boolean;
  refetch: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
};
type StoredLine = OrderDraftLine & {
  idempotencyKey?: string;
  submissionStatus: "pending" | "submitting" | "failed" | "ambiguous";
  submissionError: string | null;
};
const mocks = vi.hoisted(() => ({
  session: vi.fn<() => OperationalContext>(),
  header: vi.fn<(id: string) => Header>(),
  products: vi.fn<(search: string) => ProductQuery>(),
  variants: vi.fn(),
  inventory: vi.fn(),
  refs: vi.fn(),
  post: vi.fn<
    (
      path: string,
      body?: unknown,
      options?: {
        headers?: Record<string, string>;
        timeoutMs?: number;
        signal?: AbortSignal;
      },
    ) => Promise<unknown>
  >(),
  get: vi.fn<(path: string) => Promise<unknown>>(),
  line: vi.fn<(body: unknown, key: string | undefined) => Promise<unknown>>(),
  payment:
    vi.fn<
      () => {
        data: OrderAttachment[];
        refetch: () => Promise<{ data: OrderAttachment[] }>;
      }
    >(),
  refetch: vi.fn<() => Promise<void>>(),
  more: vi.fn<() => Promise<void>>(),
  paymentRefetch: vi.fn<() => Promise<{ data: OrderAttachment[] }>>(),
}));
vi.mock("../../app/providers/SessionProvider", () => ({
  useSession: () => ({
    context: mocks.session(),
    api: { post: mocks.post, get: mocks.get },
  }),
}));
vi.mock("../../features/orders/orderQueries", async (original) => ({
  ...(await original<typeof import("../../features/orders/orderQueries")>()),
  useOrderDetail: (id: string) => ({
    header: mocks.header(id),
    lines: { data: [] },
  }),
}));
vi.mock("../../features/catalogs/hooks", () => ({
  useInfiniteProducts: (search: string) => mocks.products(search),
  useVariants: (...args: unknown[]) => mocks.variants(...args),
  useInventory: (...args: unknown[]) => mocks.inventory(...args),
  useReferenceCatalogs: (...args: unknown[]) => mocks.refs(...args),
}));
vi.mock("../../features/attachments/attachmentQueries", () => ({
  useOrderAttachments: () => mocks.payment(),
}));

const storageKey = "sales4app.existingOrderPendingLines.v1:A1:CO:OV-99";
const product: Product = {
  itemId: "I1",
  name: "Producto",
  productType: "Item",
  dimensionGroup: "",
  requiresVariant: false,
};
const variant: ProductVariant = {
  itemId: "I1",
  displayProductNumber: "VAR-1",
  name: "Presentación",
  dimensionGroup: "",
  configId: "CFG",
  colorId: "",
  sizeId: "",
  styleId: "",
  versionId: "",
};
const stock: InventoryItem = {
  companyId: "CO",
  itemId: "I1",
  displayProductNumber: "",
  productName: "Producto",
  itemGroupId: "",
  activeIngredientId: "",
  siteId: "S1",
  warehouseId: "W1",
  physical: 20,
  availablePhysical: 10,
  onOrder: 0,
  reservedOrdered: 0,
  ordered: 0,
  availableOrdered: 0,
  totalAvailable: 10,
  configId: "",
  colorId: "",
  sizeId: "",
  styleId: "",
  versionId: "",
};
const promotion: PromotionGroup = {
  companyId: "CO",
  groupId: "BONUS",
  name: "Promo",
  recId: 1,
  forecastDiscount: 50,
};
const payment: OrderAttachment = {
  companyId: "CO",
  salesOrderNumber: "OV-99",
  documentId: "PAY",
  fileName: "payment",
  fileType: "png",
  description: "pago",
  attachmentType: "Imagen",
  contentBase64: "eA==",
};
let context: OperationalContext;
let header: Header;
let products: ProductQuery;
let inventory: CatalogQuery<InventoryItem>;
let variants: CatalogQuery<ProductVariant>;
let promotions: PromotionGroup[];
let client: QueryClient;
const seed = (lines: StoredLine[]) =>
  sessionStorage.setItem(storageKey, JSON.stringify(lines));
const pending = (
  index = 0,
  overrides: Partial<StoredLine> = {},
): StoredLine => ({
  ...validDraft(index + 1).lines[index],
  idempotencyKey: crypto.randomUUID(),
  submissionStatus: "pending",
  submissionError: null,
  ...overrides,
});
const saved = (): StoredLine[] =>
  JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
const field = (label: string): HTMLInputElement | HTMLSelectElement => {
  const input = screen
    .getByText(label, { selector: "label" })
    .parentElement?.querySelector("input,select");
  if (
    !(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)
  )
    throw new Error("Missing field " + label);
  return input;
};
const change = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const mount = () => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/pedidos/OV-99/lineas/nueva"]}>
        <Routes>
          <Route
            path="/pedidos/:salesOrderNumber/lineas/nueva"
            element={<AddExistingOrderLinePage />}
          />
          <Route
            path="/pedidos/:salesOrderNumber"
            element={<p>Order detail destination</p>}
          />
          <Route
            path="/pedidos/:salesOrderNumber/adjuntos"
            element={<p>Payment attachment destination</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const chooseProduct = async () => {
  change("Buscar producto", "I1");
  fireEvent.click(
    await screen.findByRole(
      "button",
      { name: /I1.*Producto/ },
      { timeout: 2500 },
    ),
  );
};
const prepare = async () => {
  await chooseProduct();
  await waitFor(() => expect(field("Precio (GTQ)")).toHaveValue(25));
  fireEvent.click(screen.getByRole("button", { name: /S1.*W1/ }));
};
const send = () =>
  fireEvent.click(screen.getByRole("button", { name: /^Enviar \d+ línea/ }));
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  const draft = validDraft();
  context = {
    ...emptyOperationalContext("A1"),
    company: {
      id: "CO",
      name: "Company",
      defaultCurrency: "GTQ",
      availableCurrencies: ["GTQ"],
    },
    vendor: { id: "V1", name: "Vendor", companyId: "CO" },
    user: {
      id: "U1",
      name: "User",
      language: "es",
      networkAlias: "",
      personnelnumber: "P1",
    },
  };
  header = {
    data: mapOrder({
      dataareaid: "CO",
      salesid: "OV-99",
      currencycode: "GTQ",
      salesstatus: "Orden Abierta",
      custaccount: draft.customer!.account,
      countryregionid: "GTM",
    }),
    isLoading: false,
    isError: false,
    refetch: mocks.refetch,
  };
  products = {
    items: [product],
    isFetching: false,
    isFetchingNextPage: false,
    isError: false,
    hasNextPage: false,
    refetch: mocks.refetch,
    fetchNextPage: mocks.more,
  };
  inventory = {
    data: { items: [stock] },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: mocks.refetch,
  };
  variants = {
    data: { items: [variant] },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: mocks.refetch,
  };
  promotions = [promotion];
  mocks.session.mockImplementation(() => context);
  mocks.header.mockImplementation(() => header);
  mocks.products.mockImplementation(() => products);
  mocks.inventory.mockImplementation(() => inventory);
  mocks.variants.mockImplementation(() => variants);
  mocks.refs.mockImplementation(() => ({ promotions: { data: promotions } }));
  mocks.refetch.mockResolvedValue(undefined);
  mocks.more.mockResolvedValue(undefined);
  mocks.paymentRefetch.mockResolvedValue({ data: [payment] });
  mocks.payment.mockReturnValue({
    data: [payment],
    refetch: mocks.paymentRefetch,
  });
  mocks.line.mockResolvedValue([{ LineNumber: 1 }]);
  mocks.post.mockImplementation(async (path, body, options) => {
    if (path === "/d365_services/get_price")
      return { Success: true, Price: 25, PriceUnit: 1, Currencycode: "GTQ" };
    if (path === "/d365/sales/line" || path === "/d365/sales/line/agreement")
      return mocks.line(body, options?.headers?.["Idempotency-Key"]);
    throw new Error("Unexpected POST: " + path);
  });
  mocks.get.mockResolvedValue({
    status: "Failed",
    dynamicsEffect: "NONE",
    newRequestAllowed: true,
  });
});
afterEach(() => {
  cleanup();
  client?.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("AddExistingOrderLinePage guards and local selection", () => {
  it("returns from the missing-payment guard without sending or discarding the persisted queue", () => {
    header.data!.customerAccount = "MOST-000001";
    mocks.payment.mockReturnValue({ data: [], refetch: mocks.paymentRefetch });
    const line = pending();
    seed([line]);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Volver al pedido" }));
    expect(screen.getByText("Order detail destination")).toBeInTheDocument();
    expect(saved()[0].idempotencyKey).toBe(line.idempotencyKey);
    expect(mocks.line).not.toHaveBeenCalled();
  });
  it.each([
    ["loading", "Cargando pedido..."],
    ["error", "No se pudo cargar el encabezado."],
    ["missing", "Pedido no encontrado"],
  ])(
    "handles a %s header without enabling line creation",
    async (state, expected) => {
      header.isLoading = state === "loading";
      header.isError = state === "error";
      if (state === "missing") header.data = undefined;
      mount();
      expect(screen.getByText(expected)).toBeInTheDocument();
      if (state === "error") {
        await act(async () =>
          fireEvent.click(
            screen.getByRole("button", { name: "Intentar nuevamente" }),
          ),
        );
        expect(mocks.refetch).toHaveBeenCalledTimes(1);
      }
      expect(mocks.line).not.toHaveBeenCalled();
    },
  );
  it("blocks a closed order and allows returning to its detail", () => {
    header.data!.status = "Invoiced";
    mount();
    expect(
      screen.getByText("No es posible agregar líneas"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← Volver al pedido" }));
    expect(screen.getByText("Order detail destination")).toBeInTheDocument();
  });
  it("blocks a cash-customer order without an image payment and links to attachments", () => {
    header.data!.customerAccount = "MOST-000001";
    mocks.payment.mockReturnValue({ data: [], refetch: mocks.paymentRefetch });
    mount();
    expect(
      screen.getByText("Comprobante de pago requerido"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar comprobante" }),
    );
    expect(
      screen.getByText("Payment attachment destination"),
    ).toBeInTheDocument();
    expect(mocks.line).not.toHaveBeenCalled();
  });
  it("validates quantity/price and adds a local selection without sending anything", async () => {
    mount();
    expect(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    ).toBeDisabled();
    await prepare();
    change("Cantidad", "0");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "La cantidad debe ser mayor que cero.",
    );
    expect(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    ).toBeDisabled();
    change("Cantidad", "2");
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    );
    expect(saved()).toHaveLength(1);
    expect(saved()[0]).toMatchObject({
      quantity: 2,
      price: 25,
      siteId: "S1",
      warehouseId: "W1",
      submissionStatus: "pending",
    });
    expect(saved()[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.line).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Línea agregada a pendientes. Todavía no se envió al Backend.",
      ),
    ).toBeInTheDocument();
  });
  it("creates a linked bonus locally and removes it together with the original", async () => {
    mount();
    await prepare();
    change("Cantidad", "4");
    change("Promoción vinculada (opcional)", "BONUS");
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    );
    expect(saved()).toHaveLength(2);
    expect(saved()[1]).toMatchObject({
      isBonification: true,
      quantity: 2,
      price: 0,
    });
    expect(saved()[0].parentLineId).toBe(saved()[1].parentLineId);
    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0]);
    expect(saved()).toHaveLength(0);
  });
  it("supports independent bonuses without a price or promotion", async () => {
    mount();
    await prepare();
    fireEvent.click(
      screen.getByRole("switch", { name: "Bonificación independiente" }),
    );
    expect(
      screen.queryByText("Promoción vinculada (opcional)"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    );
    expect(saved()[0]).toMatchObject({
      isBonification: true,
      price: 0,
      promotion: null,
    });
  });
  it("edits and cancels a local pending selection without a server mutation", async () => {
    seed([pending()]);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    await waitFor(() => expect(field("Precio (GTQ)")).toHaveValue(25));
    change("Cantidad", "3");
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar cambios locales" }),
    );
    expect(saved()).toHaveLength(1);
    expect(saved()[0].quantity).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar edición" }));
    expect(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    ).toBeDisabled();
    expect(mocks.line).not.toHaveBeenCalled();
  });
  it("restores variant/linked promotion information when editing a pending line", async () => {
    const original = pending(0, {
      presentationCode: "VAR-1",
      presentationName: null,
      parentLineId: "relation",
    });
    const bonus = pending(1, {
      parentLineId: "relation",
      isBonification: true,
      promotion,
      price: 0,
    });
    seed([original, bonus]);
    mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    expect(field("Variante obligatoria")).toHaveValue("VAR-1");
    expect(field("Promoción vinculada (opcional)")).toHaveValue("BONUS");
    await screen.findByText(/PriceUnit/);
    expect(screen.getAllByText("Editando localmente")).toHaveLength(1);
  });
  it("asks before leaving unsent lines and installs/removes the unload warning", () => {
    seed([pending()]);
    vi.spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    mount();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Volver al detalle" }));
    expect(
      screen.queryByText("Order detail destination"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver al detalle" }));
    expect(screen.getByText("Order detail destination")).toBeInTheDocument();
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
  it("ignores corrupt recovery data and allows leaving an empty queue without confirmation", () => {
    sessionStorage.setItem(storageKey, "{broken");
    const confirm = vi.spyOn(window, "confirm");
    mount();
    expect(screen.getByText("No hay líneas pendientes.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver al detalle" }));
    expect(confirm).not.toHaveBeenCalled();
  });
  it("shows inventory loading/error/empty states and retries only the query", async () => {
    inventory.isLoading = true;
    inventory.isError = true;
    inventory.data = { items: [] };
    mount();
    expect(screen.getByText("Consultando inventario...")).toBeInTheDocument();
    expect(
      screen.getByText("Sin inventario para la selección."),
    ).toBeInTheDocument();
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Intentar nuevamente" }),
      ),
    );
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.line).not.toHaveBeenCalled();
  });
  it.each([
    ["loading", "Buscando productos..."],
    ["error", "No fue posible consultar productos."],
    ["empty", "No se encontraron productos."],
  ])(
    "shows the product search %s state after applying the search",
    async (state, expected) => {
      products.items = [];
      products.isFetching = state === "loading";
      products.isError = state === "error";
      mount();
      change("Buscar producto", "I1");
      await screen.findByText(expected, {}, { timeout: 2500 });
      if (state === "error") {
        await act(async () =>
          fireEvent.click(screen.getByRole("button", { name: "Reintentar" })),
        );
        expect(mocks.refetch).toHaveBeenCalledTimes(1);
      }
      expect(mocks.line).not.toHaveBeenCalled();
    },
  );
  it("loads another page of products and suppresses the initial loader during pagination", async () => {
    products.hasNextPage = true;
    products.isFetching = true;
    products.isFetchingNextPage = true;
    mount();
    change("Buscar producto", "I1");
    const button = await screen.findByRole(
      "button",
      { name: /Cargar más productos/ },
      { timeout: 2500 },
    );
    expect(button).toBeDisabled();
    expect(screen.queryByText("Buscando productos...")).not.toBeInTheDocument();
    products.isFetchingNextPage = false;
    // A user changes the search; the subsequent render reflects the settled hook state.
    change("Buscar producto", "I1 ");
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: /Cargar más productos/ }),
      ),
    );
    expect(mocks.more).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])(
    "enables force-registration only with a delivery country (%s)",
    async (hasCountry) => {
      products.items = [
        { ...product, productType: "MasterProduct", requiresVariant: true },
      ];
      header.data!.deliveryCountryRegionId = hasCountry ? "GTM" : "";
      variants.isLoading = true;
      variants.isFetching = true;
      mount();
      await chooseProduct();
      const toggle = screen.getByRole("switch", { name: "Forzar registro" });
      expect(screen.getByText("Buscando variantes...")).toBeInTheDocument();
      if (hasCountry) {
        expect(toggle).toBeEnabled();
        fireEvent.click(toggle);
        expect(mocks.variants).toHaveBeenLastCalledWith(
          expect.objectContaining({ itemId: "I1" }),
          { forceRegistry: true, regionId: "GTM" },
        );
      } else {
        expect(toggle).toBeDisabled();
        expect(
          screen.getByText(
            /El encabezado del pedido no contiene el CountryRegionId/,
          ),
        ).toBeInTheDocument();
      }
    },
  );
  it("requires a variant, prices its dimensions, clears stock on variant changes and resets the selection when searching again", async () => {
    products.items = [
      { ...product, productType: "MasterProduct", requiresVariant: true },
    ];
    mount();
    await chooseProduct();
    fireEvent.click(screen.getByRole("button", { name: /S1.*W1/ }));
    expect(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    ).toBeDisabled();
    change("Variante obligatoria", "VAR-1");
    await waitFor(() => expect(field("Precio (GTQ)")).toHaveValue(25));
    expect(mocks.post).toHaveBeenCalledWith(
      "/d365_services/get_price",
      expect.objectContaining({ ConfigId: "CFG", ItemId: "I1", Company: "CO" }),
      expect.anything(),
    );
    expect(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /S1.*W1/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    );
    expect(saved()[0]).toMatchObject({
      presentationCode: "VAR-1",
      dimensions: { configId: "CFG" },
    });
    await chooseProduct();
    change("Variante obligatoria", "");
    expect(field("Variante obligatoria")).toHaveValue("");
    change("Buscar producto", "new");
    expect(screen.queryByText("Variante obligatoria")).not.toBeInTheDocument();
  });
  it("allows a manual price only with the nested price-edit permission and validates zero", async () => {
    context.permissions = [
      {
        menu: "Create Sales Orders",
        company: "CO",
        permissionLevel: "",
        children: [
          {
            menu: "Price Sales Line",
            company: "CO",
            permissionLevel: "Editar",
            children: [],
          },
        ],
      },
    ];
    mount();
    await prepare();
    expect(field("Precio (GTQ)")).toBeEnabled();
    change("Precio (GTQ)", "0");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El precio debe ser mayor que cero.",
    );
    change("Precio (GTQ)", "19.5");
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    );
    expect(saved()[0].price).toBe(19.5);
  });
  it("shows a price warning and handles query failure without creating a line", async () => {
    mocks.post.mockResolvedValueOnce({
      Success: false,
      Price: 0,
      Currencycode: "GTQ",
      DebugMessage: "No price for this customer",
    });
    mount();
    await chooseProduct();
    await screen.findByText("No price for this customer");
    expect(field("Precio (GTQ)")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Agregar a pendientes" }),
    ).toBeDisabled();
    mocks.post.mockRejectedValueOnce(new Error("pricing unavailable"));
    await act(async () => {
      await client.invalidateQueries();
    });
    await screen.findByText("Error al consultar precio.");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" })),
    );
    await waitFor(() => expect(field("Precio (GTQ)")).toHaveValue(25));
    expect(mocks.line).not.toHaveBeenCalled();
  });
  it("supports missing optional catalog data and session vendor/user while rendering restored tracking", async () => {
    context.user = null;
    context.vendor = null;
    inventory.data = undefined;
    variants.data = undefined;
    mocks.refs.mockReturnValue({ promotions: { data: undefined } });
    seed([pending(0, { isBonification: true, price: 0, parentLineId: null })]);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(
      screen.getByRole("switch", { name: "Bonificación independiente" }),
    ).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(mocks.post).toHaveBeenCalled());
    expect(
      screen.getByText("Precio: 0 (bonificación independiente)"),
    ).toBeInTheDocument();
  });
});

describe("AddExistingOrderLinePage idempotent submission", () => {
  it("handles a failed payment lookup, releases the lock and waits for another explicit click", async () => {
    header.data!.customerAccount = "MOST-000001";
    seed([pending()]);
    mocks.paymentRefetch.mockRejectedValueOnce(
      new ApiError("network", "offline"),
    );
    mount();
    send();
    await screen.findByText(
      "Se perdió la conexión; es necesario verificar Dynamics.",
    );
    expect(mocks.line).not.toHaveBeenCalled();
    expect(saved()[0].submissionStatus).toBe("pending");
    expect(mocks.paymentRefetch).toHaveBeenCalledTimes(1);
    send();
    await screen.findByText("Order detail destination");
    expect(mocks.paymentRefetch).toHaveBeenCalledTimes(2);
    expect(mocks.line).toHaveBeenCalledTimes(1);
  });

  it("retains an ambiguous line and its identity when verification itself times out", async () => {
    const original = pending(0, { submissionStatus: "ambiguous" });
    seed([original]);
    mocks.line.mockRejectedValueOnce(new ApiError("network", "offline"));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    await screen.findByText(
      "0 creada(s); 1 pendiente(s). Las exitosas no se reenviarán.",
    );
    expect(saved()[0]).toMatchObject({
      submissionStatus: "ambiguous",
      idempotencyKey: original.idempotencyKey,
    });
    expect(mocks.line).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Enviar 1 línea" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    await screen.findByText("Order detail destination");
    expect(mocks.line.mock.calls[0]).toEqual(mocks.line.mock.calls[1]);
  });
  it("sends sequentially with persisted identities and blocks double submission", async () => {
    const first = pending();
    const second = pending(1);
    seed([first, second]);
    let release!: (value: unknown) => void;
    mocks.line.mockImplementationOnce(() => {
      expect(saved()[0].submissionStatus).toBe("submitting");
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    mount();
    const button = screen.getByRole("button", { name: "Enviar 2 líneas" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.line).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Enviando...")).toBeInTheDocument();
    await act(async () => release([{ LineNumber: 1 }]));
    await screen.findByText("Order detail destination");
    expect(mocks.line).toHaveBeenCalledTimes(2);
    expect(mocks.line.mock.calls.map((call) => call[1])).toEqual([
      first.idempotencyKey,
      second.idempotencyKey,
    ]);
    expect(mocks.post).toHaveBeenCalledWith(
      "/d365/sales/line",
      expect.objectContaining({
        dataAreaId: "CO",
        SalesOrderNumber: "OV-99",
        ItemNumber: first.itemId,
      }),
      {
        timeoutMs: 60_000,
        headers: { "Idempotency-Key": first.idempotencyKey },
      },
    );
    expect(saved()).toEqual([]);
    expect(mocks.post.mock.calls.some(([path]) => path === "/d365/sales")).toBe(
      false,
    );
  });
  it("preserves the key on timeout, stops dependent lines and resumes only after replay confirms completion", async () => {
    const first = pending();
    const second = pending(1);
    seed([first, second]);
    mocks.line.mockRejectedValueOnce(new ApiError("timeout", "timeout"));
    mount();
    send();
    await screen.findByText("Esperando confirmación · reintento bloqueado");
    expect(saved()[0]).toMatchObject({
      submissionStatus: "ambiguous",
      idempotencyKey: first.idempotencyKey,
    });
    expect(saved()[1].submissionStatus).toBe("pending");
    expect(mocks.line).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Enviar 2 líneas" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    await screen.findByText("Order detail destination");
    expect(mocks.line.mock.calls.map((call) => call[1])).toEqual([
      first.idempotencyKey,
      first.idempotencyKey,
      second.idempotencyKey,
    ]);
    expect(mocks.line.mock.calls[0][0]).toEqual(mocks.line.mock.calls[1][0]);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("restores submitting as ambiguous without sending automatically or generating another key", async () => {
    const line = pending(0, { submissionStatus: "submitting" });
    seed([line]);
    mount();
    expect(
      screen.getByText("Esperando confirmación · reintento bloqueado"),
    ).toBeInTheDocument();
    expect(mocks.line).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    await screen.findByText("Order detail destination");
    expect(mocks.line.mock.calls[0][1]).toBe(line.idempotencyKey);
  });
  it("assigns a UUID to a legacy line but does not submit it on mount", () => {
    const line = pending();
    delete line.idempotencyKey;
    seed([line]);
    mount();
    expect(saved()[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.line).not.toHaveBeenCalled();
  });
  it("keeps Processing blocked when the user queries again", async () => {
    const line = pending(0, { submissionStatus: "ambiguous" });
    seed([line]);
    mocks.line.mockRejectedValue(
      new ApiError("backend", "conflict", 409, {
        detail: "La petición ya se encuentra en procesamiento.",
      }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    await screen.findByText(
      /El Backend confirma que la operación sigue en procesamiento/,
    );
    expect(saved()[0].idempotencyKey).toBe(line.idempotencyKey);
    expect(mocks.line).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Enviar 1 línea" }),
    ).toBeDisabled();
  });
  it.each(["blocked", "created", "safe"])(
    "requires read-only backend evidence before another key (%s)",
    async (decision) => {
      const line = pending(0, { submissionStatus: "failed" });
      seed([line]);
      mocks.get.mockResolvedValue(
        decision === "blocked"
          ? {
              status: "Processing",
              dynamicsEffect: "UNKNOWN",
              newRequestAllowed: false,
            }
          : {
              status: "Failed",
              dynamicsEffect: decision === "created" ? "CREATED" : "NONE",
              newRequestAllowed: decision === "safe",
              lineReference: "LOT",
            },
      );
      mount();
      expect(
        screen.queryByRole("button", { name: "Editar" }),
      ).not.toBeInTheDocument();
      send();
      await waitFor(() =>
        expect(mocks.get).toHaveBeenCalledWith(
          "/d365/idempotency/" + line.idempotencyKey + "?dataAreaId=CO",
        ),
      );
      if (decision === "blocked") {
        await screen.findByText(/El Backend no ha confirmado/);
        expect(saved()[0].idempotencyKey).toBe(line.idempotencyKey);
        expect(mocks.line).not.toHaveBeenCalled();
      } else {
        await screen.findByText("Order detail destination");
        if (decision === "created") expect(mocks.line).not.toHaveBeenCalled();
        else {
          expect(mocks.line).toHaveBeenCalledTimes(1);
          expect(mocks.line.mock.calls[0][1]).not.toBe(line.idempotencyKey);
        }
      }
    },
  );
  it("preserves a rejected line as failed and allows deleting its local tracking", async () => {
    seed([pending()]);
    mocks.line.mockRejectedValueOnce(new ApiError("backend", "invalid", 422));
    mount();
    send();
    await screen.findByText(/El Backend rechazó la operación/);
    expect(saved()[0].submissionStatus).toBe("failed");
    expect(
      screen.queryByRole("button", { name: "Editar" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(saved()).toEqual([]);
  });
  it("uses the agreement endpoint and retains its reference instead of sending a normal line", async () => {
    seed([pending(0, { source: "agreement", matchingAgreementLine: 42 })]);
    mount();
    send();
    await screen.findByText("Order detail destination");
    expect(mocks.post).toHaveBeenCalledWith(
      "/d365/sales/line/agreement",
      expect.objectContaining({
        MatchingAgreementLine: 42,
        ChangeShippingWarehouseId: "",
        SalesOrderNumber: "OV-99",
      }),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(
      mocks.post.mock.calls.some(([path]) => path === "/d365/sales/line"),
    ).toBe(false);
  });
  it("checks payment again before creating lines and prevents a double click during that check", async () => {
    header.data!.customerAccount = "MOST-000001";
    seed([pending()]);
    let release!: (value: { data: OrderAttachment[] }) => void;
    mocks.paymentRefetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    mount();
    const button = screen.getByRole("button", { name: "Enviar 1 línea" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.paymentRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.line).not.toHaveBeenCalled();
    await act(async () => release({ data: [] }));
    expect(
      screen.getByText(/No se realizó ningún POST de línea/),
    ).toBeInTheDocument();
    expect(mocks.line).not.toHaveBeenCalled();
    send();
    await screen.findByText("Order detail destination");
    expect(mocks.line).toHaveBeenCalledTimes(1);
  });
});
