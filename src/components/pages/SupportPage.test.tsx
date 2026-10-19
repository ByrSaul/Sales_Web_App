import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyOperationalContext } from "../../core/session/storage";
import type { SupportResponse } from "../../features/support/supportTypes";
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("../../app/providers/AuthProvider", () => ({
  useAuth: () => ({ account: { username: "user@x.com" } }),
}));
vi.mock("../../features/support/supportMutation", () => ({
  useSendSupport: () => ({ mutateAsync: mocks.send }),
}));
vi.mock("../../app/providers/SessionProvider", () => ({
  useSession: () => ({
    context: emptyOperationalContext("support-test-account"),
  }),
}));
import SupportPage from "./SupportPage";
beforeEach(() => {
  mocks.send.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("SupportPage", () => {
  it("retains the second file when equally named attachments are removed and submits only that object", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.send.mockResolvedValue({
      success: true,
      message: "enviado",
      errorMessage: "",
    });
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>,
    );
    const first = new File(["first"], "same.png", { type: "image/png" });
    const second = new File(["second"], "same.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Adjuntar imágenes"), {
      target: { files: [first, second] },
    });
    const retainedRow = screen.getAllByRole("button", { name: "Eliminar" })[1]
      .parentElement;
    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0]);
    expect(screen.getByRole("button", { name: "Eliminar" }).parentElement).toBe(
      retainedRow,
    );
    fireEvent.change(screen.getByLabelText("Mensaje"), {
      target: { value: "mensaje suficientemente largo" },
    });
    fireEvent.click(screen.getByText("Enviar al soporte técnico"));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith({
        email: "user@x.com",
        body: "mensaje suficientemente largo",
        files: [second],
      }),
    );
    await screen.findByText("enviado");
  });
  it("blocks double submit and clears fields on success", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let release!: (v: SupportResponse) => void;
    mocks.send.mockImplementation(
      () =>
        new Promise<SupportResponse>((resolve) => {
          release = resolve;
        }),
    );
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>,
    );
    const area = screen.getByLabelText("Mensaje");
    const image = new File(["image"], "screenshot.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Adjuntar imágenes"), {
      target: { files: [image] },
    });
    fireEvent.change(area, {
      target: { value: "mensaje suficientemente largo" },
    });
    const button = screen.getByText("Enviar al soporte técnico");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith({
      email: "user@x.com",
      body: "mensaje suficientemente largo",
      files: [image],
    });
    release({ success: true, message: "enviado", errorMessage: "" });
    await waitFor(() => expect(area).toHaveValue(""));
    expect(screen.queryByText(/screenshot\.png/)).not.toBeInTheDocument();
    expect(screen.getByText("enviado")).toBeInTheDocument();
  });
});
