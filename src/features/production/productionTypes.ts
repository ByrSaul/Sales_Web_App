export type ProductionMode = 'orders' | 'daily';
/** Filtros compartidos por las vistas de producción disponibles. */
export type ProductionFilters = {
  mode: ProductionMode;
  customer: string;
  item: string;
  status: string;
  from: string;
  to: string;
  delivery: string;
  page: number;
};
export type Pagination = {
  currentPage: number;
  perPage: number;
  totalPages: number;
  totalRecords: number;
};
/** Registro de producción asociado a una orden de venta. */
export type SalesProduction = {
  companyId: string;
  salesGroup: string;
  customer: string;
  salesStatus: string;
  salesId: string;
  productionId: string;
  itemId: string;
  bomId: string;
  productionStatus: number;
  poolId: string;
  name: string;
  scheduledQuantity: number;
  backorderStatus: string;
};
/** Resumen agregado de producción para una fecha determinada. */
export type DailyProduction = {
  started: string;
  finished: string;
  area: string;
  productionId: string;
  bomId: string;
  quantity: number;
  itemId: string;
  type: string;
  status: string;
  description: string;
  presentation: number;
  kiloliters: number;
  activeIngredient: string;
  line: string;
  customerAccount: string;
  destination: string;
  customerName: string;
  country: string;
  year: number;
  month: number;
};
