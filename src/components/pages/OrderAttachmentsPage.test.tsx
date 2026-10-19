import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../core/api/errors";
import type { OrderAttachment } from "../../features/attachments/attachmentTypes";

type Verification = { data?: OrderAttachment[]; isError?: boolean };
type Listing = {
  isLoading: boolean;
  isError: boolean;
  data: OrderAttachment[];
  refetch: () => Promise<Verification>;
};
const mocks = vi.hoisted(() => ({
  query: vi.fn<(id: string) => Listing>(),
  refetch: vi.fn<() => Promise<Verification>>(),
  upload: vi.fn<(file: File, description: string) => Promise<void>>(),
  refresh: vi.fn<() => Promise<void>>(),
  open: vi.fn(),
}));
vi.mock("../../features/attachments/attachmentQueries", () => ({
  useOrderAttachments: (id: string) => mocks.query(id),
  useAttachmentUploader: () => ({
    upload: mocks.upload,
    refresh: mocks.refresh,
  }),
}));
vi.mock("../../features/attachments/attachmentService", () => ({
  openAttachment: mocks.open,
}));
import OrderAttachmentsPage from "./OrderAttachmentsPage";

const persisted = (fileName = "A", description = "A"): OrderAttachment => ({
  companyId: "CO",
  salesOrderNumber: "OV-99",
  documentId: fileName,
  fileName,
  fileType: "pdf",
  description,
  attachmentType: "Archivo",
  contentBase64: "JVBERg==",
});
const Detail = () => <p>Detalle conservado {useLocation().search}</p>;
const mount = () =>
  render(
    <MemoryRouter
      initialEntries={["/pedidos/OV-99/adjuntos?customer=C1&page=2"]}
    >
      <Routes>
        <Route
          path="/pedidos/:salesOrderNumber/adjuntos"
          element={<OrderAttachmentsPage />}
        />
        <Route path="/pedidos/:salesOrderNumber" element={<Detail />} />
      </Routes>
    </MemoryRouter>,
  );
const selectFile = (name = "A.pdf", description = "A") => {
  const file = new File(["%PDF"], name, { type: "application/pdf" });
  fireEvent.change(screen.getByLabelText("Seleccionar archivo"), {
    target: { files: [file] },
  });
  fireEvent.change(screen.getByLabelText("Descripción " + name), {
    target: { value: description },
  });
  return file;
};
const uploadPending = () =>
  fireEvent.click(screen.getByRole("button", { name: "Subir pendientes" }));
const expectAmbiguous = async () => {
  await screen.findByText("Resultado ambiguo");
  expect(
    screen.getByRole("button", { name: "Subir pendientes" }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Reintentar" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Descripción B.pdf")).toBeDisabled();
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.refetch.mockResolvedValue({ data: [], isError: false });
  mocks.upload.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(undefined);
  mocks.query.mockReturnValue({
    isLoading: false,
    isError: false,
    data: [],
    refetch: mocks.refetch,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("OrderAttachmentsPage", () => {
  it("loads the direct route and preserves filters on return", () => {
    mount();
    expect(mocks.query).toHaveBeenCalledWith("OV-99");
    fireEvent.click(screen.getByText("← Volver al pedido"));
    expect(
      screen.getByText("Detalle conservado ?customer=C1&page=2"),
    ).toBeInTheDocument();
  });

  it("keeps partial success and verifies the uncertain file without uploading it again", async () => {
    mocks.upload
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError("timeout", "timeout"));
    mocks.refetch
      .mockResolvedValueOnce({ data: [persisted()] })
      .mockResolvedValueOnce({ data: [persisted()] });
    mount();
    const a = selectFile();
    const b = selectFile("B.pdf", "B");
    uploadPending();
    await expectAmbiguous();
    expect(
      screen.queryByLabelText("Descripción A.pdf"),
    ).not.toBeInTheDocument();
    expect(mocks.upload.mock.calls).toEqual([
      [a, "A"],
      [b, "B"],
    ]);
    mocks.refetch.mockResolvedValueOnce({
      data: [persisted(), persisted("B.pdf", " B ")],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verificar nuevamente" }),
    );
    await screen.findByText("No hay archivos seleccionados");
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.refetch).toHaveBeenCalledTimes(3);
  });

  it("blocks a simultaneous double submit logically and confirms the completed upload", async () => {
    let release!: () => void;
    mocks.upload.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    mocks.refetch.mockResolvedValue({ data: [persisted()] });
    mount();
    selectFile();
    const button = screen.getByRole("button", { name: "Subir pendientes" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Enviando")).toBeInTheDocument();
    expect(screen.getByLabelText("Seleccionar archivo")).toBeDisabled();
    expect(screen.getByLabelText("Descripción A.pdf")).toBeDisabled();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await act(async () => release());
    await screen.findByText("No hay archivos seleccionados");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("leaves a successful response ambiguous until the document is visible", async () => {
    mount();
    selectFile("B.pdf", "B");
    uploadPending();
    await expectAmbiguous();
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Verificar nuevamente" }),
    );
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(2));
    await expectAmbiguous();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it("accepts a persisted document after an upload timeout without retrying", async () => {
    mocks.upload.mockRejectedValue(new ApiError("timeout", "timeout"));
    mocks.refetch.mockResolvedValue({ data: [persisted("a.PDF", " A ")] });
    mount();
    selectFile();
    uploadPending();
    await screen.findByText("No hay archivos seleccionados");
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("handles failed verification after a failed upload and keeps the result ambiguous", async () => {
    mocks.upload.mockRejectedValue(new ApiError("network", "offline"));
    mocks.refetch.mockRejectedValue(new Error("query unavailable"));
    mount();
    selectFile("B.pdf", "B");
    uploadPending();
    await expectAmbiguous();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Verificar nuevamente" }),
    );
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(2));
    await expectAmbiguous();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it("does not treat stale query data with isError as proof that the upload persisted", async () => {
    mocks.refetch.mockResolvedValue({
      data: [persisted("B", "B")],
      isError: true,
    });
    mount();
    selectFile("B.pdf", "B");
    uploadPending();
    await expectAmbiguous();
  });

  it("handles an unavailable refresh without resending the upload", async () => {
    mocks.refresh.mockRejectedValue(new Error("cache unavailable"));
    mocks.refetch.mockRejectedValue(new Error("query unavailable"));
    mount();
    selectFile("B.pdf", "B");
    uploadPending();
    await expectAmbiguous();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it("locks duplicate manual verifications and restores the ambiguous state on failure", async () => {
    mount();
    selectFile("B.pdf", "B");
    uploadPending();
    await expectAmbiguous();
    let reject!: (error: Error) => void;
    mocks.refetch.mockImplementationOnce(
      () =>
        new Promise<Verification>((_, fail) => {
          reject = fail;
        }),
    );
    const button = screen.getByRole("button", { name: "Verificar nuevamente" });
    // Dispatch both events in one batch to exercise the lock before React replaces the button.
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(mocks.refetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Verificando resultado")).toBeInTheDocument();
    await act(async () => reject(new Error("query failed")));
    await expectAmbiguous();
    mocks.refetch.mockResolvedValueOnce({ data: [persisted("B", "B")] });
    fireEvent.click(
      screen.getByRole("button", { name: "Verificar nuevamente" }),
    );
    await screen.findByText("No hay archivos seleccionados");
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it("does not confirm a document with the same name and a different description", async () => {
    mocks.refetch.mockResolvedValue({
      data: [persisted("B", "other document")],
    });
    mount();
    selectFile("B.pdf", "B");
    uploadPending();
    await expectAmbiguous();
  });

  it("validates locally and allows retry only after correcting a pre-upload error", async () => {
    mount();
    const file = selectFile("A.pdf", " ");
    uploadPending();
    await screen.findByText("La descripción es obligatoria.");
    expect(mocks.upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(mocks.upload).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Descripción A.pdf"), {
      target: { value: "A" },
    });
    mocks.refetch.mockResolvedValueOnce({ data: [persisted()] });
    uploadPending();
    await screen.findByText("No hay archivos seleccionados");
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(file, "A");
  });

  it("removes an unsent file and ignores an empty selection", () => {
    mount();
    fireEvent.change(screen.getByLabelText("Seleccionar archivo"), {
      target: { files: [] },
    });
    expect(
      screen.getByText("No hay archivos seleccionados"),
    ).toBeInTheDocument();
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(
      screen.getByText("No hay archivos seleccionados"),
    ).toBeInTheDocument();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("shows query loading and error states and retries only the query", async () => {
    mocks.query.mockReturnValue({
      isLoading: true,
      isError: true,
      data: [],
      refetch: mocks.refetch,
    });
    mount();
    expect(screen.getByText("Consultando adjuntos...")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Reintentar consulta" }),
    );
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("opens an existing attachment and disables opening documents without content", () => {
    const document = persisted();
    mocks.query.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        document,
        { ...persisted("empty"), contentBase64: "", description: "" },
      ],
      refetch: mocks.refetch,
    });
    mount();
    const buttons = screen.getAllByRole("button", {
      name: "Abrir o descargar",
    });
    fireEvent.click(buttons[0]);
    expect(mocks.open).toHaveBeenCalledExactlyOnceWith(document);
    expect(buttons[1]).toBeDisabled();
    expect(screen.getByText("Sin descripción")).toBeInTheDocument();
  });
});
