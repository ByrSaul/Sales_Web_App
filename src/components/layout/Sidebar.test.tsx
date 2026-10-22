import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type SidebarComponent from "./Sidebar";

const mocks = vi.hoisted(() => ({
  config: { featureProduction: false, featureForecast: false },
  changeCompany: vi.fn(),
  logout: vi.fn<() => Promise<void>>(),
}));
vi.mock("../../app/config/env", () => ({ appConfig: mocks.config }));
vi.mock("../../app/providers/SessionProvider", () => ({
  useSession: () => ({
    changeCompany: mocks.changeCompany,
    logout: mocks.logout,
  }),
}));
const mount = async (
  overrides: Partial<ComponentProps<typeof SidebarComponent>> = {},
) => {
  const { default: Sidebar } = await import("./Sidebar");
  const props = {
    activeRoute: "/pedidos",
    user: { name: "User", role: "" },
    onNavigate: vi.fn(),
    onMobileClose: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<Sidebar {...props} />) };
};
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.config.featureProduction = false;
  mocks.config.featureForecast = false;
  mocks.logout.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe("Sidebar", () => {
  it("navigates through the current routes, marks the active entry and hides disabled modules", async () => {
    const view = await mount();
    const button = screen.getByRole("button", { name: /Mis pedidos de venta/ });
    expect(button).toHaveClass("bg-primary/10");
    expect(
      screen.queryByRole("button", { name: /Producción/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Forecast de ventas/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mis clientes/ }));
    expect(view.props.onNavigate).toHaveBeenCalledExactlyOnceWith("/clientes");
    expect(view.props.onMobileClose).toHaveBeenCalledTimes(1);
  });
  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])(
    "keeps removed production/forecast entries hidden regardless of feature flags (%s/%s)",
    async (production, forecast) => {
      mocks.config.featureProduction = production;
      mocks.config.featureForecast = forecast;
      const view = await mount();
      expect(
        Boolean(screen.queryByRole("button", { name: /Producción/ })),
      ).toBe(false);
      expect(
        Boolean(screen.queryByRole("button", { name: /Forecast de ventas/ })),
      ).toBe(false);
      fireEvent.click(
        screen.getByRole("button", { name: /Consulta de Inventario/ }),
      );
      expect(view.props.onNavigate).toHaveBeenCalledWith("/inventario");
      expect(view.props.onMobileClose).toHaveBeenCalledTimes(1);
    },
  );
  it("changes company and logs out through the session instead of ordinary navigation", async () => {
    const view = await mount();
    fireEvent.click(screen.getByRole("button", { name: /Cambiar Empresa/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cerrar Sesión/ }));
    expect(mocks.changeCompany).toHaveBeenCalledTimes(1);
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(view.props.onMobileClose).toHaveBeenCalledTimes(2);
    expect(view.props.onNavigate).not.toHaveBeenCalled();
  });
  it("provides the same actions in the mobile drawer and closes it through the backdrop", async () => {
    const view = await mount({ mobileOpen: true });
    const menus = screen.getAllByRole("navigation");
    expect(menus).toHaveLength(2);
    fireEvent.click(
      within(menus[1]).getByRole("button", { name: /Crear pedidos de venta/ }),
    );
    expect(view.props.onNavigate).toHaveBeenCalledWith("/crear-pedido");
    const overlay = view.container.querySelector('[class*="bg-black/40"]');
    if (!overlay) throw new Error("Mobile backdrop missing");
    fireEvent.click(overlay);
    expect(view.props.onMobileClose).toHaveBeenCalledTimes(2);
  });
  it("supports desktop navigation and session actions without an optional close callback", async () => {
    const view = await mount({ onMobileClose: undefined });
    fireEvent.click(screen.getByRole("button", { name: /Facturas de venta/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cambiar Empresa/ }));
    expect(view.props.onNavigate).toHaveBeenCalledWith("/facturas");
    expect(mocks.changeCompany).toHaveBeenCalledTimes(1);
  });
});
