import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { useOrderDraft } from "../../features/orderDraft/OrderDraftProvider";
import type { PendingAttachment } from "../../features/attachments/attachmentTypes";
import { MAX_ATTACHMENT_BYTES } from "../../features/attachments/attachmentValidation";
import { validDraft } from "../../features/orders/testFixtures";
import { DraftAttachments } from "./DraftAttachments";

type DraftValue = Pick<
  ReturnType<typeof useOrderDraft>,
  "draft" | "attachments" | "setAttachments"
>;
const mocks = vi.hoisted(() => ({ useDraft: vi.fn<() => DraftValue>() }));
vi.mock("../../features/orderDraft/OrderDraftProvider", () => ({
  useOrderDraft: () => mocks.useDraft(),
}));

let initialAttachments: PendingAttachment[];
let customerAccount: string | null;
function useTestDraft(): DraftValue {
  const [attachments, setAttachments] = useState(initialAttachments);
  const draft = validDraft();
  if (customerAccount === null) draft.customer = null;
  else if (draft.customer) draft.customer.account = customerAccount;
  return { draft, attachments, setAttachments };
}
const select = (file?: File) => {
  fireEvent.change(screen.getByLabelText("Agregar archivo"), {
    target: { files: file ? [file] : [] },
  });
};
const attachment = (name: string, description: string): PendingAttachment => ({
  localId: name,
  file: new File(["x"], name),
  fileName: name,
  extension: "pdf",
  description,
  status: "pending",
  error: "",
  attempts: 0,
});
beforeEach(() => {
  initialAttachments = [];
  customerAccount = "C1";
  mocks.useDraft.mockReset();
  mocks.useDraft.mockImplementation(useTestDraft);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DraftAttachments", () => {
  it("selects a file, validates description changes and preserves the other attachment", () => {
    render(<DraftAttachments />);
    select(new File(["x"], "first.pdf"));
    expect(
      screen.getByText("La descripción es obligatoria."),
    ).toBeInTheDocument();
    select(new File(["y"], "second.png"));
    const description = screen.getByLabelText("Descripción first.pdf");
    fireEvent.change(description, { target: { value: "Receipt" } });
    expect(description).toHaveValue("Receipt");
    expect(screen.getAllByText("La descripción es obligatoria.")).toHaveLength(
      1,
    );
    expect(screen.getByLabelText("Descripción second.png")).toHaveValue("");
    fireEvent.change(description, { target: { value: "x".repeat(101) } });
    expect(
      screen.getByText("La descripción no puede exceder 100 caracteres."),
    ).toBeInTheDocument();
    fireEvent.change(description, { target: { value: "  " } });
    expect(screen.getAllByText("La descripción es obligatoria.")).toHaveLength(
      2,
    );
    fireEvent.change(description, { target: { value: "Corrected" } });
    expect(
      screen.queryByText("La descripción no puede exceder 100 caracteres."),
    ).not.toBeInTheDocument();
  });

  it.each(["jpg", "JPEG", "png"])(
    "automatically describes a cash-customer %s image as pago",
    (extension) => {
      customerAccount = "MOST-000001";
      render(<DraftAttachments />);
      select(new File(["image"], "receipt." + extension));
      expect(
        screen.getByLabelText("Descripción receipt." + extension),
      ).toHaveValue("pago");
      expect(
        screen.queryByText("La descripción es obligatoria."),
      ).not.toBeInTheDocument();
    },
  );

  it("does not label a cash-customer PDF as an image payment", () => {
    customerAccount = "MOST-000001";
    render(<DraftAttachments />);
    select(new File(["%PDF"], "receipt.pdf"));
    expect(screen.getByLabelText("Descripción receipt.pdf")).toHaveValue("");
    expect(
      screen.getByText("La descripción es obligatoria."),
    ).toBeInTheDocument();
  });

  it("allows selection without a customer and ignores an empty file event", () => {
    customerAccount = null;
    render(<DraftAttachments />);
    select();
    expect(
      screen.queryByRole("button", { name: "Eliminar" }),
    ).not.toBeInTheDocument();
    select(new File(["x"], "receipt.pdf"));
    expect(screen.getByLabelText("Descripción receipt.pdf")).toHaveValue("");
    expect(screen.getByLabelText("Agregar archivo")).toHaveValue("");
  });

  it.each([
    ["invalid.exe", 1, "Solo se permiten archivos PDF, JPG, JPEG o PNG."],
    [
      "oversize.pdf",
      MAX_ATTACHMENT_BYTES + 1,
      "El archivo supera el máximo de 5 MB.",
    ],
  ])(
    "rejects %s even after adding a valid description",
    (name, size, error) => {
      render(<DraftAttachments />);
      select(new File([new Uint8Array(size)], name));
      fireEvent.change(screen.getByLabelText("Descripción " + name), {
        target: { value: "Receipt" },
      });
      expect(screen.getByText(error)).toBeInTheDocument();
    },
  );

  it("removes only the chosen file and stops warning when the last file is removed", () => {
    initialAttachments = [
      attachment("first.pdf", "First"),
      attachment("second.pdf", "Second"),
    ];
    const view = render(<DraftAttachments />);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0]);
    expect(screen.queryByText("first.pdf")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Descripción second.pdf")).toHaveValue(
      "Second",
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
    view.unmount();
  });

  it("shows prepared attachments in read-only mode without editing controls", () => {
    initialAttachments = [attachment("receipt.pdf", "Receipt")];
    render(<DraftAttachments readOnly />);
    expect(screen.getByText("Adjuntos preparados (1)")).toBeInTheDocument();
    expect(screen.getByText("receipt.pdf · Receipt")).toBeInTheDocument();
    expect(screen.queryByLabelText("Agregar archivo")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Eliminar" }),
    ).not.toBeInTheDocument();
  });

  it("shows the read-only empty state without installing an unload warning", () => {
    render(<DraftAttachments readOnly />);
    expect(screen.getByText("Sin adjuntos.")).toBeInTheDocument();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });
});
