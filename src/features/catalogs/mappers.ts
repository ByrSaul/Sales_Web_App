import type {
  Agreement,
  AgreementLine,
  City,
  Country,
  County,
  Customer,
  CustomerAddress,
  CustomerDto,
  DeliveryMode,
  DocumentTypes,
  InventoryItem,
  InventoryLocation,
  PageResult,
  Pagination,
  Price,
  Product,
  ProductVariant,
  PromotionGroup,
  SalesOrigin,
  State,
  VatNumber,
  ZipCode,
} from './types';
type Json = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => Number(v ?? 0);
const list = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
export const pagination = (v: unknown, perPage = 10): Pagination => {
  const j = (v ?? {}) as Json;
  return {
    currentPage: n(j.CurrentPage) || 1,
    perPage: n(j.PerPage) || perPage,
    fromRecord: n(j.FromRecord),
    toRecord: n(j.ToRecord),
    totalRecords: n(j.TotalRecords),
    totalPages: n(j.TotalPages),
  };
};
export const customer = (j: Json | CustomerDto): Customer => ({
  salesGroupId: s(j.commissionsalesgroupid),
  account: s(j.customeraccount),
  companyId: s(j.dataareaid),
  name: s(j.name),
  warehouseId: s(j.inventlocation),
  currency: s(j.salescurrencycode),
  paymentTerms: s(j.paymentterms),
  blocked: n(j.blocked),
  blockedDescription: s(j.blocked_description),
  partyNumber: s(j.partynumber),
  languageId: s(j.languageid),
  countryId: s(j.countryregionid),
  creditLimitUsd: n(j.usd_creditlimit),
  creditAvailableUsd: n(j.usd_creditavailable),
  isCashAccount: n(j.csfaiscashaccount) === 1,
});
export const customerAddress = (j: Json): CustomerAddress => ({
  locationId: s(j.addresslocationid),
  description: s(j.addressdescription),
  formattedAddress: s(j.formattedaddress),
  roles: s(j.addresslocationroles),
  countryId: s(j.addresscountryregionid),
  recId: n(j.recid),
});
export const product = (j: Json): Product => ({
  itemId: s(j.itemid),
  name: s(j.name),
  productType: s(j.producttype),
  dimensionGroup: s(j.dimensiongroup),
  requiresVariant: s(j.producttype) === 'MasterProduct',
});
export const variant = (j: Json): ProductVariant => ({
  itemId: s(j.itemid),
  displayProductNumber: s(j.displayproductnumber),
  name: s(j.name),
  dimensionGroup: s(j.dimensiongroup),
  configId: s(j.configid),
  colorId: s(j.inventcolorid),
  sizeId: s(j.inventsizeid),
  styleId: s(j.inventstyleid),
  versionId: s(j.inventversionid),
});
export const inventory = (j: Json): InventoryItem => ({
  companyId: s(j.dataareaid),
  itemId: s(j.itemid),
  displayProductNumber: s(j.displayproductnumber),
  productName: s(j.productname),
  itemGroupId: s(j.itemgroupid),
  activeIngredientId: s(j.csfaactiveingredientid),
  siteId: s(j.inventsiteid),
  warehouseId: s(j.inventlocationid),
  physical: n(j.physicalinvent),
  availablePhysical: n(j.availphysical),
  onOrder: n(j.onorder),
  reservedOrdered: n(j.reservordered),
  ordered: n(j.orderedsum),
  availableOrdered: n(j.availordered),
  totalAvailable: n(j.totalavailable),
  configId: s(j.configid),
  colorId: s(j.inventcolorid),
  sizeId: s(j.inventsizeid),
  styleId: s(j.inventstyleid),
  versionId: s(j.inventversionid),
});
export const inventoryLocation = (j: Json): InventoryLocation => ({
  id: s(j.inventlocationid),
  name: s(j.name),
});
export const price = (j: Json): Price => ({
  success: Boolean(j.Success),
  errorMessage: s(j.ErrorMessage),
  debugMessage: s(j.DebugMessage),
  currency: s(j.Currencycode),
  exchangeRate: n(j.ExchangeRate),
  price: n(j.Price),
  lineDiscount: n(j.SalesLineDisc),
  linePercent: n(j.SalesLinePercent),
  priceUnit: n(j.PriceUnit),
  markup: n(j.PriceMarkup),
  discountPct1: n(j.DiscPct1),
  discountPct2: n(j.DiscPct2),
});
export const deliveryMode = (j: Json): DeliveryMode => ({ code: s(j.code), description: s(j.txt) });
export const salesOrigin = (j: Json): SalesOrigin => ({
  id: s(j.originid),
  description: s(j.description),
});
export const agreement = (j: Json): Agreement => ({
  title: s(j.documenttitle),
  customerAccount: s(j.custaccount),
  companyId: s(j.customerdataareaid),
  number: s(j.salesnumbersequence),
  classification: s(j.agreementclassification),
  currency: s(j.currency),
  expirationDate: s(j.defaultagreementlineexpirationdate),
  lineTypeDescription: s(j.defaultagreementlinetypeDescription),
  recId: n(j.recid),
});
export const agreementLine = (j: Json): AgreementLine => ({
  lineNumber: n(j.linenumber),
  matchingLine: n(j.matchingagreementline),
  itemId: s(j.itemid),
  displayProductNumber: s(j.displayproductnumber),
  name: s(j.name),
  currency: s(j.currency),
  siteId: s(j.inventsiteid),
  warehouseId: s(j.inventlocationid),
  configId: s(j.configid),
  colorId: s(j.inventcolorid),
  sizeId: s(j.inventsizeid),
  styleId: s(j.inventstyleid),
  versionId: s(j.inventversionid),
  committedQuantity: n(j.commitedquantityqty),
  totalQuantity: n(j.totalqty),
  lineQuantity: n(j.qtyline),
  price: n(j.price),
});
export const promotion = (j: Json): PromotionGroup => ({
  companyId: s(j.dataareaid),
  groupId: s(j.groupid),
  name: s(j.name),
  recId: n(j.recid),
  forecastDiscount: n(j.faforecastdiscount),
});
export const country = (j: Json): Country => ({
  id: s(j.CountryRegionId),
  longName: s(j.LongName),
  shortName: s(j.ShortName),
});
export const state = (j: Json): State => ({ id: s(j.State), name: s(j.Name) });
export const county = (j: Json): County => ({ id: s(j.CountyId), description: s(j.Description) });
export const city = (j: Json): City => ({ id: s(j.Name), description: s(j.Description) });
export const zip = (j: Json): ZipCode => ({
  code: s(j.ZipCode),
  countryId: s(j.CountryRegionId),
  stateId: s(j.State),
  countyId: s(j.County),
  cityId: s(j.City),
});
export const vat = (j: Json): VatNumber => ({
  companyId: s(j.dataAreaId),
  vatNumber: s(j.VATNum),
  countryId: s(j.CountryRegionId),
  name: s(j.Name),
  documentType: s(j.DocumentTypeIdentificationId),
});
export const documentTypes = (j: Json): DocumentTypes => {
  const o = (j['@odata'] ?? {}) as Json;
  return {
    documentTypes: list(o.DocType)
      .map((x) => s(x.DocumentTypeIdentificationId))
      .filter(Boolean),
    felPanama: list(o.FelPA)
      .map((x) => s(x.CS_FEL_RUCChecker_PA))
      .filter(Boolean),
    felElSalvador: list(o.FelSV)
      .map((x) => s(x.CS_FEL_PersonType_SV))
      .filter(Boolean),
  };
};
export const pageResult = <T>(items: T[], meta: unknown, perPage?: number): PageResult<T> => ({
  items,
  pagination: pagination(meta, perPage),
});
export { list };
