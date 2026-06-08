// ─── Navigation ───────────────────────────────────────────────────────────────
export type NavItem = {
  label: string;
  icon: string;
  href: string;
  active?: boolean;
};

// ─── User ─────────────────────────────────────────────────────────────────────
export type User = {
  name: string;
  role: string;
  avatarUrl?: string;
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export type StatCard = {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon: string;
  variant: 'primary' | 'secondary';
};

export type ActivityItem = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  iconBg: string;
};

export type QuickAction = {
  icon: string;
  label: string;
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export type OrderStatus = 'FACTURADO' | 'PENDIENTE' | 'BORRADOR' | 'CANCELADO';

export type Order = {
  id: string;
  status: OrderStatus;
  date: string;
  deliveryDate: string;
  clientCode: string;
  clientName: string;
  creditManagement: string;
  creditControl: string;
  group: string;
  currency: string;
  total: number;
};

export type OrderFilters = {
  from: string;
  to: string;
  status: string;
  creditManagement: string;
  client: string;
  salesGroup: string;
};

// ─── Order Detail ─────────────────────────────────────────────────────────────
export type ProductLine = {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type OrderDetail = {
  id: string;
  status: OrderStatus;
  clientName: string;
  date: string;
  site: string;
  vendor: string;
  creditManagement: string;
  deliveryStatus: string;
  lines: ProductLine[];
  notes: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  billingNit: string;
  billingAddress: string;
};

// ─── Clients ──────────────────────────────────────────────────────────────────
export type ClientStatus = 'ACTIVO' | 'BLOQUEADO';

export type Client = {
  code: string;
  name: string;
  status: ClientStatus;
  availableCredit: number;
  currency: string;
  creditLimit?: number;
  blockedReason?: string;
};

export type ClientAddress = {
  name: string;
  postalCode: string;
  city: string;
  country: string;
  tags: string[];
};

export type OrderHistoryItem = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
};

export type ClientDetail = {
  code: string;
  name: string;
  sector: string;
  creditLimit: number;
  currency: string;
  availablePercent: number;
  paymentTerm: string;
  paymentTermNote: string;
  location: string;
  locale: string;
  localeLabel: string;
  addresses: ClientAddress[];
  orderHistory: OrderHistoryItem[];
};

// ─── Inventory ────────────────────────────────────────────────────────────────
export type Product = {
  code: string;
  name: string;
  type: string;
};

export type InventoryDetail = {
  site: string;
  warehouse: string;
  available: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
};

// ─── Invoices ─────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'Cancelado' | 'Vigente' | 'Vencida';

export type Invoice = {
  id: string;
  status: InvoiceStatus;
  type: string;
  order: string;
  clientName: string;
  clientCode: string;
  pendingAmount: number;
  invoiceAmount: number;
  issueDate: string;
  dueDate: string;
  daysInfo: string;
  daysVariant: 'ok' | 'warning' | 'danger';
  currency: string;
};

export type InvoiceFilters = {
  salesGroup: string;
  clientAccount: string;
  startDate: string;
  endDate: string;
  hasPendingBalance: boolean;
};

// ─── App types (already defined inline in pages, kept for reference) ───────────
export type AppRoute =
  | '/' | '/pedidos' | '/pedidos/detalle' | '/clientes' | '/inventario'
  | '/facturas' | '/facturas/busqueda' | '/crear-pedido' | '/crear-pedido/linea'
  | '/estado-cuenta' | '/empresas' | '/vendedores' | '/soporte';
