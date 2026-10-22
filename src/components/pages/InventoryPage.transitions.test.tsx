import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InventoryPage from "./InventoryPage";

const session = vi.hoisted(() => ({ company: "CO", post: vi.fn() }));
const api = { post: session.post };
vi.mock("../../app/providers/SessionProvider", () => ({
  useSession: () => ({
    api,
    context: { company: { id: session.company }, vendor: { id: "V1" } },
  }),
}));

const productId = "LQ-000037";
const firstVariant = "LQ-000037-02";
const secondVariant = "LQ-000037-04";
const metadata = {
  CurrentPage: 1,
  PerPage: 10,
  TotalRecords: 1,
  TotalPages: 1,
};
const products = [
  { itemid: productId, name: "DIAZINON 60 EC", producttype: "MasterProduct" },
  { itemid: "SIMPLE", name: "Producto simple", producttype: "Item" },
];
const variants = [firstVariant, secondVariant].map((displayproductnumber) => ({
  itemid: productId,
  displayproductnumber,
  name: displayproductnumber,
  configid: "G-S",
  inventsizeid: "1 LT",
}));
const response = (
  variant: string,
  company = "CO",
  page = 1,
  totalPages = 1,
) => ({
  inventory: [
    {
      dataareaid: company,
      itemid: productId,
      displayproductnumber: variant,
      productname: "Existencia " + variant,
      inventsiteid: "S-" + company,
      inventlocationid: "W-" + page,
      physicalinvent: 25,
      totalavailable: 20,
    },
  ],
  pagination: { ...metadata, CurrentPage: page, TotalPages: totalPages },
});
const deferred = () => {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
type Pending = ReturnType<typeof deferred>;
const plans = new Map<string, Pending>();
const key = (variant: string, page = 1, company = "CO") =>
  `${company}:${variant}:${page}`;
const plan = (variant: string, page = 1, company = "CO") => {
  const pending = deferred();
  plans.set(key(variant, page, company), pending);
  return pending;
};
const inventoryCalls = () =>
  session.post.mock.calls.filter(
    ([path]) => path === "/inventory" || path === "/inventory/variant",
  );
const loadedRow = (variant: string) =>
  screen.findByText(variant, { selector: "strong" });
const chooseProduct = async (value = productId) => {
  await screen.findByRole("option", { name: /DIAZINON 60 EC/ });
  fireEvent.change(screen.getByLabelText("Producto"), { target: { value } });
};
const chooseVariant = async (value = firstVariant) => {
  await screen.findByRole("option", { name: new RegExp(value) });
  fireEvent.change(screen.getByLabelText("Variante obligatoria"), {
    target: { value },
  });
};
let client: QueryClient;
const tree = () => (
  <QueryClientProvider client={client}>
    <InventoryPage />
  </QueryClientProvider>
);
const mount = () => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60_000, gcTime: Infinity },
    },
  });
  return render(tree());
};
const settle = async (pending: Pending, value: unknown) => {
  await act(async () => {
    pending.resolve(value);
  });
};
const expectLoadingWithoutRows = () => {
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("Consultando inventario...")).toBeInTheDocument();
  const loading = screen.getByRole("region", {
    name: "Estado de la consulta de inventario",
  });
  expect(loading).toHaveAttribute("aria-busy", "true");
  expect(loading).toHaveAttribute("aria-live", "polite");
  expect(
    screen.queryByText("Sin inventario disponible"),
  ).not.toBeInTheDocument();
};

beforeEach(() => {
  session.company = "CO";
  session.post.mockReset();
  plans.clear();
  session.post.mockImplementation(
    (path: string, body: Record<string, unknown>) => {
      if (path === "/company/products")
        return Promise.resolve({ products, pagination: metadata });
      if (path === "/company/products/variants")
        return Promise.resolve({ variants, pagination: metadata });
      const page = (body.pagination as { page: number }).page;
      const pending = plans.get(
        key(
          String(body.variantproduct ?? body.itemid),
          page,
          String(body.company),
        ),
      );
      if (!pending) throw new Error("Unplanned inventory request: " + path);
      return pending.promise;
    },
  );
});
afterEach(() => {
  cleanup();
  client?.clear();
  vi.restoreAllMocks();
});

describe("InventoryPage with real React Query hooks and deferred HTTP responses", () => {
  it("waits for a required variant and shows the first query loading state without empty results", async () => {
    const first = plan(firstVariant);
    mount();
    await chooseProduct();
    expect(screen.getByText("Selecciona una variante")).toBeInTheDocument();
    expect(inventoryCalls()).toHaveLength(0);
    await chooseVariant();
    expectLoadingWithoutRows();
    await settle(first, response(firstVariant));
    await loadedRow(firstVariant);
    expect(screen.getByText("S-CO")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("immediately hides -02 while -04 remains pending, then shows only -04", async () => {
    const first = plan(firstVariant);
    const second = plan(secondVariant);
    mount();
    await chooseProduct();
    await chooseVariant();
    await settle(first, response(firstVariant));
    await loadedRow(firstVariant);
    await chooseVariant(secondVariant);
    expectLoadingWithoutRows();
    expect(
      screen.queryByText(firstVariant, { selector: "strong" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Producto")).toHaveValue(productId);
    expect(screen.getByLabelText("Variante obligatoria")).toHaveValue(
      secondVariant,
    );
    await settle(second, response(secondVariant));
    await loadedRow(secondVariant);
    expect(
      screen.queryByText(firstVariant, { selector: "strong" }),
    ).not.toBeInTheDocument();
    expect(inventoryCalls()).toHaveLength(2);
  });

  it("resets the variant and pagination on product change and hides the old table before the next response", async () => {
    const first = plan(firstVariant);
    const pageTwo = plan(firstVariant, 2);
    const simple = plan("SIMPLE");
    mount();
    await chooseProduct();
    await chooseVariant();
    await settle(first, response(firstVariant, "CO", 1, 2));
    await loadedRow(firstVariant);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await settle(pageTwo, response(firstVariant, "CO", 2, 2));
    await screen.findByText("W-2");
    await chooseProduct("SIMPLE");
    expectLoadingWithoutRows();
    expect(
      screen.queryByLabelText("Variante obligatoria"),
    ).not.toBeInTheDocument();
    await settle(simple, response("SIMPLE"));
    await loadedRow("SIMPLE");
    expect(inventoryCalls().slice(-1)[0]?.[1]).toMatchObject({
      itemid: "SIMPLE",
      pagination: { page: 1, perpage: 10 },
    });
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await chooseProduct();
    expect(screen.getByLabelText("Variante obligatoria")).toHaveValue("");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("resets to the first page for a new variant and never shows the previous page while fetching", async () => {
    const first = plan(firstVariant);
    const pageTwo = plan(firstVariant, 2);
    const second = plan(secondVariant);
    mount();
    await chooseProduct();
    await chooseVariant();
    await settle(first, response(firstVariant, "CO", 1, 2));
    await loadedRow(firstVariant);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expectLoadingWithoutRows();
    await settle(pageTwo, response(firstVariant, "CO", 2, 2));
    await screen.findByText("W-2");
    await chooseVariant(secondVariant);
    expectLoadingWithoutRows();
    await settle(second, response(secondVariant));
    await loadedRow(secondVariant);
    expect(inventoryCalls().slice(-1)[0]?.[1]).toMatchObject({
      variantproduct: secondVariant,
      pagination: { page: 1, perpage: 10 },
    });
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  it("shows an empty result only after the selected variant finishes", async () => {
    const first = plan(firstVariant);
    const second = plan(secondVariant);
    mount();
    await chooseProduct();
    await chooseVariant();
    await settle(first, response(firstVariant));
    await loadedRow(firstVariant);
    await chooseVariant(secondVariant);
    expectLoadingWithoutRows();
    await settle(second, { inventory: [], pagination: metadata });
    await screen.findByText("Sin inventario disponible");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("never restores previous rows after an endpoint failure and retries only the current selection", async () => {
    const first = plan(firstVariant);
    const second = plan(secondVariant);
    mount();
    await chooseProduct();
    await chooseVariant();
    await settle(first, response(firstVariant));
    await loadedRow(firstVariant);
    await chooseVariant(secondVariant);
    await act(async () => {
      second.reject(new Error("offline"));
    });
    await screen.findByText("No fue posible consultar el inventario.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(inventoryCalls()).toHaveLength(2);
    const retry = plan(secondVariant);
    fireEvent.click(
      screen.getByRole("button", { name: "Intentar nuevamente" }),
    );
    await waitFor(expectLoadingWithoutRows);
    await settle(retry, response(secondVariant));
    await loadedRow(secondVariant);
    expect(inventoryCalls()).toHaveLength(3);
    expect(inventoryCalls().slice(-1)[0]?.[1].variantproduct).toBe(
      secondVariant,
    );
  });

  it("clears a previous error immediately when selecting a different product", async () => {
    const first = plan(firstVariant);
    const simple = plan("SIMPLE");
    mount();
    await chooseProduct();
    await chooseVariant();
    await act(async () => {
      first.reject(new Error("offline"));
    });
    await screen.findByText("No fue posible consultar el inventario.");
    await chooseProduct("SIMPLE");
    expectLoadingWithoutRows();
    expect(
      screen.queryByText("No fue posible consultar el inventario."),
    ).not.toBeInTheDocument();
    await settle(simple, response("SIMPLE"));
    await loadedRow("SIMPLE");
    expect(inventoryCalls()).toHaveLength(2);
  });

  it("isolates concurrent requests and ignores A when B completes first, even if the transport ignores cancellation", async () => {
    const first = plan(firstVariant);
    const second = plan(secondVariant);
    mount();
    await chooseProduct();
    await chooseVariant();
    await waitFor(() => expect(inventoryCalls()).toHaveLength(1));
    const oldSignal = inventoryCalls()[0][2].signal as AbortSignal;
    await chooseVariant(secondVariant);
    expectLoadingWithoutRows();
    await waitFor(() => expect(inventoryCalls()).toHaveLength(2));
    expect(oldSignal.aborted).toBe(true);
    await settle(second, response(secondVariant));
    await loadedRow(secondVariant);
    await settle(first, response(firstVariant));
    expect(
      screen.getByText(secondVariant, { selector: "strong" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(firstVariant, { selector: "strong" }),
    ).not.toBeInTheDocument();
  });

  it("reuses valid cached data only for the exact selected variant", async () => {
    const first = plan(firstVariant);
    const second = plan(secondVariant);
    mount();
    await chooseProduct();
    await chooseVariant();
    await settle(first, response(firstVariant));
    await loadedRow(firstVariant);
    await chooseVariant(secondVariant);
    expectLoadingWithoutRows();
    await settle(second, response(secondVariant));
    await loadedRow(secondVariant);
    await chooseVariant();
    expect(
      screen.getByText(firstVariant, { selector: "strong" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(secondVariant, { selector: "strong" }),
    ).not.toBeInTheDocument();
    expect(inventoryCalls()).toHaveLength(2);
  });

  it("resets company-dependent selections before showing any old-company row or making another inventory request", async () => {
    const first = plan(firstVariant);
    const other = plan(firstVariant, 1, "OT");
    const view = mount();
    await chooseProduct();
    await chooseVariant();
    await settle(first, response(firstVariant));
    await loadedRow(firstVariant);
    session.company = "OT";
    view.rerender(tree());
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Producto")).toHaveValue("");
    expect(
      screen.queryByLabelText("Variante obligatoria"),
    ).not.toBeInTheDocument();
    expect(inventoryCalls()).toHaveLength(1);
    await chooseProduct();
    await chooseVariant();
    expectLoadingWithoutRows();
    await settle(other, response(firstVariant, "OT"));
    await screen.findByText("S-OT");
    expect(screen.queryByText("S-CO")).not.toBeInTheDocument();
    expect(inventoryCalls().slice(-1)[0]?.[1].company).toBe("OT");
  });

  it("treats company casing and whitespace as the same identity without rewriting the request value", async () => {
    session.company = " CO ";
    const first = plan(firstVariant, 1, " CO ");
    const view = mount();
    await chooseProduct();
    await chooseVariant();
    await settle(first, response(firstVariant));
    await loadedRow(firstVariant);
    expect(inventoryCalls()[0][1].company).toBe(" CO ");
    session.company = "co";
    view.rerender(tree());
    await screen.findByRole("option", { name: new RegExp(firstVariant) });
    expect(screen.getByLabelText("Producto")).toHaveValue(productId);
    expect(
      screen.getByText(firstVariant, { selector: "strong" }),
    ).toBeInTheDocument();
    expect(inventoryCalls()).toHaveLength(1);
  });
});
