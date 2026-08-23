import type { ExistingOrder, ExistingOrderLine } from './orderTypes';
import type { MenuPermission } from '../../core/session/types';
const open = (status: string) => ['orden abierta', 'open', 'backorder'].includes(status.trim().toLowerCase());
export const canModifyOrder = (order: ExistingOrder) => open(order.status);
export const canAddOrderLine = (order: ExistingOrder) => canModifyOrder(order);
export const canEditOrderLine = (order: ExistingOrder, line: ExistingOrderLine) => canModifyOrder(order) && !line.status.toLowerCase().includes('facturado') && !line.status.toLowerCase().includes('invoiced') && Boolean(line.inventoryLotId);
export const canCancelOrderLine = canEditOrderLine;
export const canConfirmOrder = (order: ExistingOrder, lines: ExistingOrderLine[]) => open(order.status) && lines.length > 0 && !order.confirmDocumentNumber;
export const canEditPrice = (permissions: MenuPermission[]): boolean => { const find = (nodes: MenuPermission[], name: string): MenuPermission | undefined => { for (const node of nodes) { if (node.menu === name) return node; const child = find(node.children, name); if (child) return child; } }; const root = find(permissions, 'Create Sales Orders'); const price = root ? find(root.children, 'Price Sales Line') : undefined; return price?.permissionLevel === 'Editar'; };
