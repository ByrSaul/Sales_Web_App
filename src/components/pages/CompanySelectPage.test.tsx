import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../core/api/errors";
import { emptyOperationalContext } from "../../core/session/storage";
import type { Company } from "../../core/session/types";
import CompanySelectPage from "./CompanySelectPage";
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  select: vi.fn(),
  session: vi.fn(),
}));
const transport = { post: mocks.post };
vi.mock("../../app/providers/SessionProvider", () => ({
  useSession: () => ({
    api: transport,
    context: mocks.session(),
    selectCompany: mocks.select,
  }),
}));
const companies = [
  { legalentityid: "CO", name: "Empresa principal", currencycode: "GTQ" },
  { legalentityid: "OT", name: "Otra empresa" },
];
const Location = () => <output>{useLocation().pathname}</output>;
const mount = () =>
  render(
    <MemoryRouter>
      <CompanySelectPage />
      <Location />
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockReturnValue(emptyOperationalContext("A1"));
  mocks.post.mockResolvedValue(companies);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("CompanySelectPage", () => {
  it("waits for companies and prevents continuing without a selection", async () => {
    let release!: (value: typeof companies) => void;
    mocks.post.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    mount();
    expect(screen.getByText("Cargando empresas...")).toBeInTheDocument();
    await act(async () => {
      release(companies);
    });
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeDisabled();
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith("/company/companies");
  });
  it("selects the original company object from the service and navigates only on Continue", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: /Empresa principal/ }),
    );
    expect(mocks.select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        id: "CO",
        name: "Empresa principal",
        defaultCurrency: "GTQ",
      }),
    );
    expect(screen.getByText("/vendor")).toBeInTheDocument();
  });
  it("restores the context selection and allows switching to a company without a currency", async () => {
    mocks.session.mockReturnValue({
      ...emptyOperationalContext("A1"),
      company: { id: "CO" },
    });
    mount();
    await screen.findByText("Empresa principal");
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Otra empresa/ }));
    expect(screen.getByText(/Sin moneda predeterminada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(mocks.select.mock.calls[0][0]).toMatchObject({ id: "OT" });
  });
  it("shows an empty response and does not select a stale context company", async () => {
    mocks.post.mockResolvedValue([]);
    mocks.session.mockReturnValue({
      ...emptyOperationalContext("A1"),
      company: { id: "OLD" } as Company,
    });
    mount();
    await screen.findByText("No hay empresas disponibles para tu usuario.");
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(mocks.select).not.toHaveBeenCalled();
    expect(screen.queryByText("/vendor")).not.toBeInTheDocument();
  });
  it("reports a failed request, retries explicitly and clears the error on success", async () => {
    mocks.post.mockRejectedValueOnce(new ApiError("network", "offline"));
    mount();
    await screen.findByText("No fue posible conectar con el servicio.");
    fireEvent.click(
      screen.getByRole("button", { name: "Intentar nuevamente" }),
    );
    await screen.findByText("Empresa principal");
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
