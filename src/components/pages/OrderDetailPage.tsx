import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { CircularProgress, IconButton, Tooltip } from '@mui/material';
import { userErrorMessage } from '../../core/api/errors';
import { useSession } from '../../app/providers/SessionProvider';
import {
  useCustomerByAccount,
  useInfiniteInventoryLocations,
} from '../../features/catalogs/hooks';
import { isAmbiguousError } from '../../features/orders/mutationOutcome';
import { statusLabel } from '../../features/orders/orderMappers';
import { useOrderDetail, useOrderMutations } from '../../features/orders/orderQueries';
import {
  canAddOrderLine,
  canCancelPersistedLine,
  canConfirmOrder,
  canDeletePersistedLine,
  canEditPersistedLine,
  canEditPersistedLinePrice,
  canSubmitPersistedLineUpdate,
  persistedLineDisabledReason,
} from '../../features/orders/orderRules';
import type { OfficialSalesOrderLine } from '../../features/orders/orderTypes';
import { Button, Card, EmptyState, Input } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';
type PendingLineSummary = {
  localId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  currency: string;
};
const OrderDetailPage = () => {
  const { salesOrderNumber = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { context } = useSession();
  const data = useOrderDetail(salesOrderNumber);
  const mutations = useOrderMutations(salesOrderNumber);
  const locks = useRef({ update: false, confirm: false });
  const transactionalLocks = useRef(new Set<string>());
  const linesViewportRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const linesScrollTop = useRef(0);
  const [editing, setEditing] = useState<OfficialSalesOrderLine | null>(null);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, 'cancel' | 'delete'>>({});
  const [pendingLines, setPendingLines] = useState<PendingLineSummary[]>([]);
  const order = data.header.data;
  const lines = data.lines.data ?? [];
  useEffect(() => {
    if (!order) return;
    const key = `sales4app.existingOrderPendingLines.v1:${context.accountId}:${order.companyId}:${salesOrderNumber}`;
    try {
      const saved = sessionStorage.getItem(key);
      setPendingLines(saved ? (JSON.parse(saved) as PendingLineSummary[]) : []);
    } catch {
      setPendingLines([]);
    }
  }, [context.accountId, order?.companyId, salesOrderNumber]);
  const customer = useCustomerByAccount(editing ? order?.customerAccount ?? '' : '');
  const isCashCustomer = customer.data?.isCashAccount === true;
  const canEditCurrentPrice = editing
    ? canEditPersistedLinePrice(context.permissions, isCashCustomer, editing.isBonification === true)
    : false;
  const salesGroup = order?.salesGroup?.trim() || context.vendor?.id?.trim() || '';
  const locations = useInfiniteInventoryLocations(
    editing?.dataAreaId ?? order?.companyId ?? '',
    salesGroup,
    Boolean(editing),
  );
  const selectableLocations =
    warehouseId && !locations.items.some((location) => location.id === warehouseId)
      ? [{ id: warehouseId, name: 'Almacén actual' }, ...locations.items]
      : locations.items;
  const currentQuantity = Number(quantity);
  const currentPrice = editing?.isBonification ? 0 : Number(price);
  const normalizedWarehouseId = warehouseId.trim();
  const hasChanges = Boolean(
    editing &&
      (currentQuantity !== editing.quantity ||
        currentPrice !== editing.price ||
        normalizedWarehouseId !== editing.shippingWarehouseId.trim()),
  );
  const visibleLines = editing
    ? lines.filter((line) => line.lineNumber === editing.lineNumber)
    : lines;
  useEffect(() => {
    if (editing) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [editing]);
  const closeEditor = () => {
    setEditing(null);
    setQuantity('');
    setPrice('');
    setWarehouseId('');
    requestAnimationFrame(() => {
      if (linesViewportRef.current) linesViewportRef.current.scrollTop = linesScrollTop.current;
    });
  };
  const beginEdit = (line: OfficialSalesOrderLine) => {
    if (!Number.isFinite(line.lineNumber) || line.lineNumber <= 0) {
      setMessage('La fila seleccionada no contiene un LineNumber válido.');
      return;
    }
    linesScrollTop.current = linesViewportRef.current?.scrollTop ?? 0;
    if (!order || !canEditPersistedLine(order, line)) {
      setMessage('La orden o la línea no cumplen las reglas para edición.');
      return;
    }
    if (!line.inventoryLotId.trim()) {
      setMessage('Dynamics no proporcionó InventoryLotId para la línea seleccionada.');
      return;
    }
    setMessage(null);
    setEditing(line);
    setQuantity(String(line.quantity));
    setPrice(String(line.price));
    setWarehouseId(line.shippingWarehouseId);
  };
  const save = async () => {
    if (!editing || !order || locks.current.update) return;
    if (!canEditPersistedLine(order, editing)) {
      setMessage('La orden o la línea no cumplen las reglas para edición.');
      return;
    }
    const inventoryLotId = editing.inventoryLotId?.trim();
    if (!inventoryLotId) {
      setMessage(
        'Esta línea cumple las reglas comerciales para edición, pero no puede actualizarse desde Web porque el servicio de detalle no proporciona InventoryLotId.',
      );
      return;
    }
    const qty = Number(quantity),
      value = editing.isBonification ? 0 : Number(price);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage('La cantidad debe ser un número mayor que cero.');
      return;
    }
    if (!editing.isBonification && (!Number.isFinite(value) || value <= 0)) {
      setMessage('Cantidad y precio deben ser mayores que cero.');
      return;
    }
    const payload: {
      OrderedSalesQuantity?: number;
      SalesPrice?: number;
      ShippingWarehouseId?: string;
    } = {};
    if (qty !== editing.quantity) payload.OrderedSalesQuantity = qty;
    if (value !== editing.price) payload.SalesPrice = value;
    if (normalizedWarehouseId !== editing.shippingWarehouseId.trim())
      payload.ShippingWarehouseId = normalizedWarehouseId;
    if (!Object.keys(payload).length) {
      setMessage('No hay cambios para guardar.');
      return;
    }
    locks.current.update = true;
    try {
      await mutations.update.mutateAsync({
        companyId: editing.dataAreaId,
        salesOrderNumber,
        inventoryLotId,
        payload,
      });
      closeEditor();
      setMessage('Línea actualizada; se consultó nuevamente Dynamics.');
    } catch (e) {
      setMessage(
        `${userErrorMessage(e)}${isAmbiguousError(e) ? ' No fue posible determinar si Dynamics actualizó la línea.' : ''}`,
      );
    } finally {
      locks.current.update = false;
    }
  };
  const cancel = async (line: OfficialSalesOrderLine) => {
    const inventoryLotId = line.inventoryLotId?.trim();
    const lockKey = `cancel:${inventoryLotId}`;
    if (
      !order ||
      !inventoryLotId ||
      !canCancelPersistedLine(order, line) ||
      transactionalLocks.current.has(lockKey) ||
      !window.confirm(`¿Desea cancelar la línea ${line.lineNumber}?`)
    )
      return;
    transactionalLocks.current.add(lockKey);
    setPendingActions((current) => ({ ...current, [inventoryLotId]: 'cancel' }));
    try {
      const result = await mutations.cancel.mutateAsync({
        companyId: line.dataAreaId,
        inventoryLotId,
      });
      setMessage(
        result.success
          ? 'Cancelación aceptada; se actualizó el detalle.'
          : result.errorMessage || 'Dynamics no aceptó la cancelación.',
      );
    } catch (e) {
      setMessage(
        `${userErrorMessage(e)}${isAmbiguousError(e) ? ' No fue posible verificar el resultado de la cancelación; no se repetirá automáticamente.' : ''}`,
      );
    } finally {
      transactionalLocks.current.delete(lockKey);
      setPendingActions((current) => {
        const next = { ...current };
        delete next[inventoryLotId];
        return next;
      });
    }
  };
  const deleteLine = async (line: OfficialSalesOrderLine) => {
    const inventoryLotId = line.inventoryLotId?.trim();
    const lockKey = `delete:${inventoryLotId}`;
    if (
      !order ||
      !inventoryLotId ||
      !canDeletePersistedLine(order, line) ||
      transactionalLocks.current.has(lockKey) ||
      !window.confirm(
        `¿Desea eliminar la línea ${line.lineNumber}?\n\nEsta acción elimina la línea de la orden.`,
      )
    )
      return;
    transactionalLocks.current.add(lockKey);
    setPendingActions((current) => ({ ...current, [inventoryLotId]: 'delete' }));
    try {
      await mutations.delete.mutateAsync({ companyId: line.dataAreaId, inventoryLotId });
      setMessage('Línea eliminada; se consultó nuevamente Dynamics.');
    } catch (e) {
      setMessage(
        `${userErrorMessage(e)}${isAmbiguousError(e) ? ' No fue posible verificar si Dynamics eliminó la línea; no se repetirá automáticamente.' : ''}`,
      );
    } finally {
      transactionalLocks.current.delete(lockKey);
      setPendingActions((current) => {
        const next = { ...current };
        delete next[inventoryLotId];
        return next;
      });
    }
  };
  const confirm = async () => {
    if (
      locks.current.confirm ||
      !window.confirm(
        `Se enviará la solicitud de confirmación del pedido ${salesOrderNumber} a Dynamics 365.`,
      )
    )
      return;
    locks.current.confirm = true;
    try {
      const result = await mutations.confirm.mutateAsync();
      setMessage(
        !result.success
          ? result.errorMessage || 'Dynamics rechazó la solicitud.'
          : result.confirmed
            ? `Pedido confirmado${result.documentNumber ? ` · documento ${result.documentNumber}` : ''}.`
            : `Solicitud aceptada, pero el pedido continúa pendiente. ${result.debugMessage}`,
      );
    } catch (e) {
      setMessage(
        `${userErrorMessage(e)} No fue posible verificar el resultado de la confirmación.`,
      );
    } finally {
      locks.current.confirm = false;
    }
  };
  if (data.header.isLoading) return <LoadingState message="Cargando pedido..." />;
  if (data.header.isError)
    return (
      <ErrorState
        message="No se pudo cargar el encabezado."
        onRetry={() => data.header.refetch()}
      />
    );
  if (!order) return <EmptyState title="Pedido no encontrado" />;
  return (
    <div className="space-y-3">
      <button
        className="text-sm text-primary"
        onClick={() => navigate(`/pedidos${search.toString() ? `?${search}` : ''}`)}
      >
        ← Volver a pedidos
      </button>
      <Card className="px-4 py-3">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{order.salesOrderNumber}</h1>
            <p className="text-primary font-semibold">
              {order.customerAccount} · {order.customerName}
            </p>
          </div>
          <div className="text-right">
            <span className="border rounded-full px-2 py-1 text-xs">
              {statusLabel(order.status)}
            </span>
            <p className="font-bold mt-1">
              {order.currencyCode} {order.salesAmount.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="grid gap-x-4 gap-y-2 text-sm mt-3 sm:grid-cols-3">
          <p>
            Creación
            <br />
            <strong>{order.createdDate || '—'}</strong>
          </p>
          <p>
            Entrega
            <br />
            <strong>{order.deliveryDate || '—'}</strong>
          </p>
          <p>
            Vendedor
            <br />
            <strong>{order.salesGroup || '—'}</strong>
          </p>
          <p>
            Dirección
            <br />
            <strong>{order.address || '—'}</strong>
          </p>
          <p>
            Referencia
            <br />
            <strong>{order.customerReference || '—'}</strong>
          </p>
          <p>
            Acuerdo
            <br />
            <strong>{order.agreementId || 'Sin acuerdo'}</strong>
          </p>
        </div>
        {order.observations && <p className="text-sm mt-2">Observaciones: {order.observations}</p>}
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            navigate(
              `/pedidos/${encodeURIComponent(salesOrderNumber)}/adjuntos${search.toString() ? `?${search}` : ''}`,
            )
          }
        >
          Adjuntos
        </Button>
        {canAddOrderLine(order) && (
          <Button
            variant="outline"
            disabled={Boolean(editing)}
            onClick={() =>
              navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}/lineas/nueva`)
            }
          >
            Agregar línea
          </Button>
        )}
      </div>
      {message && (
        <div role="status" className="p-3 bg-amber-50 border rounded text-sm">
          {message}
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="p-3 flex items-center justify-between gap-2">
          <h2 className="font-bold">Líneas</h2>
          {canConfirmOrder(order, lines) && (
            <Button
              loading={mutations.confirm.isPending}
              disabled={Boolean(editing)}
              title={editing ? 'Finalice la edición antes de confirmar el pedido.' : undefined}
              onClick={confirm}
            >
              Confirmar pedido
            </Button>
          )}
        </div>
        {data.lines.isLoading && <LoadingState message="Cargando líneas..." />}
        {data.lines.isError && (
          <ErrorState
            message="No se pudieron consultar las líneas mediante POST /d365/sales/line/query."
            onRetry={() => data.lines.refetch()}
          />
        )}{' '}
        {!data.lines.isLoading && !lines.length && <EmptyState title="Sin líneas disponibles" />}
        <div
          ref={linesViewportRef}
          className={editing ? 'overflow-x-auto' : 'max-h-80 overflow-auto'}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-container">
              <tr>
                <th className="p-2 text-left">Producto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleLines.map((line) => {
                const inventoryLotId = line.inventoryLotId.trim();
                const pendingAction = pendingActions[inventoryLotId];
                const editReason = persistedLineDisabledReason('edit', order, line);
                const cancelReason = persistedLineDisabledReason('cancel', order, line);
                const deleteReason = persistedLineDisabledReason('delete', order, line);
                const rowBusy = Boolean(pendingAction);
                return (
                <tr
                  key={`${line.lineNumber}-${line.itemId}`}
                  className={`border-t ${editing ? 'bg-primary/5' : ''}`}
                >
                  <td className="p-2">
                    <strong>{line.itemId}</strong>
                    <small className="block">{line.itemName || line.itemId}</small>
                    <small className="block text-on-surface-variant">
                      Línea {line.lineNumber}
                      {line.shippingWarehouseId ? ` · Almacén ${line.shippingWarehouseId}` : ''}
                      {line.status ? ` · ${statusLabel(line.status)}` : ''}
                    </small>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {line.isBonification && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          Bonificación
                        </span>
                      )}
                      {line.status && (
                        <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold">
                          {canEditPersistedLine(order, line) ? 'Editable' : 'No editable'}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="text-center">{line.quantity}</td>
                  <td className="text-center">
                    {line.currencyCode || order.currencyCode} {line.price.toFixed(2)}
                  </td>
                  <td className="text-center">
                    {line.currencyCode || order.currencyCode} {line.lineAmount.toFixed(2)}
                  </td>
                  <td className="p-2">
                    {!editing && <div className="flex items-center gap-0.5">
                      <Tooltip title={editReason ?? 'Editar línea'}>
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Editar línea ${line.lineNumber}`}
                            disabled={rowBusy || Boolean(editReason)}
                            onClick={() => beginEdit(line)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={cancelReason ?? 'Cancelar línea'}>
                        <span>
                          <IconButton
                            size="small"
                            color="warning"
                            aria-label={`Cancelar línea ${line.lineNumber}`}
                            disabled={rowBusy || Boolean(cancelReason)}
                            onClick={() => cancel(line)}
                          >
                            {pendingAction === 'cancel' ? <CircularProgress size={18} /> : <BlockIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={deleteReason ?? 'Eliminar línea'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Eliminar línea ${line.lineNumber}`}
                            disabled={rowBusy || Boolean(deleteReason)}
                            onClick={() => deleteLine(line)}
                          >
                            {pendingAction === 'delete' ? <CircularProgress size={18} /> : <DeleteIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </div>}
                    {editing && <span className="text-xs font-semibold text-primary">Editando</span>}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {!editing && pendingLines.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <h2 className="font-bold">Líneas pendientes ({pendingLines.length})</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}/lineas/nueva`)}
            >
              Continuar
            </Button>
          </div>
          <div className="max-h-72 overflow-auto border-t">
            {pendingLines.map((line) => (
              <div key={line.localId} className="grid grid-cols-[1fr_auto] gap-3 border-b p-2 text-sm">
                <span><strong>{line.itemId}</strong> · {line.itemName}</span>
                <span>{line.quantity} × {line.currency} {line.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {editing && (
        <div ref={editorRef} className="scroll-mt-3">
        <Card className="p-4 space-y-3">
          <h2 className="font-bold">Editar {editing.itemId}</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              Producto<br />
              <strong>{editing.itemName || editing.itemId}</strong>
            </p>
            <p>
              Estado<br />
              <strong>{editing.status}</strong>
            </p>
          </div>
          <Input
            label="Cantidad"
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            label="Precio"
            type="number"
            step="any"
            value={price}
            disabled={!canEditCurrentPrice}
            onChange={(e) => setPrice(e.target.value)}
          />
          <div className="space-y-1">
            <p className="text-xs font-medium text-on-surface-variant">Almacén</p>
            <div className="rounded-lg border border-outline-variant p-2">
              <p className="text-sm font-semibold">
                {warehouseId || 'Sin almacén asignado'}
              </p>
              {locations.isFetching && !locations.isFetchingNextPage && (
                <p className="text-xs text-on-surface-variant">Buscando almacenes...</p>
              )}
              {!salesGroup && (
                <p className="text-xs text-error">
                  No se pudo determinar el grupo comercial para consultar almacenes.
                </p>
              )}
              {locations.isError && (
                <p className="text-xs text-error">
                  No fue posible consultar los almacenes disponibles.{' '}
                  <button className="underline" onClick={() => void locations.refetch()}>
                    Reintentar
                  </button>
                </p>
              )}
              {!locations.isFetching && !locations.isError && salesGroup && !selectableLocations.length && (
                <p className="text-xs text-on-surface-variant">
                  No se encontraron almacenes disponibles.
                </p>
              )}
              {selectableLocations.length > 0 && (
                <div
                  role="listbox"
                  aria-label="Almacenes disponibles"
                  className="mt-2 max-h-32 w-full max-w-full divide-y overflow-x-hidden overflow-y-auto rounded border border-outline-variant"
                >
                  {selectableLocations.map((location) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={warehouseId === location.id}
                      key={location.id}
                      className={`flex w-full items-center justify-between p-2 text-left text-sm ${warehouseId === location.id ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-surface-container'}`}
                      onClick={() => setWarehouseId(location.id)}
                    >
                      <span className="min-w-0 break-words">{location.id}{location.name ? ` · ${location.name}` : ''}</span>
                      {warehouseId === location.id && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                  {locations.hasNextPage && (
                    <Button
                      fullWidth
                      size="sm"
                      variant="outline"
                      loading={locations.isFetchingNextPage}
                      onClick={() => void locations.fetchNextPage()}
                    >
                      Cargar más almacenes
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          {!editing.isBonification && !canEditCurrentPrice && !customer.isLoading && (
            <p className="text-xs text-amber-700">
              Sin permiso Create Sales Orders → Price Sales Line → Editar.
            </p>
          )}
          {editing.isBonification && (
            <p className="text-xs text-amber-700">
              Línea bonificada: el precio permanece en cero y es de solo lectura.
            </p>
          )}
          {!editing.isBonification && customer.isLoading && (
            <p className="text-xs text-on-surface-variant">
              Verificando si el cliente es mostrador para determinar la edición del precio.
            </p>
          )}
          {!editing.isBonification && customer.isError && (
            <p className="text-xs text-amber-700">
              No se pudo verificar si el cliente es mostrador; el precio queda sujeto al permiso de menú.
            </p>
          )}
          {isCashCustomer && !editing.isBonification && (
            <p className="text-xs text-amber-700">
              Cliente mostrador: el precio es editable. Precio cero permanece bloqueado porque Web
              no puede verificar todavía un adjunto persistido con descripción “pago”.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              loading={mutations.update.isPending}
              disabled={!canSubmitPersistedLineUpdate(order, editing) || !hasChanges}
              title={!hasChanges ? 'No hay cambios para guardar.' : undefined}
              onClick={save}
            >
              Guardar
            </Button>
            <Button
              variant="outline"
              disabled={mutations.update.isPending}
              onClick={closeEditor}
            >
              Cancelar edición
            </Button>
          </div>
        </Card>
        </div>
      )}
    </div>
  );
};
export default OrderDetailPage;
