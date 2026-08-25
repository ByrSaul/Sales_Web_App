import type { ExistingOrder, ExistingOrderLine, OfficialSalesOrderLine } from './orderTypes';
import type { MenuPermission } from '../../core/session/types';
const open = (status: string) =>
  ['orden abierta', 'open', 'backorder'].includes(status.trim().toLowerCase());
/** Indica si el estado actual permite considerar abierto un pedido. */
export const isOrderOpen = (order: ExistingOrder) => open(order.status);
export const canModifyOrder = (order: ExistingOrder) => isOrderOpen(order);
export const canAddOrderLine = (order: ExistingOrder) => canModifyOrder(order);
type PersistedLineRuleData = Pick<
  ExistingOrderLine | OfficialSalesOrderLine,
  'status' | 'inventoryLotId' | 'isBonification'
>;
export const isPersistedLineInvoiced = (line: PersistedLineRuleData) => {
  const status = line.status?.trim().toLowerCase() ?? '';
  return status.includes('facturado') || status.includes('invoiced');
};
export const isPersistedLineOpen = (line: PersistedLineRuleData) =>
  line.status?.trim().toLowerCase() === 'orden abierta';
const canActOnPersistedLine = (order: ExistingOrder, line: PersistedLineRuleData) =>
  isOrderOpen(order) &&
  isPersistedLineOpen(line) &&
  Boolean(line.inventoryLotId?.trim());
/** Evalúa si una línea persistida puede editarse según pedido y facturación. */
export const canEditPersistedLine = (order: ExistingOrder, line: PersistedLineRuleData) =>
  canActOnPersistedLine(order, line) && line.isBonification !== true;
export const canCancelPersistedLine = (order: ExistingOrder, line: PersistedLineRuleData) =>
  canActOnPersistedLine(order, line);
export const canDeletePersistedLine = (order: ExistingOrder, line: PersistedLineRuleData) =>
  canActOnPersistedLine(order, line);
export const canSubmitPersistedLineUpdate = (
  order: ExistingOrder,
  line: PersistedLineRuleData,
) => canEditPersistedLine(order, line);
// Alias de compatibilidad; el encabezado no forma parte de la regla Mobile para abrir el editor.
export const canEditOrderLine = (order: ExistingOrder, line: ExistingOrderLine) =>
  canEditPersistedLine(order, line);
// Cancelar es una capacidad Web adicional. Conserva la protección previa del encabezado abierto.
export const canCancelOrderLine = (order: ExistingOrder, line: PersistedLineRuleData) =>
  canCancelPersistedLine(order, line);
export type PersistedLineAction = 'edit' | 'cancel' | 'delete';
/** Explica por qué una acción sobre una línea persistida no está disponible. */
export const persistedLineDisabledReason = (
  action: PersistedLineAction,
  order: ExistingOrder,
  line: PersistedLineRuleData,
) => {
  if (!isOrderOpen(order)) return 'La orden no est\u00e1 abierta.';
  if (!isPersistedLineOpen(line)) return 'La l\u00ednea no est\u00e1 en estado Orden abierta.';
  if (!line.inventoryLotId?.trim()) return 'La l\u00ednea no contiene InventoryLotId.';
  if (action === 'edit' && line.isBonification === true)
    return 'La l\u00ednea es una bonificaci\u00f3n y no admite edici\u00f3n.';
  return null;
};
/** Indica si el pedido contiene líneas y está en estado confirmable. */
export const canConfirmOrder = (order: ExistingOrder, lines: readonly unknown[]) =>
  open(order.status) && lines.length > 0 && !order.confirmDocumentNumber;
/** Evalúa los permisos operativos necesarios para modificar precios. */
export const canEditPrice = (permissions: MenuPermission[]): boolean => {
  const find = (nodes: MenuPermission[], name: string): MenuPermission | undefined => {
    for (const node of nodes) {
      if (node.menu === name) return node;
      const child = find(node.children, name);
      if (child) return child;
    }
  };
  const root = find(permissions, 'Create Sales Orders');
  const price = root ? find(root.children, 'Price Sales Line') : undefined;
  return price?.permissionLevel === 'Editar';
};
export const canEditPersistedLinePrice = (
  permissions: MenuPermission[],
  isCashCustomer: boolean,
  isBonification: boolean,
) => !isBonification && (isCashCustomer || canEditPrice(permissions));
