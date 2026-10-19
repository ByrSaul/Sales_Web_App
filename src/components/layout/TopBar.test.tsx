import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyOperationalContext } from "../../core/session/storage";
import type { OperationalContext } from "../../core/session/types";
import TopBar from "./TopBar";

const mocks = vi.hoisted(() => ({
  session: vi.fn<() => { context: OperationalContext }>(),
}));
vi.mock("../../app/providers/SessionProvider", () => ({
  useSession: () => mocks.session(),
}));
let context: OperationalContext;
beforeEach(() => {
  vi.resetAllMocks();
  context = emptyOperationalContext("topbar-test");
  mocks.session.mockImplementation(() => ({ context }));
});
afterEach(cleanup);
describe("TopBar identity and navigation", () => {
  it("shows trimmed operational identity instead of the inherited display name", () => {
    context.company = {
      id: " CO ",
      name: "Company",
      defaultCurrency: "USD",
      availableCurrencies: [],
    };
    context.user = {
      id: "U",
      name: " Nombre operativo ",
      language: "es",
      networkAlias: "",
      personnelnumber: "P",
    };
    context.vendor = { id: "V", name: " Vendedor ", companyId: "CO" };
    render(<TopBar user={{ name: "Inherited", role: "" }} />);
    expect(screen.getByText(/Empresa:/).parentElement).toHaveTextContent(
      "Empresa: CO",
    );
    expect(screen.getByText(/Usuario:/).parentElement).toHaveTextContent(
      "Usuario: Nombre operativo",
    );
    expect(screen.getByText(/Vendedor:/).parentElement).toHaveTextContent(
      "Vendedor: Vendedor",
    );
    expect(screen.getByText("N")).toBeInTheDocument();
    expect(screen.queryByText(/Inherited/)).not.toBeInTheDocument();
  });
  it("falls back to operational IDs when names are blank", () => {
    context.user = {
      id: " U-ID ",
      name: " ",
      language: "",
      networkAlias: "",
      personnelnumber: "",
    };
    context.vendor = { id: " V-ID ", name: " ", companyId: "" };
    render(<TopBar user={{ name: "Inherited", role: "" }} />);
    expect(screen.getByText(/Usuario:/).parentElement).toHaveTextContent(
      "U-ID",
    );
    expect(screen.getByText(/Vendedor:/).parentElement).toHaveTextContent(
      "V-ID",
    );
  });
  it.each(["Inherited", ""])(
    "uses the inherited name or No disponible without operational identity (%s)",
    (name) => {
      render(<TopBar user={{ name, role: "" }} />);
      expect(screen.getByText(/Usuario:/).parentElement).toHaveTextContent(
        name || "No disponible",
      );
      expect(screen.getByText(/Empresa:/).parentElement).toHaveTextContent(
        "No disponible",
      );
      expect(screen.getByText(/Vendedor:/).parentElement).toHaveTextContent(
        "No disponible",
      );
    },
  );
  it("opens the menu or goes back according to the current navigation context", () => {
    const onMenuOpen = vi.fn();
    const onBack = vi.fn();
    const view = render(
      <TopBar user={{ name: "User", role: "" }} onMenuOpen={onMenuOpen} />,
    );
    fireEvent.click(screen.getByText("menu").closest("button")!);
    expect(onMenuOpen).toHaveBeenCalledTimes(1);
    view.rerender(
      <TopBar
        user={{ name: "User", role: "" }}
        onMenuOpen={onMenuOpen}
        onBack={onBack}
      />,
    );
    expect(screen.queryByText("menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("arrow_back").closest("button")!);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onMenuOpen).toHaveBeenCalledTimes(1);
  });
});
