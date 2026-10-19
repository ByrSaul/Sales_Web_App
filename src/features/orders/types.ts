import type { OrderDraft, OrderDraftLine } from "../orderDraft/types";

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
  FABonification: "0" | "1";
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
  | "idle"
  | "validating"
  | "creating-header"
  | "header-created"
  | "uploading-attachments"
  | "creating-lines"
  | "recovering"
  | "awaiting-confirmation"
  | "partial-failure"
  | "completed"
  | "failed";
export type SubmissionLineStatus =
  | "pending"
  | "creating"
  | "created"
  | "failed"
  | "unconfirmed";
/**
 * Seguimiento local de la idempotencia de una creación (encabezado o línea).
 *
 * `processing`, `completed` y `failed` reflejan los estados reales del Backend
 * (`Processing`, `Completed`, `Failed`). `awaiting-confirmation` es un estado exclusivamente local:
 * la clave se envió y todavía no se conoce el resultado (timeout, red, 5xx o recarga en curso).
 * `rejected` es un 4xx sin aplicar la operación y `mismatch` una clave usada con otro body.
 */
export type OperationTracking =
  | "not-sent"
  | "awaiting-confirmation"
  | "processing"
  | "completed"
  | "failed"
  | "rejected"
  | "mismatch";
export type SubmissionLine = {
  localId: string;
  /**
   * Clave `Idempotency-Key` de la creación de esta línea. Se genera al iniciar la ejecución,
   * se persiste antes del POST y nunca se renueva para eludir un resultado desconocido; solo se
   * reemplaza cuando el Backend confirmó `Failed` o un rechazo 4xx y el usuario pide reintentar.
   */
  idempotencyKey: string;
  tracking: OperationTracking;
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
  /**
   * Clave `Idempotency-Key` del encabezado. Se persiste antes del POST y nunca se renueva
   * automáticamente; un encabezado ambiguo solo se reenvía con esta misma clave para que el
   * Backend devuelva el resultado original. `null` en recuperaciones anteriores a la clave.
   */
  headerIdempotencyKey: string | null;
  /** Seguimiento de la idempotencia del encabezado (ver `OperationTracking`). */
  headerTracking: OperationTracking;
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
export type SubmissionResult = {
  submission: OrderSubmission;
  completed: boolean;
};
/**
 * Vista de solo lectura de `GET /d365/idempotency/{key}?dataAreaId=` (fa-sales4app-proxy,
 * `IdempotencyService.describe`). Se usa exclusivamente para decidir si una nueva solicitud con
 * otra clave es segura; la consulta de estado sigue siendo el POST original.
 */
export type IdempotencyStatusView = {
  status: "Processing" | "Completed" | "Failed";
  dynamicsEffect: "CREATED" | "NONE" | "UNKNOWN";
  newRequestAllowed: boolean;
  salesOrderNumber: string | null;
  lineReference: string | null;
};
/** Puerto de infraestructura requerido por el ejecutor de envío de pedidos. */
export interface OrderSubmissionGateway {
  createHeader(
    request: SalesHeaderRequest,
    idempotencyKey: string,
  ): Promise<SalesHeaderResponse>;
  createNormalLine(
    request: SalesLineRequest,
    idempotencyKey: string,
  ): Promise<ExistingSalesLine[]>;
  createAgreementLine(
    request: AgreementLineRequest,
    idempotencyKey: string,
  ): Promise<ExistingSalesLine[]>;
  getExistingLines(
    companyId: string,
    salesOrderNumber: string,
  ): Promise<ExistingSalesLine[]>;
  uploadAttachment?(
    companyId: string,
    salesOrderNumber: string,
    file: File,
    description: string,
  ): Promise<void>;
  listAttachments?(
    companyId: string,
    salesOrderNumber: string,
  ): Promise<import("../attachments/attachmentTypes").OrderAttachment[]>;
  /** `null` cuando el Backend confirma que la clave nunca se registró. */
  getIdempotencyStatus?(
    companyId: string,
    idempotencyKey: string,
  ): Promise<IdempotencyStatusView | null>;
}
