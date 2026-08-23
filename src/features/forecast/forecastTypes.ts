export type ForecastView = 'all' | 'qty' | 'amount' | 'volume';
export type ForecastFilters = {
  from: string;
  to: string;
  item: string;
  variant: string;
  customer: string;
  view: ForecastView;
  page: number;
};
export type ForecastRow = {
  salesGroup: string;
  salesGroupName: string;
  customer: string;
  itemId: string;
  variant: string;
  salesQuantity: number | null;
  salesAmount: number | null;
  salesVolume: number | null;
  budgetQuantity: number | null;
  budgetAmount: number | null;
  budgetVolume: number | null;
  projectionQuantity: number | null;
  projectionAmount: number | null;
  projectionVolume: number | null;
};
