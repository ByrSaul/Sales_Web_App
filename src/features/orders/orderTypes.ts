import type { Pagination } from '../catalogs/types';
export type SalesOrderStatus =
  'Orden Abierta' | 'Entregado' | 'Facturado' | 'Cancelado' | 'None' | string;
export type OrderFilters = {
  customer: string;
  status: string;
  creditControl: string;
  from: string;
  to: string;
  page: number;
  perPage: number;
};
export type ExistingOrder = {
  companyId: string;
  salesOrderNumber: string;
  currencyCode: string;
  createdDate: string;
  deliveryDate: string;
  status: SalesOrderStatus;
  customerAccount: string;
  customerName: string;
  salesGroup: string;
  paymentTerms: string;
  creditManagement: string;
  creditStatus: string;
  salesAmount: number;
  address: string;
  deliveryCountryRegionId?: string;
  confirmDocumentNumber: string;
  observations: string;
  customerReference: string;
  matchingAgreement: number | null;
  agreementId: string;
};
export type ExistingOrderLine = {
  lineNumber: number;
  itemId: string;
  displayProductNumber: string;
  quantity: number;
  lineAmount: number;
  price: number;
  itemName: string;
  inventoryLotId?: string;
  status?: string;
  isBonification?: boolean;
  matchingAgreementLine?: number | null;
  shippingSiteId?: string;
  shippingWarehouseId?: string;
  configurationId?: string;
  colorId?: string;
  sizeId?: string;
  styleId?: string;
  versionId?: string;
};
export type OfficialSalesOrderLine = {
  dataAreaId: string;
  salesOrderNumber: string;
  lineNumber: number;
  inventoryLotId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  lineAmount: number;
  currencyCode: string;
  salesUnitSymbol: string;
  status: string;
  isBonification: boolean;
  suppItemGroupId: string;
  matchingAgreementLine: number | null;
  shippingSiteId: string;
  shippingWarehouseId: string;
  configurationId: string;
  colorId: string;
  sizeId: string;
  styleId: string;
  versionId: string;
  lineDiscountPercentage: number;
};
export type OrdersResult = { items: ExistingOrder[]; pagination: Pagination };
export type ConfirmationResult = {
  success: boolean;
  confirmed: boolean;
  errorMessage: string;
  debugMessage: string;
  documentNumber: string;
  sentToCreditManagement: boolean;
};
export type CancelResult = {
  success: boolean;
  errorMessage: string;
  debugMessage: string;
  salesOrderNumber: string;
};
export type UpdateLineInput = {
  companyId: string;
  salesOrderNumber: string;
  inventoryLotId: string;
  payload?: {
    OrderedSalesQuantity?: number;
    SalesPrice?: number;
    ShippingWarehouseId?: string;
  };
  /** Legacy caller compatibility; the persisted-line editor uses payload. */
  quantity?: number;
  price?: number;
};
