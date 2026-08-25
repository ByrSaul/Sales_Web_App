import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { catalogService } from '../catalogs/catalogService';
import { orderQueryService } from '../orders/orderQueryService';
import type { OrderFilters } from '../orders/orderTypes';

const localDate = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const orderFilters = (from: string, to: string, status = '', perPage = 1): OrderFilters => ({
  customer: '',
  status,
  creditControl: '',
  from,
  to,
  page: 1,
  perPage,
});

export const dashboardKeys = {
  ordersToday: (company: string, vendor: string, today: string) =>
    ['dashboard', 'orders-today', company, vendor, today] as const,
  openOrders: (company: string, vendor: string) =>
    ['dashboard', 'open-orders', company, vendor] as const,
  recentOrders: (company: string, vendor: string, from: string, to: string) =>
    ['dashboard', 'recent-orders', company, vendor, from, to] as const,
  customers: (company: string, vendor: string) =>
    ['dashboard', 'assigned-customers', company, vendor] as const,
};

export const useDashboardData = () => {
  const { api, context } = useSession();
  const company = context.company?.id ?? '';
  const vendor = context.vendor?.id ?? '';
  const today = localDate(new Date());
  const recentStartDate = new Date();
  recentStartDate.setDate(recentStartDate.getDate() - 30);
  const recentFrom = localDate(recentStartDate);
  const enabled = Boolean(company && vendor);
  const orders = orderQueryService(api);

  return {
    today: useQuery({
      queryKey: dashboardKeys.ordersToday(company, vendor, today),
      queryFn: ({ signal }) => orders.list(company, vendor, orderFilters(today, today), signal),
      enabled,
      staleTime: 30_000,
    }),
    open: useQuery({
      queryKey: dashboardKeys.openOrders(company, vendor),
      queryFn: ({ signal }) =>
        orders.list(company, vendor, orderFilters('', '', 'Orden Abierta'), signal),
      enabled,
      staleTime: 30_000,
    }),
    recent: useQuery({
      queryKey: dashboardKeys.recentOrders(company, vendor, recentFrom, today),
      queryFn: ({ signal }) =>
        orders.list(company, vendor, orderFilters(recentFrom, today, '', 5), signal),
      enabled,
      staleTime: 30_000,
    }),
    customers: useQuery({
      queryKey: dashboardKeys.customers(company, vendor),
      queryFn: ({ signal }) =>
        catalogService(api).customers({
          company,
          salesGroup: vendor,
          search: '',
          page: 1,
          perPage: 1,
          signal,
        }),
      enabled,
      staleTime: 30_000,
    }),
  };
};
