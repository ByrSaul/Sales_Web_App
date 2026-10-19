import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../core/api/errors";
import { loadSubmission, saveSubmission } from "./submissionStorage";
import { SubmissionRunner } from "./submissionRunner";
import { validDraft } from "./testFixtures";
import type {
  ExistingSalesLine,
  IdempotencyStatusView,
  OrderSubmissionGateway,
  SalesHeaderResponse,
} from "./types";
import type { OrderAttachment } from "../attachments/attachmentTypes";

let counter = 0;
beforeEach(() => {
  localStorage.clear();
  counter = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `key-${++counter}` });
});

// Respuestas reales de fa-sales4app-proxy (IdempotencyService.begin_request y routers de venta).
const PROCESSING = "La petición ya se encuentra en procesamiento.";
const FAILED =
  "La petición ya fue procesada previamente y falló; no se reintenta automáticamente.";
const MISMATCH =
  "El Idempotency-Key ya fue utilizado con una petición diferente.";
const headerConflict = (detail: string) =>
  new ApiError("backend", "x", 409, { detail });
const lineConflict = (detail: string) =>
  new ApiError("backend", "x", 500, { detail: `409: ${detail}` });
const timeout = () => new ApiError("timeout", "Request timeout");

const headerResponse = (salesOrderNumber = "OV-1"): SalesHeaderResponse => ({
  dataAreaId: "CO",
  salesOrderNumber,
  salesOrderName: "",
  salesOrderStatus: "",
  customerAccount: "C1",
  paymentTermsName: "",
});
const backendLine = (
  item = "I1",
  quantity = 1,
  lineNumber = 1,
): ExistingSalesLine => ({
  lineNumber,
  itemNumber: item,
  productConfigurationId: "",
  productStyleId: "",
  productSizeId: "",
  productColorId: "",
  productVersionId: "",
  salesPrice: 25,
  orderedSalesQuantity: quantity,
  shippingSiteId: "S",
  shippingWarehouseId: "W",
  csfaSuppItemGroupId: "",
  faBonification: "No",
});
// Respuestas de `GET /d365/idempotency/{key}` (IdempotencyService.describe).
const view = (
  overrides: Partial<IdempotencyStatusView> = {},
): IdempotencyStatusView => ({
  status: "Failed",
  dynamicsEffect: "NONE",
  newRequestAllowed: true,
  salesOrderNumber: null,
  lineReference: null,
  ...overrides,
});
const gateway = () =>
  ({
    createHeader: vi.fn().mockResolvedValue(headerResponse()),
    createNormalLine: vi.fn().mockResolvedValue([backendLine()]),
    createAgreementLine: vi.fn().mockResolvedValue([backendLine()]),
    getExistingLines: vi.fn().mockResolvedValue([]),
    // Sin evidencia por defecto: cada prueba declara explícitamente lo que confirma el Backend.
    getIdempotencyStatus: vi
      .fn()
      .mockRejectedValue(new ApiError("network", "unavailable")),
  }) as OrderSubmissionGateway;
const lineKeys = (g: OrderSubmissionGateway) =>
  vi.mocked(g.createNormalLine).mock.calls.map((call) => call[1]);

describe("SubmissionRunner · attachments and payment prerequisites", () => {
  const input = () => ({
    localId: "attachment-1",
    file: new File(["receipt"], "receipt.PNG", { type: "image/png" }),
    description: " pago ",
  });
  const persisted = (
    overrides: Partial<OrderAttachment> = {},
  ): OrderAttachment => ({
    companyId: "CO",
    salesOrderNumber: "OV-1",
    documentId: "DOC",
    fileName: "receipt",
    fileType: "png",
    description: "pago",
    contentBase64: "",
    attachmentType: "Imagen",
    ...overrides,
  });

  it("uploads sequentially once, persists the local IDs and skips confirmed attachments on resume", async () => {
    const g = gateway();
    g.uploadAttachment = vi.fn().mockResolvedValue(persisted());
    const runner = new SubmissionRunner(g);
    const attachment = input();
    const first = await runner.submit(validDraft(), null, [attachment]);
    expect(first.completed).toBe(true);
    expect(first.submission.createdAttachmentIds).toEqual([attachment.localId]);
    await runner.submit(first.submission.snapshot, first.submission, [
      attachment,
    ]);
    expect(g.uploadAttachment).toHaveBeenCalledExactlyOnceWith(
      "CO",
      "OV-1",
      attachment.file,
      attachment.description,
    );
    expect(g.createNormalLine).toHaveBeenCalledTimes(1);
  });

  it.each(["receipt", "RECEIPT.PNG"])(
    "confirms a timed-out upload by remote name %s and trimmed description without reuploading",
    async (fileName) => {
      const g = gateway();
      g.uploadAttachment = vi.fn().mockRejectedValue(timeout());
      g.listAttachments = vi.fn().mockResolvedValue([persisted({ fileName })]);
      const result = await new SubmissionRunner(g).submit(validDraft(), null, [
        input(),
      ]);
      expect(result.completed).toBe(true);
      expect(g.uploadAttachment).toHaveBeenCalledTimes(1);
      expect(g.listAttachments).toHaveBeenCalledExactlyOnceWith("CO", "OV-1");
      expect(result.submission.createdAttachmentIds).toEqual(["attachment-1"]);
    },
  );

  it.each(["unavailable", "missing", "different-description", "unsupported"])(
    "blocks lines after an uncertain upload when verification is %s",
    async (mode) => {
      const g = gateway();
      g.uploadAttachment = vi.fn().mockRejectedValue(timeout());
      if (mode === "unavailable")
        g.listAttachments = vi
          .fn()
          .mockRejectedValue(new Error("lookup failed"));
      if (mode === "missing") g.listAttachments = vi.fn().mockResolvedValue([]);
      if (mode === "different-description")
        g.listAttachments = vi
          .fn()
          .mockResolvedValue([persisted({ description: "other" })]);
      const runner = new SubmissionRunner(g);
      const result = await runner.submit(validDraft(), null, [input()]);
      expect(result.completed).toBe(false);
      expect(result.submission).toMatchObject({
        status: "partial-failure",
        attachmentRetryAllowed: false,
      });
      expect(result.submission.attachmentError).toContain(
        "no se crearon líneas ni se reenvió el archivo",
      );
      expect(g.createNormalLine).not.toHaveBeenCalled();
      expect(g.uploadAttachment).toHaveBeenCalledTimes(1);
      await runner.verifyPending(result.submission);
      expect(g.uploadAttachment).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["missing", "unavailable", "valid"])(
    "requires remote payment evidence (%s) before sending cash-customer lines",
    async (mode) => {
      const g = gateway();
      g.uploadAttachment = vi.fn().mockResolvedValue(persisted());
      g.listAttachments = vi
        .fn()
        .mockResolvedValue(mode === "valid" ? [persisted()] : []);
      if (mode === "unavailable")
        vi.mocked(g.listAttachments).mockRejectedValue(
          new Error("lookup unavailable"),
        );
      const draft = validDraft();
      draft.customer!.account = "MOST-000001";
      const result = await new SubmissionRunner(g).submit(draft, null, [
        input(),
      ]);
      expect(result.completed).toBe(mode === "valid");
      expect(g.uploadAttachment).toHaveBeenCalledTimes(1);
      if (mode === "valid") expect(g.createNormalLine).toHaveBeenCalledTimes(1);
      else {
        expect(g.createNormalLine).not.toHaveBeenCalled();
        expect(result.submission.attachmentRetryAllowed).toBe(false);
        expect(result.submission.attachmentError).toContain(
          "hasta confirmar el comprobante",
        );
      }
    },
  );
});

describe("SubmissionRunner · encabezado", () => {
  it("1. crea el encabezado y las líneas una sola vez cada uno", async () => {
    const g = gateway();
    const result = await new SubmissionRunner(g).submit(validDraft(2));
    expect(g.createHeader).toHaveBeenCalledTimes(1);
    expect(g.createNormalLine).toHaveBeenCalledTimes(2);
    expect(result.completed).toBe(true);
    expect(result.submission.headerTracking).toBe("completed");
    expect(
      result.submission.lines.every((x) => x.tracking === "completed"),
    ).toBe(true);
  });

  it("2. un encabezado Processing no se reenvía y bloquea la secuencia", async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValue(headerConflict(PROCESSING));
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    expect(first.submission).toMatchObject({
      headerTracking: "processing",
      headerAmbiguous: true,
    });
    const again = await runner.submit(
      first.submission.snapshot,
      first.submission,
    );
    expect(g.createHeader).toHaveBeenCalledTimes(1);
    expect(g.createNormalLine).not.toHaveBeenCalled();
    expect(again.submission.headerTracking).toBe("processing");
  });

  it("3. un encabezado Completed recupera su número de pedido con la misma clave", async () => {
    const g = gateway();
    vi.mocked(g.createHeader)
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce(headerResponse("OV-77"));
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    const verified = await runner.verifyPending(first.submission);
    const [firstKey, secondKey] = vi
      .mocked(g.createHeader)
      .mock.calls.map((call) => call[1]);
    expect(secondKey).toBe(firstKey);
    expect(verified.submission).toMatchObject({
      salesOrderNumber: "OV-77",
      headerTracking: "completed",
    });
    // La consulta no continúa sola con las líneas.
    expect(g.createNormalLine).not.toHaveBeenCalled();
  });

  it("4. cabecera Failed con evidencia de que no hubo creación: nueva solicitud permitida con otra clave", async () => {
    const g = gateway();
    vi.mocked(g.createHeader)
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(headerConflict(FAILED))
      .mockResolvedValueOnce(headerResponse("OV-2"));
    vi.mocked(g.getIdempotencyStatus!).mockResolvedValueOnce(view());
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    const verified = await runner.verifyPending(first.submission);
    expect(verified.submission).toMatchObject({
      headerTracking: "failed",
      headerAmbiguous: false,
    });
    const assessed = await runner.assessHeaderRetry(verified.submission);
    expect(assessed.safe).toBe(true);
    expect(g.getIdempotencyStatus).toHaveBeenCalledWith(
      "CO",
      first.submission.headerIdempotencyKey,
    );
    // La nueva solicitud es un envío nuevo con claves nuevas (lo hace OrderSubmissionProvider).
    const retried = await runner.submit(validDraft());
    expect(vi.mocked(g.createHeader).mock.calls[2][1]).not.toBe(
      first.submission.headerIdempotencyKey,
    );
    expect(retried.completed).toBe(true);
  });

  it("cabecera Failed sin evidencia: la nueva creación queda bloqueada y se explica el motivo", async () => {
    const g = gateway();
    vi.mocked(g.createHeader)
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(headerConflict(FAILED));
    const runner = new SubmissionRunner(g);
    const verified = await runner.verifyPending(
      (await runner.submit(validDraft())).submission,
    );
    const assessed = await runner.assessHeaderRetry(verified.submission);
    expect(assessed.safe).toBe(false);
    expect(assessed.submission.error).toContain("permanece bloqueada");
    expect(assessed.submission.headerIdempotencyKey).toBe(
      verified.submission.headerIdempotencyKey,
    );
    expect(g.createHeader).toHaveBeenCalledTimes(2);
  });

  it("cabecera Failed con efectos parciales: recupera el pedido existente y no crea otro", async () => {
    const g = gateway();
    vi.mocked(g.createHeader)
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(headerConflict(FAILED));
    vi.mocked(g.getIdempotencyStatus!).mockResolvedValueOnce(
      view({
        dynamicsEffect: "CREATED",
        newRequestAllowed: false,
        salesOrderNumber: "OV-55",
      }),
    );
    const runner = new SubmissionRunner(g);
    const verified = await runner.verifyPending(
      (await runner.submit(validDraft())).submission,
    );
    const assessed = await runner.assessHeaderRetry(verified.submission);
    expect(assessed.safe).toBe(false);
    expect(assessed.submission).toMatchObject({
      salesOrderNumber: "OV-55",
      headerTracking: "completed",
    });
    expect(g.createHeader).toHaveBeenCalledTimes(2);
  });

  it("cabecera con efectos confirmados pero sin número de pedido: bloqueada para revisión manual", async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValueOnce(
      new ApiError("backend", "bad", 400),
    );
    vi.mocked(g.getIdempotencyStatus!).mockResolvedValueOnce(
      view({ dynamicsEffect: "CREATED", newRequestAllowed: false }),
    );
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    const assessed = await runner.assessHeaderRetry(first.submission);
    expect(assessed.safe).toBe(false);
    expect(assessed.submission.salesOrderNumber).toBeNull();
    expect(assessed.submission.error).toContain("revisión manual");
  });

  it("cabecera Failed informada como Processing o efecto desconocido: bloqueada", async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValueOnce(
      new ApiError("backend", "bad", 400),
    );
    vi.mocked(g.getIdempotencyStatus!)
      .mockResolvedValueOnce(
        view({
          status: "Processing",
          dynamicsEffect: "UNKNOWN",
          newRequestAllowed: false,
        }),
      )
      .mockResolvedValueOnce(
        view({ dynamicsEffect: "UNKNOWN", newRequestAllowed: false }),
      );
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    expect((await runner.assessHeaderRetry(first.submission)).safe).toBe(false);
    expect((await runner.assessHeaderRetry(first.submission)).safe).toBe(false);
  });

  it("cabecera nunca registrada en el Backend (404 propio del endpoint): nueva solicitud permitida", async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValueOnce(
      new ApiError("backend", "bad", 422),
    );
    vi.mocked(g.getIdempotencyStatus!).mockResolvedValueOnce(null);
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    expect((await runner.assessHeaderRetry(first.submission)).safe).toBe(true);
  });

  it("5. un timeout del encabezado conserva la clave, no reenvía y queda pendiente de confirmación", async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValue(timeout());
    const runner = new SubmissionRunner(g);
    const result = await runner.submit(validDraft());
    expect(result.submission).toMatchObject({
      status: "failed",
      headerAmbiguous: true,
      headerTracking: "awaiting-confirmation",
      salesOrderNumber: null,
    });
    expect(result.submission.error).toContain("todavía no ha confirmado");
    const persisted = loadSubmission("A1", "CO");
    expect(persisted?.headerIdempotencyKey).toBe(
      result.submission.headerIdempotencyKey,
    );
    await runner.submit(persisted!.snapshot, persisted);
    expect(g.createHeader).toHaveBeenCalledTimes(1);
  });

  it("un encabezado con la clave usada para otro body queda bloqueado", async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValue(headerConflict(MISMATCH));
    const result = await new SubmissionRunner(g).submit(validDraft());
    expect(result.submission).toMatchObject({
      headerTracking: "mismatch",
      headerAmbiguous: true,
    });
    const prepared = await new SubmissionRunner(g).prepareRetry(
      result.submission,
    );
    expect(prepared.headerIdempotencyKey).toBe(
      result.submission.headerIdempotencyKey,
    );
  });

  it("un rechazo 4xx del encabezado no procesa líneas y conserva el seguimiento con su clave", async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValue(
      new ApiError("backend", "bad", 422),
    );
    const result = await new SubmissionRunner(g).submit(validDraft());
    expect(result.submission).toMatchObject({
      status: "failed",
      headerAmbiguous: false,
      headerTracking: "rejected",
    });
    expect(g.createNormalLine).not.toHaveBeenCalled();
    expect(loadSubmission("A1", "CO")).toMatchObject({
      headerTracking: "rejected",
      headerIdempotencyKey: result.submission.headerIdempotencyKey,
    });
  });
});

describe("SubmissionRunner · líneas", () => {
  it("6. crea cada línea con su propia clave persistida", async () => {
    const g = gateway();
    const result = await new SubmissionRunner(g).submit(validDraft(2));
    expect(lineKeys(g)).toEqual(
      result.submission.lines.map((line) => line.idempotencyKey),
    );
    expect(new Set(lineKeys(g)).size).toBe(2);
  });

  it("7. una línea Processing no se reenvía y detiene las siguientes", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine).mockRejectedValueOnce(
      lineConflict(PROCESSING),
    );
    const result = await new SubmissionRunner(g).submit(validDraft(2));
    expect(g.createNormalLine).toHaveBeenCalledTimes(1);
    expect(result.submission.status).toBe("awaiting-confirmation");
    expect(result.submission.lines.map((x) => [x.tracking, x.status])).toEqual([
      ["processing", "unconfirmed"],
      ["not-sent", "pending"],
    ]);
  });

  it("8. una línea Completed se confirma sin crearla de nuevo y la reanudación sigue con las demás", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine).mockRejectedValueOnce(timeout());
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft(2));
    vi.mocked(g.getExistingLines).mockResolvedValueOnce([backendLine("I1", 1)]);
    const verified = await runner.verifyPending(first.submission);
    expect(g.createNormalLine).toHaveBeenCalledTimes(1);
    expect(verified.submission.lines[0].tracking).toBe("completed");
    expect(verified.submission.status).toBe("partial-failure");
    const resumed = await runner.submit(
      verified.submission.snapshot,
      verified.submission,
    );
    expect(g.createNormalLine).toHaveBeenCalledTimes(2);
    expect(vi.mocked(g.createNormalLine).mock.calls[1][0].ItemNumber).toBe(
      "I2",
    );
    expect(resumed.completed).toBe(true);
  });

  it("9. una línea Failed solo se reintenta con clave nueva tras confirmar que no existe", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine)
      .mockRejectedValueOnce(
        new ApiError("backend", "x", 500, { detail: "Error de Dynamics" }),
      )
      .mockRejectedValueOnce(lineConflict(FAILED));
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    expect(first.submission.lines[0].tracking).toBe("awaiting-confirmation");
    const verified = await runner.verifyPending(first.submission);
    expect(verified.submission.lines[0].tracking).toBe("failed");
    expect(lineKeys(g)).toEqual([
      first.submission.lines[0].idempotencyKey,
      first.submission.lines[0].idempotencyKey,
    ]);
    vi.mocked(g.getIdempotencyStatus!).mockResolvedValueOnce(view());
    const prepared = await runner.prepareRetry(verified.submission);
    expect(g.getExistingLines).toHaveBeenCalled();
    expect(prepared.lines[0].idempotencyKey).not.toBe(
      first.submission.lines[0].idempotencyKey,
    );
    const retried = await runner.submit(prepared.snapshot, prepared);
    expect(lineKeys(g)[2]).toBe(prepared.lines[0].idempotencyKey);
    expect(retried.completed).toBe(true);
  });

  it("10. un timeout de línea no se trata como fallo, conserva la clave y no reenvía", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine).mockRejectedValueOnce(timeout());
    const result = await new SubmissionRunner(g).submit(validDraft(2));
    expect(g.createNormalLine).toHaveBeenCalledTimes(1);
    expect(g.getExistingLines).not.toHaveBeenCalled();
    expect(result.submission.lines[0]).toMatchObject({
      tracking: "awaiting-confirmation",
      status: "unconfirmed",
    });
    expect(loadSubmission("A1", "CO")?.lines[0].idempotencyKey).toBe(
      result.submission.lines[0].idempotencyKey,
    );
  });
});

describe("SubmissionRunner · concurrencia, recarga y recuperación", () => {
  it("11. el doble clic no produce dos solicitudes", async () => {
    const g = gateway();
    let resolve!: (value: SalesHeaderResponse) => void;
    vi.mocked(g.createHeader).mockImplementation(
      () => new Promise((r) => (resolve = r)),
    );
    const runner = new SubmissionRunner(g);
    const first = runner.submit(validDraft());
    await expect(runner.submit(validDraft())).rejects.toThrow("envío activo");
    resolve(headerResponse());
    const done = await first;
    await expect(runner.verifyPending(done.submission)).resolves.toBeDefined();
    expect(g.createHeader).toHaveBeenCalledTimes(1);
  });

  it("12. una línea en curso al recargar queda pendiente de confirmación y no se reenvía", async () => {
    const g = gateway();
    const runner = new SubmissionRunner(g);
    const created = await runner.submit(validDraft(2));
    // Simula el cierre de la pestaña con el POST de la segunda línea en curso.
    saveSubmission({
      ...created.submission,
      status: "creating-lines",
      lines: [
        created.submission.lines[0],
        {
          ...created.submission.lines[1],
          status: "creating",
          tracking: "awaiting-confirmation",
        },
      ],
    });
    const restored = loadSubmission("A1", "CO")!;
    expect(restored.status).toBe("awaiting-confirmation");
    expect(restored.lines[1]).toMatchObject({
      status: "unconfirmed",
      tracking: "awaiting-confirmation",
    });
    const g2 = gateway();
    await new SubmissionRunner(g2).submit(restored.snapshot, restored);
    expect(g2.createNormalLine).not.toHaveBeenCalled();
    expect(g2.createHeader).not.toHaveBeenCalled();
  });

  it("13. recupera un pedido parcial sin crear otro encabezado ni repetir líneas creadas", async () => {
    const g1 = gateway();
    vi.mocked(g1.createNormalLine)
      .mockResolvedValueOnce([backendLine("I1", 1, 1)])
      .mockRejectedValueOnce(new ApiError("network", "lost"));
    const first = await new SubmissionRunner(g1).submit(validDraft(3));
    const restored = loadSubmission("A1", "CO")!;
    const g2 = gateway();
    vi.mocked(g2.createNormalLine).mockResolvedValue([backendLine("I2", 2, 2)]);
    const runner = new SubmissionRunner(g2);
    const verified = await runner.verifyPending(restored);
    expect(vi.mocked(g2.createNormalLine).mock.calls[0][1]).toBe(
      first.submission.lines[1].idempotencyKey,
    );
    const resumed = await runner.submit(
      verified.submission.snapshot,
      verified.submission,
    );
    expect(g2.createHeader).not.toHaveBeenCalled();
    expect(
      vi.mocked(g2.createNormalLine).mock.calls.map((c) => c[0].ItemNumber),
    ).toEqual(["I2", "I3"]);
    expect(resumed.completed).toBe(true);
  });

  it("14. la recuperación de una compañía no se ofrece en otra", async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValue(timeout());
    await new SubmissionRunner(g).submit(validDraft());
    expect(loadSubmission("A1", "CO")).not.toBeNull();
    expect(loadSubmission("A1", "CO2")).toBeNull();
    expect(loadSubmission("A2", "CO")).toBeNull();
  });

  it("15. una respuesta tardía del Backend se incorpora al consultar de nuevo", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine)
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(lineConflict(PROCESSING))
      .mockResolvedValueOnce([backendLine("I1", 1, 9)]);
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    const stillProcessing = await runner.verifyPending(first.submission);
    expect(stillProcessing.submission.lines[0].tracking).toBe("processing");
    const later = await runner.verifyPending(stillProcessing.submission);
    expect(later.completed).toBe(true);
    expect(later.submission.lines[0].backendLineNumber).toBe(9);
    expect(new Set(lineKeys(g)).size).toBe(1);
  });

  it("16. un estado no reconocido por el Backend se mantiene pendiente", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine)
      .mockRejectedValueOnce(
        new ApiError("backend", "x", 409, { detail: "estado inesperado" }),
      )
      .mockRejectedValueOnce(new ApiError("network", "lost"));
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    expect(first.submission.lines[0].tracking).toBe("awaiting-confirmation");
    const verified = await runner.verifyPending(first.submission);
    expect(verified.submission.lines[0].tracking).toBe("awaiting-confirmation");
    expect(verified.submission.status).toBe("awaiting-confirmation");
  });

  it("17. el reintento queda bloqueado mientras exista una operación sin confirmar", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine).mockRejectedValueOnce(timeout());
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft(2));
    vi.mocked(g.getIdempotencyStatus!).mockResolvedValueOnce(view());
    const prepared = await runner.prepareRetry(first.submission);
    expect(prepared.lines.map((line) => line.idempotencyKey)).toEqual(
      first.submission.lines.map((line) => line.idempotencyKey),
    );
    await runner.submit(prepared.snapshot, prepared);
    expect(g.createNormalLine).toHaveBeenCalledTimes(1);
  });

  it("18. el reintento autorizado por el Backend usa una clave nueva una sola vez", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine).mockRejectedValueOnce(
      new ApiError("backend", "invalid", 422),
    );
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    expect(first.submission.lines[0]).toMatchObject({
      tracking: "rejected",
      status: "failed",
    });
    vi.mocked(g.getIdempotencyStatus!).mockResolvedValueOnce(view());
    const prepared = await runner.prepareRetry(first.submission);
    const retried = await runner.submit(prepared.snapshot, prepared);
    expect(lineKeys(g)).toEqual([
      first.submission.lines[0].idempotencyKey,
      prepared.lines[0].idempotencyKey,
    ]);
    expect(lineKeys(g)[0]).not.toBe(lineKeys(g)[1]);
    expect(retried.completed).toBe(true);
  });

  it("no habilita una clave nueva si no puede comprobar que la línea fallida no existe", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine).mockRejectedValueOnce(
      new ApiError("backend", "invalid", 422),
    );
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    vi.mocked(g.getExistingLines).mockRejectedValueOnce(
      new ApiError("network", "lost"),
    );
    vi.mocked(g.getIdempotencyStatus!).mockResolvedValueOnce(view());
    const prepared = await runner.prepareRetry(first.submission);
    expect(prepared.lines[0]).toMatchObject({
      tracking: "rejected",
      idempotencyKey: first.submission.lines[0].idempotencyKey,
    });
  });

  it("marca creada una línea fallida que ya aparece en el pedido en lugar de reenviarla", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine).mockRejectedValueOnce(
      new ApiError("backend", "invalid", 422),
    );
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    vi.mocked(g.getExistingLines).mockResolvedValueOnce([backendLine("I1", 1)]);
    vi.mocked(g.getIdempotencyStatus!).mockResolvedValueOnce(view());
    const prepared = await runner.prepareRetry(first.submission);
    expect(prepared.lines[0].tracking).toBe("completed");
    expect(g.createNormalLine).toHaveBeenCalledTimes(1);
  });
});

describe("SubmissionRunner · consulta por POST y continuación", () => {
  it("Completed de encabezado: recupera el pedido por POST con la misma clave y continúa con las líneas", async () => {
    const g = gateway();
    vi.mocked(g.createHeader)
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce(headerResponse("OV-9"));
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft(2));
    const result = await runner.verifyAndResume(
      first.submission,
      first.submission.snapshot,
    );
    const headerKeys = vi
      .mocked(g.createHeader)
      .mock.calls.map((call) => call[1]);
    expect(headerKeys).toEqual([
      first.submission.headerIdempotencyKey,
      first.submission.headerIdempotencyKey,
    ]);
    expect(vi.mocked(g.createHeader).mock.calls[1][0]).toEqual(
      vi.mocked(g.createHeader).mock.calls[0][0],
    );
    expect(g.createNormalLine).toHaveBeenCalledTimes(2);
    expect(result.completed).toBe(true);
    expect(result.submission.salesOrderNumber).toBe("OV-9");
  });

  it("Completed de línea: la marca completada y continúa con la siguiente pendiente", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine)
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce([backendLine("I1", 1, 1)])
      .mockResolvedValueOnce([backendLine("I2", 2, 2)]);
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft(2));
    const result = await runner.verifyAndResume(
      first.submission,
      first.submission.snapshot,
    );
    expect(lineKeys(g)).toEqual([
      first.submission.lines[0].idempotencyKey,
      first.submission.lines[0].idempotencyKey,
      first.submission.lines[1].idempotencyKey,
    ]);
    expect(result.completed).toBe(true);
  });

  it("Processing: la consulta no avanza a las líneas dependientes", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine)
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(lineConflict(PROCESSING));
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft(2));
    const result = await runner.verifyAndResume(
      first.submission,
      first.submission.snapshot,
    );
    expect(g.createNormalLine).toHaveBeenCalledTimes(2);
    expect(result.submission.lines.map((line) => line.tracking)).toEqual([
      "processing",
      "not-sent",
    ]);
  });

  it("Failed: la consulta informa el fallo, no genera claves ni continúa", async () => {
    const g = gateway();
    vi.mocked(g.createNormalLine)
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(lineConflict(FAILED));
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft(2));
    const result = await runner.verifyAndResume(
      first.submission,
      first.submission.snapshot,
    );
    expect(result.submission.lines[0]).toMatchObject({
      tracking: "failed",
      idempotencyKey: first.submission.lines[0].idempotencyKey,
    });
    expect(result.submission.headerIdempotencyKey).toBe(
      first.submission.headerIdempotencyKey,
    );
    expect(g.createNormalLine).toHaveBeenCalledTimes(2);
    expect(result.completed).toBe(false);
  });

  it("la consulta repetida nunca ejecuta una creación con una clave distinta", async () => {
    const g = gateway();
    vi.mocked(g.createHeader).mockRejectedValue(headerConflict(PROCESSING));
    const runner = new SubmissionRunner(g);
    const first = await runner.submit(validDraft());
    let current = first.submission;
    for (let i = 0; i < 3; i += 1)
      current = (await runner.verifyAndResume(current, current.snapshot))
        .submission;
    expect(
      new Set(vi.mocked(g.createHeader).mock.calls.map((call) => call[1])).size,
    ).toBe(1);
    expect(g.createNormalLine).not.toHaveBeenCalled();
  });
});
