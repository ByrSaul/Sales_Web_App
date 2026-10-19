import { runUiAction } from "../../core/async/uiAction";
import type { PendingOrderLine as PendingLine } from "../../features/orders/usePendingOrderLines";
import { Button, Card } from "../ui";

type Props = {
  pendingLines: PendingLine[];
  editingPendingId: string | null;
  submitting: boolean;
  submitPending: () => Promise<void>;
  verifyPendingLines: () => Promise<void>;
  beginPendingEdit: (line: PendingLine) => void;
  onRemove: (localId: string) => void;
  onCancelEdit: () => void;
};

/** Displays the persisted queue; uncertain operations never expose edit or resend actions. */
export const PendingOrderLines = ({
  pendingLines,
  editingPendingId,
  submitting,
  submitPending,
  verifyPendingLines,
  beginPendingEdit,
  onRemove,
  onCancelEdit,
}: Props) => (
  <Card className="overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-2 p-3">
      <div>
        <h2 className="font-bold">Líneas pendientes ({pendingLines.length})</h2>
        <p className="text-xs text-on-surface-variant">
          Temporales hasta su envío explícito.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {pendingLines.some((line) => line.submissionStatus === "ambiguous") && (
          <Button
            variant="outline"
            loading={submitting}
            disabled={submitting}
            onClick={() => runUiAction(() => verifyPendingLines())}
          >
            Consultar estado
          </Button>
        )}
        <Button
          loading={submitting}
          disabled={
            submitting ||
            !pendingLines.length ||
            pendingLines.some((line) => line.submissionStatus === "ambiguous")
          }
          onClick={() => runUiAction(() => submitPending())}
        >
          Enviar {pendingLines.length} línea
          {pendingLines.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
    {pendingLines.some((line) => line.submissionStatus === "ambiguous") && (
      <output
        aria-live="polite"
        aria-atomic="true"
        className="block border-t bg-amber-50 p-3 text-xs"
      >
        Hay líneas sin resultado confirmado. El envío queda bloqueado hasta
        consultar su estado: la consulta reenvía la misma operación con su misma
        clave y el Backend devuelve el resultado registrado sin crear
        duplicados.
      </output>
    )}
    {!pendingLines.length && (
      <p className="border-t p-3 text-sm">No hay líneas pendientes.</p>
    )}
    {pendingLines.length > 0 && (
      <div className="max-h-72 overflow-auto border-t">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="sticky top-0 z-10 bg-surface-container">
            <tr>
              <th className="p-2 text-left">Producto</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Total</th>
              <th>Estado / acciones</th>
            </tr>
          </thead>
          <tbody>
            {(editingPendingId
              ? pendingLines.filter((line) => line.localId === editingPendingId)
              : pendingLines
            ).map((line) => {
              const renderActions = () => {
                if (line.submissionStatus === "submitting") {
                  return (
                    <span className="text-xs font-semibold text-primary">
                      Enviando...
                    </span>
                  );
                }
                if (line.submissionStatus === "ambiguous") {
                  return (
                    <span className="text-xs font-semibold text-amber-700">
                      Esperando confirmación · reintento bloqueado
                    </span>
                  );
                }
                if (editingPendingId) {
                  return (
                    <span className="text-xs font-semibold text-primary">
                      Editando localmente
                    </span>
                  );
                }
                return (
                  <div className="flex gap-1">
                    {/* Editar generaría otra clave: una línea fallida solo se reenvía tras la evidencia del Backend. */}
                    {line.submissionStatus !== "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => beginPendingEdit(line)}
                      >
                        Editar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => onRemove(line.localId)}
                    >
                      Eliminar
                    </Button>
                  </div>
                );
              };
              return (
                <tr key={line.localId} className="border-t">
                  <td className="p-2">
                    <strong>{line.itemId}</strong>
                    <small className="block">{line.itemName}</small>
                  </td>
                  <td className="text-center">{line.quantity}</td>
                  <td className="text-center">
                    {line.currency} {line.price.toFixed(2)}
                  </td>
                  <td className="text-center">
                    {line.currency} {(line.quantity * line.price).toFixed(2)}
                  </td>
                  <td className="p-2">
                    {line.submissionError && (
                      <p className="mb-1 text-xs text-error">
                        {line.submissionError}
                      </p>
                    )}
                    {renderActions()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
    {editingPendingId && (
      <div className="flex items-center justify-between gap-2 border-t p-3 text-sm">
        <span>
          Modifique la selección en el formulario y guarde los cambios locales.
        </span>
        <Button variant="outline" onClick={onCancelEdit}>
          Cancelar edición
        </Button>
      </div>
    )}
  </Card>
);
