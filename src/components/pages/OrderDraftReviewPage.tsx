import { runUiAction } from "../../core/async/uiAction";
import { useSafeNavigate as useNavigate } from "../../core/hooks/useSafeNavigate";
import { draftTotal } from "../../features/orderDraft/domain";
import { useOrderDraft } from "../../features/orderDraft/OrderDraftProvider";
import { validateOrderDraft } from "../../features/orderDraft/validation";
import { useOrderSubmission } from "../../features/orders/OrderSubmissionProvider";
import { Button, Card } from "../ui";
import { DraftAttachments } from "../orders/DraftAttachments";
import { validateAttachment } from "../../features/attachments/attachmentValidation";
import type {
  OperationTracking,
  OrderSubmission,
  SubmissionStatus,
} from "../../features/orders/types";

const labels = {
  pending: "Pendiente",
  creating: "Creando…",
  created: "Creada",
  failed: "Fallida",
  unconfirmed: "Esperando confirmación",
} as const;
const trackingLabels: Record<OperationTracking, string> = {
  "not-sent": "Sin enviar",
  "awaiting-confirmation": "Resultado sin confirmar · reintento bloqueado",
  processing: "En procesamiento según el Backend · reintento bloqueado",
  completed: "Confirmada por el Backend",
  failed: "Fallida según el Backend · reintento permitido",
  rejected: "Rechazada por el Backend · reintento permitido",
  mismatch: "Clave usada con otros datos · reintento bloqueado",
};
const statusLabels: Record<SubmissionStatus, string> = {
  idle: "Preparando",
  validating: "Validando",
  "creating-header": "Creando encabezado",
  "header-created": "Encabezado creado",
  "uploading-attachments": "Subiendo adjuntos",
  "creating-lines": "Creando líneas",
  recovering: "Consultando estado en el Backend",
  "awaiting-confirmation": "Esperando confirmación",
  "partial-failure": "Pedido creado parcialmente",
  completed: "Operación completada",
  failed: "Operación fallida",
};
/**
 * Pantalla de revisión, validación y envío del borrador de pedido.
 *
 * Dependencias:
 * - `OrderDraftProvider`.
 * - `OrderSubmissionProvider`.
 * - Validadores de borrador y adjuntos.
 */
const OrderDraftReviewPage = () => {
  const renderHeaderRecoveryActions = (submission: OrderSubmission) => {
    if (submission.headerAmbiguous) {
      return (
        <>
          <p className="text-xs font-bold mt-1">
            El Backend no ha confirmado que el encabezado se pueda reintentar.
            No se habilita un pedido nuevo para evitar duplicados.
            {submission.headerIdempotencyKey &&
              " La consulta reenvía la misma operación con su misma clave: si el pedido ya existe, el Backend devuelve ese pedido en lugar de crear otro."}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {submission.headerIdempotencyKey &&
              verifyButton("Consultar estado del encabezado")}
            <Button variant="outline" onClick={() => navigate("/pedidos")}>
              Ir a Mis pedidos
            </Button>
            <Button
              variant="danger"
              disabled={flow.busy}
              onClick={() => {
                if (
                  window.confirm(
                    "El resultado del encabezado aún no está confirmado. Descartar esta recuperación no elimina ningún pedido que pueda existir en Dynamics y deja de darle seguimiento. Verifique Mis pedidos antes de crear otro. ¿Continuar?",
                  )
                )
                  flow.discardRecovery();
              }}
            >
              Descartar recuperación local
            </Button>
          </div>
        </>
      );
    }
    if (submission.headerTracking === "not-sent") {
      return (
        <div className="flex flex-wrap gap-2 mt-2">
          <Button
            disabled={flow.busy}
            onClick={() => runUiAction(() => create())}
          >
            Reintentar encabezado
          </Button>
          <Button
            variant="outline"
            disabled={flow.busy}
            onClick={() => flow.discardRecovery()}
          >
            Volver al borrador
          </Button>
        </div>
      );
    }
    return (
      <>
        <p className="text-xs font-bold mt-1">
          Un nuevo pedido solo se crea si el Backend confirma que el intento
          anterior no produjo efectos en Dynamics. Si confirma que el pedido
          existe, se recupera su número. Sin esa evidencia, la nueva creación
          permanece bloqueada.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button
            disabled={flow.busy}
            loading={flow.busy}
            onClick={() => runUiAction(() => requestNewHeader())}
          >
            Reintentar encabezado
          </Button>
          <Button variant="outline" onClick={() => navigate("/pedidos")}>
            Ir a Mis pedidos
          </Button>
          <Button
            variant="danger"
            disabled={flow.busy}
            onClick={() => {
              if (
                window.confirm(
                  "Esto NO comprueba si el pedido existe en Dynamics: solo abandona el seguimiento local de esta operación bajo su responsabilidad. Verifique Mis pedidos antes de crear otro. ¿Continuar?",
                )
              )
                flow.discardRecovery();
            }}
          >
            Descartar recuperación local
          </Button>
        </div>
      </>
    );
  };

  const navigate = useNavigate();
  const {
    draft: editableDraft,
    attachments,
    updateLine,
    removeLine,
    reset,
  } = useOrderDraft();
  const flow = useOrderSubmission();
  const submission = flow.submission;
  const draft = submission?.salesOrderNumber
    ? submission.snapshot
    : editableDraft;
  const errors = validateOrderDraft(draft);
  const attachmentErrors = attachments
    .map((item) => validateAttachment(item.file, item.description))
    .filter(Boolean);
  const locked =
    flow.active ||
    flow.busy ||
    flow.unresolved ||
    Boolean(submission?.salesOrderNumber) ||
    Boolean(submission?.headerAmbiguous);
  const create = async () => {
    if (flow.busy || flow.unresolved) return;
    if (
      !window.confirm(
        "Se creará un pedido real en Dynamics 365. ¿Desea continuar?",
      )
    )
      return;
    await flow.submit();
  };
  /**
   * Nueva solicitud tras un encabezado con error: el Backend debe confirmar antes que el intento
   * anterior no produjo efectos (o el pedido existente se recupera). Sin evidencia queda bloqueada.
   */
  const requestNewHeader = async () => {
    if (flow.busy || flow.unresolved) return;
    if (
      !window.confirm(
        "Se comprobará en el Backend que el intento anterior no creó nada en Dynamics. Solo si se confirma, se creará un nuevo pedido real. ¿Continuar?",
      )
    )
      return;
    await flow.retryPending();
  };
  const verifyButton = (label: string) => (
    <Button
      disabled={flow.busy}
      loading={flow.busy}
      onClick={() => runUiAction(() => flow.verifyPending())}
    >
      {label}
    </Button>
  );
  if (submission?.status === "completed")
    return (
      <div className="space-y-4">
        <Card className="p-6 bg-primary/5">
          <h1 className="text-xl font-bold">Pedido creado correctamente</h1>
          <p className="text-3xl font-black text-primary mt-2">
            {submission.salesOrderNumber}
          </p>
          <p className="text-sm mt-2">
            {submission.lines.length} de {submission.lines.length} líneas
            creadas.
          </p>
          <p className="text-xs mt-2">
            El detalle consultará Dynamics; no utiliza este snapshot como fuente
            oficial.
          </p>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              navigate(
                `/pedidos/${encodeURIComponent(submission.salesOrderNumber!)}`,
              )
            }
          >
            Ver detalle real
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              navigate(
                `/pedidos/${encodeURIComponent(submission.salesOrderNumber!)}/adjuntos`,
              )
            }
          >
            Agregar adjuntos
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              flow.createAnother();
              navigate("/crear-pedido");
            }}
          >
            Crear otro pedido
          </Button>
          <Button variant="outline" onClick={() => navigate("/home")}>
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-4 pb-12">
      <div>
        <h1 className="text-xl font-bold">Revisión y creación</h1>
        <p className="text-xs text-on-surface-variant">
          El envío crea el encabezado, sube los adjuntos y después crea cada
          línea secuencialmente.
        </p>
      </div>
      {submission && (
        <Card className="p-4 space-y-3">
          <div className="flex justify-between gap-2">
            <div>
              <h2 className="font-bold">
                {submission.salesOrderNumber
                  ? `Pedido ${submission.salesOrderNumber}`
                  : "Creación del encabezado"}
              </h2>
              <p className="text-xs">
                Estado: {statusLabels[submission.status]}
              </p>
              {!submission.salesOrderNumber && (
                <p className="text-xs">
                  Encabezado: {trackingLabels[submission.headerTracking]}
                </p>
              )}
              {submission.status === "uploading-attachments" && (
                <p className="text-xs font-semibold text-primary">
                  Subiendo adjuntos...
                </p>
              )}
              {submission.attachmentError && (
                <p className="text-xs text-error">
                  {submission.attachmentError}
                </p>
              )}
            </div>
            <strong>
              {submission.lines.filter((x) => x.status === "created").length} /{" "}
              {submission.lines.length}
            </strong>
          </div>
          <div className="h-2 bg-surface-container rounded overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{
                width: `${submission.lines.length ? (submission.lines.filter((x) => x.status === "created").length / submission.lines.length) * 100 : 0}%`,
              }}
            />
          </div>
          <ul className="space-y-2">
            {submission.lines.map((line) => (
              <li
                key={line.localId}
                className="flex items-start justify-between gap-3 border-t pt-2 text-sm"
              >
                <span>
                  {line.draftLine.itemId} · {line.draftLine.itemName}
                  <small className="block text-on-surface-variant">
                    {trackingLabels[line.tracking]} · Envíos: {line.attempts}
                    {line.error ? ` · ${line.error}` : ""}
                  </small>
                </span>
                <strong>{labels[line.status]}</strong>
              </li>
            ))}
          </ul>
          {submission.salesOrderNumber && flow.unresolved && (
            <output
              aria-live="polite"
              aria-atomic="true"
              className="block bg-amber-50 p-3 rounded"
            >
              <strong>Esperando confirmación del Backend</strong>
              <p className="text-xs">
                El servidor continúa procesando la operación o todavía no ha
                confirmado su resultado. No vuelva a enviarla hasta verificar su
                estado. Las líneas posteriores no se crearán hasta resolver
                esta.
              </p>
              <p className="text-xs mt-1">
                La consulta reenvía la misma operación con su misma clave: el
                Backend devuelve el resultado registrado y no crea duplicados.
                Si se confirma, el envío continúa con las líneas pendientes.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {verifyButton("Consultar estado")}
                <Button variant="outline" onClick={() => navigate("/pedidos")}>
                  Ir a Mis pedidos
                </Button>
              </div>
            </output>
          )}
          {submission.status === "partial-failure" && !flow.unresolved && (
            <div className="bg-amber-50 p-3 rounded">
              <strong>Pedido creado parcialmente</strong>
              <p className="text-xs">
                {submission.attachmentError
                  ? "El encabezado existe, pero un adjunto quedó ambiguo. No se crearán líneas ni se reenviará el archivo automáticamente."
                  : "Las líneas fallidas se comprobarán en Dynamics antes de enviarse como operaciones nuevas."}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {!submission.attachmentError && (
                  <Button
                    disabled={flow.busy}
                    onClick={() => runUiAction(() => flow.retryPending())}
                  >
                    Reintentar líneas pendientes
                  </Button>
                )}
                {submission.attachmentError &&
                  submission.attachmentRetryAllowed && (
                    <Button
                      disabled={flow.busy}
                      onClick={() => runUiAction(() => flow.retryPending())}
                    >
                      Reintentar carga del comprobante
                    </Button>
                  )}
                <Button
                  variant="danger"
                  disabled={flow.busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Esto solo dejará de intentar completar el pedido. No elimina el pedido existente en Dynamics. ¿Descartar recuperación?",
                      )
                    )
                      flow.discardRecovery();
                  }}
                >
                  Descartar recuperación
                </Button>
              </div>
            </div>
          )}
          {submission.status === "failed" && (
            <div className="bg-red-50 p-3 rounded text-error">
              <strong>No fue posible completar el encabezado</strong>
              <p className="text-xs">{submission.error}</p>
              {renderHeaderRecoveryActions(submission)}
            </div>
          )}
        </Card>
      )}
      <Card className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
        <p>
          <small>Empresa / vendedor</small>
          <br />
          <strong>
            {draft.dataAreaId} / {draft.vendorId}
          </strong>
        </p>
        <p>
          <small>Cliente</small>
          <br />
          <strong>
            {draft.customer?.account} · {draft.customer?.name}
          </strong>
        </p>
        <p>
          <small>Moneda</small>
          <br />
          <strong>{draft.currencyCode}</strong>
        </p>
        <p>
          <small>Entrega</small>
          <br />
          <strong>
            {draft.deliveryMode?.code} · {draft.deliveryAddress?.description}
          </strong>
        </p>
        <p>
          <small>Fecha / origen</small>
          <br />
          <strong>
            {draft.requestedShippingDate} · {draft.salesOrigin?.id}
          </strong>
        </p>
        <p>
          <small>Acuerdo</small>
          <br />
          <strong>{draft.agreement?.number ?? "Sin acuerdo"}</strong>
        </p>
      </Card>
      <DraftAttachments readOnly />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="p-3 text-left">Producto</th>
                <th>Dimensiones</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Subtotal</th>
                <th>Tipo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line) => (
                <tr key={line.localId} className="border-t">
                  <td className="p-3">
                    <strong>{line.itemId}</strong>
                    <br />
                    <small>{line.itemName}</small>
                  </td>
                  <td className="p-2 text-xs">
                    {line.presentationCode ?? "Simple"}
                    <br />
                    {line.siteId}/{line.warehouseId}
                  </td>
                  <td className="p-2">
                    <input
                      aria-label={`Cantidad ${line.itemId}`}
                      type="number"
                      min="0"
                      step="any"
                      value={line.quantity}
                      disabled={
                        locked ||
                        (line.isBonification && line.parentLineId != null)
                      }
                      onChange={(e) =>
                        updateLine(line.localId, {
                          quantity: Number(e.target.value),
                        })
                      }
                      className="w-20 border rounded p-1"
                    />
                  </td>
                  <td className="text-center">{line.price.toFixed(2)}</td>
                  <td className="text-center">
                    {(line.quantity * line.price).toFixed(2)}
                  </td>
                  <td className="text-center text-xs">
                    {line.isBonification
                      ? `Bonus ${line.promotion?.groupId ?? "independiente"}`
                      : line.source}
                  </td>
                  <td className="p-2">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={locked}
                      onClick={() => removeLine(line.localId)}
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 text-right">
          <span className="text-xs">Total visual previo a Dynamics</span>
          <p className="text-2xl font-bold">
            {draft.currencyCode} {draftTotal(draft).toFixed(2)}
          </p>
        </div>
      </Card>
      {errors.length ? (
        <Card className="p-4 border-error">
          <h2 className="font-bold text-error">
            El borrador aún no está listo
          </h2>
          <ul className="list-disc pl-5 text-sm text-error">
            {errors.map((e) => (
              <li key={JSON.stringify([e.code, e.field, e.lineId, e.message])}>
                {e.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        !submission && (
          <Card className="p-4 bg-primary/5">
            <strong>Borrador listo</strong>
            <p className="text-xs">
              La validación se ejecutará nuevamente inmediatamente antes del
              primer POST.
            </p>
          </Card>
        )
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={locked}
          onClick={() => navigate("/crear-pedido")}
        >
          Editar encabezado
        </Button>
        <Button
          variant="outline"
          disabled={locked}
          onClick={() => navigate("/crear-pedido/linea")}
        >
          Editar líneas
        </Button>
        {!submission && (
          <>
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm("¿Descartar este borrador local?")) {
                  reset();
                  navigate("/crear-pedido");
                }
              }}
            >
              Descartar
            </Button>
            <Button
              disabled={Boolean(errors.length || attachmentErrors.length)}
              onClick={() => runUiAction(() => create())}
            >
              Crear pedido real
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
export default OrderDraftReviewPage;
