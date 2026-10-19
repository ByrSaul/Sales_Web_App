import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerAddress } from "../../features/catalogs/types";
import { CustomerAddressSelector } from "./CustomerAddressSelector";

type Query = {
  data?: CustomerAddress[];
  isFetching: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
};
const mocks = vi.hoisted(() => ({
  query: vi.fn<(account: string) => Query>(),
  refetch: vi.fn<() => Promise<void>>(),
}));
vi.mock("../../features/catalogs/hooks", () => ({
  useCustomerAddresses: (account: string) => mocks.query(account),
}));
const addresses: CustomerAddress[] = [
  {
    locationId: "L1",
    description: "Oficina",
    formattedAddress: "Zona 1",
    countryId: "GTM",
    roles: "Delivery",
    recId: 1,
  },
  {
    locationId: "L2",
    description: "",
    formattedAddress: "San Salvador",
    countryId: "SLV",
    roles: "Delivery",
    recId: 2,
  },
];
const query = (overrides: Partial<Query> = {}): Query => ({
  data: addresses,
  isFetching: false,
  isError: false,
  refetch: mocks.refetch,
  ...overrides,
});
const mount = (
  selected: CustomerAddress | null = null,
  customerAccount = "C1",
) => {
  const onSelect = vi.fn();
  return {
    onSelect,
    ...render(
      <CustomerAddressSelector
        selected={selected}
        customerAccount={customerAccount}
        onSelect={onSelect}
      />,
    ),
  };
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.refetch.mockResolvedValue(undefined);
  mocks.query.mockReturnValue(query());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const advance = () =>
  act(() => {
    vi.advanceTimersByTime(1000);
  });

describe("CustomerAddressSelector", () => {
  it("disables searching without a customer", () => {
    mount(null, "");
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(mocks.query).toHaveBeenCalledWith("");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("opens available addresses, selects the original object and closes the popup", () => {
    const { onSelect } = mount();
    fireEvent.focus(screen.getByRole("textbox"));
    fireEvent.click(screen.getByRole("button", { name: /Oficina.*Zona 1/ }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(addresses[0]);
    expect(screen.getByRole("textbox")).toHaveValue("Oficina");
    expect(
      screen.queryByRole("button", { name: /Sin descripción/ }),
    ).not.toBeInTheDocument();
  });
  it.each([
    [" oficina ", "Oficina"],
    ["zona", "Oficina"],
    ["slv", "Sin descripción"],
  ])(
    "debounces and filters by description, address or country: %s",
    (search, expected) => {
      mount();
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: search },
      });
      expect(screen.getByText("Escribiendo...")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      advance();
      expect(screen.queryByText("Escribiendo...")).not.toBeInTheDocument();
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(
        screen.getByRole("button", { name: new RegExp(expected) }),
      ).toBeInTheDocument();
    },
  );
  it("uses formattedAddress when the selected result has no description", () => {
    const { onSelect } = mount();
    fireEvent.focus(screen.getByRole("textbox"));
    fireEvent.click(
      screen.getByRole("button", { name: /Sin descripción.*San Salvador/ }),
    );
    expect(onSelect).toHaveBeenCalledWith(addresses[1]);
    expect(screen.getByRole("textbox")).toHaveValue("San Salvador");
  });
  it("displays a selection, clears it with Cambiar and allows another selection", () => {
    const { onSelect } = mount(addresses[0]);
    expect(screen.getByRole("textbox")).toHaveValue("Oficina");
    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(screen.getByRole("textbox")).toHaveValue("");
    advance();
    expect(
      screen.getByRole("button", { name: /Sin descripción/ }),
    ).toBeInTheDocument();
  });
  it("synchronizes a changed customer/selection and closes stale results", () => {
    const view = mount();
    fireEvent.focus(screen.getByRole("textbox"));
    view.rerender(
      <CustomerAddressSelector
        customerAccount="C2"
        selected={addresses[1]}
        onSelect={view.onSelect}
      />,
    );
    expect(mocks.query).toHaveBeenLastCalledWith("C2");
    expect(screen.getByRole("textbox")).toHaveValue("San Salvador");
    expect(
      screen.queryByRole("button", { name: /Sin descripción/ }),
    ).not.toBeInTheDocument();
  });
  it("closes on Escape and outside mousedown, but keeps results for internal clicks", () => {
    const view = mount();
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.mouseDown(input);
    expect(screen.getByRole("button", { name: /Oficina/ })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("button", { name: /Oficina/ })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    fireEvent.focus(input);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    view.unmount();
    fireEvent.mouseDown(document.body);
  });
  it("shows loading only without cached data and exposes a query retry on error", async () => {
    mocks.query.mockReturnValue(query({ data: undefined, isFetching: true }));
    const view = mount();
    fireEvent.focus(screen.getByRole("textbox"));
    expect(screen.getByText("Buscando direcciones...")).toBeInTheDocument();
    mocks.query.mockReturnValue(
      query({ data: undefined, isError: true, isFetching: false }),
    );
    view.rerender(
      <CustomerAddressSelector
        customerAccount="C1"
        selected={null}
        onSelect={view.onSelect}
      />,
    );
    expect(
      screen.queryByText("No se encontraron direcciones."),
    ).not.toBeInTheDocument();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" })),
    );
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
  it("shows empty results only after debounce and outside loading/error states", () => {
    mount();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "unmatched" },
    });
    expect(
      screen.queryByText("No se encontraron direcciones."),
    ).not.toBeInTheDocument();
    advance();
    expect(
      screen.getByText("No se encontraron direcciones."),
    ).toBeInTheDocument();
  });
  it("handles an empty query and preserves cached addresses while fetching", () => {
    mocks.query.mockReturnValue(query({ data: undefined }));
    const view = mount();
    fireEvent.focus(screen.getByRole("textbox"));
    expect(
      screen.getByText("No se encontraron direcciones."),
    ).toBeInTheDocument();
    mocks.query.mockReturnValue(query({ isFetching: true }));
    view.rerender(
      <CustomerAddressSelector
        customerAccount="C1"
        selected={null}
        onSelect={view.onSelect}
      />,
    );
    expect(
      screen.queryByText("Buscando direcciones..."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Oficina/ })).toBeInTheDocument();
  });
});
