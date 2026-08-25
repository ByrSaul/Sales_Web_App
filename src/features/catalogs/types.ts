/** Metadatos normalizados de una respuesta paginada. */
export type Pagination = {
  currentPage: number;
  perPage: number;
  fromRecord: number;
  toRecord: number;
  totalRecords: number;
  totalPages: number;
};
/** Cliente normalizado utilizado por consultas, selectores y pedidos. */
export type Customer = {
  salesGroupId: string;
  account: string;
  companyId: string;
  name: string;
  warehouseId: string;
  currency: string;
  paymentTerms: string;
  blocked: number;
  blockedDescription: string;
  partyNumber: string;
  languageId: string;
  countryId: string;
  creditLimitUsd: number;
  creditAvailableUsd: number;
  isCashAccount: boolean;
};
/** Información resumida de cliente devuelta por el backend. */
export type CustomerDto = {
  commissionsalesgroupid: string;
  customeraccount: string;
  dataareaid: string;
  name: string;
  inventlocation: string;
  salescurrencycode: string;
  paymentterms: string;
  blocked: number;
  blocked_description: string;
  partynumber: string;
  languageid: string;
  countryregionid: string;
  usd_creditlimit: number;
  usd_creditavailable: number;
  csfaiscashaccount: number;
};
/** Contrato paginado recibido desde `POST /customer/data`. */
export type CustomerSearchResponseDto = {
  customers: CustomerDto[];
  pagination: {
    CurrentPage: number;
    PerPage: number;
    FromRecord: number;
    ToRecord: number;
    TotalRecords: number;
    TotalPages: number;
  };
};
/** Dirección postal y roles registrados para un cliente. */
export type CustomerAddress = {
  locationId: string;
  description: string;
  formattedAddress: string;
  roles: string;
  countryId: string;
  recId: number;
};
/** Producto comercial disponible en el catálogo activo. */
export type Product = {
  itemId: string;
  name: string;
  productType: string;
  dimensionGroup: string;
  requiresVariant: boolean;
};
/** Combinación de dimensiones válida para un producto. */
export type ProductVariant = {
  itemId: string;
  displayProductNumber: string;
  name: string;
  dimensionGroup: string;
  configId: string;
  colorId: string;
  sizeId: string;
  styleId: string;
  versionId: string;
};
/** Existencia de producto asociada a almacén, ubicación y dimensiones. */
export type InventoryItem = {
  companyId: string;
  itemId: string;
  displayProductNumber: string;
  productName: string;
  itemGroupId: string;
  activeIngredientId: string;
  siteId: string;
  warehouseId: string;
  physical: number;
  availablePhysical: number;
  onOrder: number;
  reservedOrdered: number;
  ordered: number;
  availableOrdered: number;
  totalAvailable: number;
  configId: string;
  colorId: string;
  sizeId: string;
  styleId: string;
  versionId: string;
};
export type InventoryLocation = { id: string; name: string };
export type Price = {
  success: boolean;
  errorMessage: string;
  debugMessage: string;
  currency: string;
  exchangeRate: number;
  price: number;
  lineDiscount: number;
  linePercent: number;
  priceUnit: number;
  markup: number;
  discountPct1: number;
  discountPct2: number;
};
export type DeliveryMode = { code: string; description: string };
export type SalesOrigin = { id: string; description: string };
/** Encabezado de convenio comercial aplicable a un cliente. */
export type Agreement = {
  title: string;
  customerAccount: string;
  companyId: string;
  number: string;
  classification: string;
  currency: string;
  expirationDate: string;
  lineTypeDescription: string;
  recId: number;
};
/** Línea de producto y condiciones perteneciente a un convenio comercial. */
export type AgreementLine = {
  lineNumber: number;
  matchingLine: number;
  itemId: string;
  displayProductNumber: string;
  name: string;
  currency: string;
  siteId: string;
  warehouseId: string;
  configId: string;
  colorId: string;
  sizeId: string;
  styleId: string;
  versionId: string;
  committedQuantity: number;
  totalQuantity: number;
  lineQuantity: number;
  price: number;
};
export type PromotionGroup = {
  companyId: string;
  groupId: string;
  name: string;
  recId: number;
  forecastDiscount: number;
};
export type Country = { id: string; longName: string; shortName: string };
export type State = { id: string; name: string };
export type County = { id: string; description: string };
export type City = { id: string; description: string };
export type ZipCode = {
  code: string;
  countryId: string;
  stateId: string;
  countyId: string;
  cityId: string;
};
/** Identificador fiscal registrado para un país y tipo documental. */
export type VatNumber = {
  companyId: string;
  vatNumber: string;
  countryId: string;
  name: string;
  documentType: string;
  taxVatAddress?: string;
  taxpayerTypePanama?: string;
  rucCheckerPanama?: string;
  personTypeElSalvador?: string;
};
export type DocumentTypes = {
  documentTypes: string[];
  felPanama: string[];
  felElSalvador: string[];
};
/** Resultado genérico compuesto por elementos y metadatos de paginación. */
export type PageResult<T> = { items: T[]; pagination: Pagination };
