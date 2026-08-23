import type { Pagination } from '../catalogs/types';
export type SalesOrderStatus = 'Orden Abierta' | 'Entregado' | 'Facturado' | 'Cancelado' | 'None' | string;
export type OrderFilters = { customer: string; status: string; creditControl: string; from: string; to: string; page: number; perPage: number };
export type ExistingOrder = { companyId: string; salesOrderNumber: string; currencyCode: string; createdDate: string; deliveryDate: string; status: SalesOrderStatus; customerAccount: string; customerName: string; salesGroup: string; paymentTerms: string; creditManagement: string; creditStatus: string; salesAmount: number; address: string; confirmDocumentNumber: string; observations: string; customerReference: string; matchingAgreement: number | null; agreementId: string };
export type ExistingOrderLine = { lineNumber: number; itemId: string; displayProductNumber: string; quantity: number; lineAmount: number; price: number; itemName: string; inventoryLotId: string; status: string; isBonification: boolean; matchingAgreementLine: number | null };
export type OrdersResult = { items: ExistingOrder[]; pagination: Pagination };
export type ConfirmationResult = { success: boolean; confirmed: boolean; errorMessage: string; debugMessage: string; documentNumber: string; sentToCreditManagement: boolean };
export type CancelResult = { success: boolean; errorMessage: string; debugMessage: string; salesOrderNumber: string };
export type UpdateLineInput = { companyId: string; salesOrderNumber: string; inventoryLotId: string; quantity: number; price: number };
