import type { OrderDraft, OrderDraftLine } from '../orderDraft/types';

/** Contrato enviado a `POST /d365/sales` para crear el encabezado. */
export type SalesHeaderRequest = {
  dataAreaId: string;
  CurrencyCode: string;
  LanguageId: string;
  InvoiceCustomerAccountNumber: string;
  OrderingCustomerAccountNumber: string;
  OrderResponsiblePersonnelNumber: string;
  DeliveryAddressLocationId: string;
  FADlvMode?: string;
  RequestedShippingDate?: string;
  ConfirmedShippingDate?: string;
  MatchingAgreement?: number;
  CSFASalesAgreementId?: string;
  CommissionSalesRepresentativeGroupId?: string;
  TaxExemptNumber?: string;
  SalesOrderName?: string;
  SalesOrderOriginCode?: string;
  Observations?: string;
  CustomersOrderReference?: string;
};
/** Respuesta normalizada después de crear el encabezado de venta. */
export type SalesHeaderResponse = {
  dataAreaId: string;
  salesOrderNumber: string;
  salesOrderName: string;
  salesOrderStatus: string;
  customerAccount: string;
  paymentTermsName: string;
};
/** Contrato base enviado para crear una línea normal de venta. */
export type SalesLineRequest = {
  dataAreaId: string;
  SalesOrderNumber: string;
  ItemNumber: string;
  ProductConfigurationId: string;
  ProductStyleId: string;
  ProductSizeId: string;
  ProductColorId: string;
  ProductVersionId: string;
  SalesPrice: number;
  OrderedSalesQuantity: number;
  ShippingSiteId: string;
  ShippingWarehouseId: string;
  CSFASuppItemGroupId?: string;
  FABonification: '0' | '1';
};
/** Contrato de línea que incorpora la referencia al convenio comercial. */
export type AgreementLineRequest = SalesLineRequest & {
  ChangeShippingWarehouseId: string;
  MatchingAgreementLine: number;
};
export type ExistingSalesLine = {
  lineNumber: number;
  itemNumber: string;
  productConfigurationId: string;
  productStyleId: string;
  productSizeId: string;
  productColorId: string;
  productVersionId: string;
  salesPrice: number;
  orderedSalesQuantity: number;
  shippingSiteId: string;
  shippingWarehouseId: string;
  csfaSuppItemGroupId: string;
  faBonification: string;
};
export type SubmissionStatus =
  | 'idle'
  | 'validating'
  | 'creating-header'
  | 'header-created'
  | 'uploading-attachments'
  | 'creating-lines'
  | 'recovering'
  | 'partial-failure'
  | 'completed'
  | 'failed';
export type SubmissionLineStatus = 'pending' | 'creating' | 'created' | 'failed';
export type SubmissionLine = {
  localId: string;
  status: SubmissionLineStatus;
  attempts: number;
  error: string | null;
  backendLineNumber: number | null;
  draftLine: OrderDraftLine;
};
/** Estado persistible del proceso de envío y reconciliación de un pedido. */
export type OrderSubmission = {
  schemaVersion: 1;
  accountId: string;
  companyId: string;
  draftId: string;
  salesOrderNumber: string | null;
  status: SubmissionStatus;
  headerAmbiguous: boolean;
  createdAt: string;
  updatedAt: string;
  snapshot: OrderDraft;
  lines: SubmissionLine[];
  attachmentNames?: string[];
  createdAttachmentIds?: string[];
  attachmentError?: string | null;
  attachmentRetryAllowed?: boolean;
  error: string | null;
};
export type SubmissionAttachmentInput = {
  localId: string;
  file: File;
  description: string;
};
export type SubmissionResult = { submission: OrderSubmission; completed: boolean };
/** Puerto de infraestructura requerido por el ejecutor de envío de pedidos. */
export interface OrderSubmissionGateway {
  createHeader(request: SalesHeaderRequest): Promise<SalesHeaderResponse>;
  createNormalLine(request: SalesLineRequest): Promise<ExistingSalesLine[]>;
  createAgreementLine(request: AgreementLineRequest): Promise<ExistingSalesLine[]>;
  getExistingLines(companyId: string, salesOrderNumber: string): Promise<ExistingSalesLine[]>;
  uploadAttachment?(companyId: string, salesOrderNumber: string, file: File, description: string): Promise<void>;
  listAttachments?(companyId: string, salesOrderNumber: string): Promise<import('../attachments/attachmentTypes').OrderAttachment[]>;
}
