import type {
  AgingBucket,
  Invoice,
  InvoiceResult,
  Pagination,
  PdfReport,
  StatementDocument,
  StatementSummary,
} from './billingTypes';
type Json = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const pagination = (j: Json): Pagination => ({
  currentPage: n(j.CurrentPage ?? j.current_page ?? j.page) || 1,
  perPage: n(j.PerPage ?? j.perpage) || 10,
  totalPages: n(j.TotalPages ?? j.total_pages) || 1,
  totalRecords: n(j.TotalRecords ?? j.total_records),
  hasMore: Boolean(j.HasMore ?? j.has_more),
});
export const mapInvoice = (j: Json): Invoice => ({
  salesId: s(j.salesid),
  customerAccount: s(j.invoiceaccount),
  customerName: s(j.invoicingname),
  invoiceId: s(j.invoiceid),
  documentType: s(j.cstaxtypedocumentid),
  transactionType: s(j.transtype),
  transactionDate: s(j.transdate),
  currency: s(j.currencycode),
  customerGroup: s(j.custgroup),
  salesGroup: s(j.salesgroup),
  invoiceDate: s(j.invoicedate),
  dueDate: s(j.duedate),
  invoiceAmount: n(j.invoiceamount),
  transactionAmount: n(j.amountcur),
  balance: n(j.remain),
  text: s(j.txt),
  companyName: s(j.companyname),
  overdueDays: n(j['días_diff'] ?? j.dias_diff),
  status: s(j.status),
  timePeriod: s(j.time_period),
});
export const mapInvoices = (value: unknown): InvoiceResult => {
  const j = (value ?? {}) as Json;
  return {
    items: Array.isArray(j.invoices) ? j.invoices.map((x) => mapInvoice(x as Json)) : [],
    pagination: pagination((j.pagination ?? {}) as Json),
  };
};
export const mapStatementDocument = (j: Json): StatementDocument => ({
  voucher: s(j.voucher),
  transactionType: s(j.transtype),
  transactionDate: s(j.transdate),
  dueDate: s(j.duedate),
  internalInvoice: s(j.internalinvoice ?? j['internalinvoice ']),
  externalInvoice: s(j.externalinvoice),
  text: s(j.txt),
  currency: s(j.currencycode),
  amount: n(j.amountcur),
  balanceUsd: n(j.remainamountcur_usd),
  balance: n(j.remainamountcur),
  companyId: s(j.dataareaid),
  companyName: s(j.companyname),
  overdueDays: n(j['días_diff'] ?? j.dias_diff ?? j.diasDiff),
  status: s(j.status),
  timePeriod: s(j.time_period ?? j.timePeriod),
});
export const agingSeverity = (label: string) =>
  ({
    '1-30 días': 'Reciente',
    '31-60 días': 'Atención',
    '61-90 días': 'En riesgo',
    'Más de 90 días': 'Crítico',
    'más de 90 días': 'Crítico',
  })[label.trim()] ?? 'Vencido';
export const buildStatementSummary = (value: unknown): StatementSummary => {
  const raw = Array.isArray(value)
    ? value
    : ((value as Json)?.data ?? (value as Json)?.statement ?? []);
  const documents = Array.isArray(raw) ? raw.map((x) => mapStatementDocument(x as Json)) : [];
  const currentDocs = documents.filter((x) => x.timePeriod.trim() === 'Corriente');
  const overdueDocs = documents.filter(
    (x) => x.timePeriod.trim() && x.timePeriod.trim() !== 'Corriente',
  );
  const group = new Map<string, StatementDocument[]>();
  overdueDocs.forEach((x) =>
    group.set(x.timePeriod.trim(), [...(group.get(x.timePeriod.trim()) ?? []), x]),
  );
  const aging: AgingBucket[] = [...group]
    .map(([label, docs]) => ({
      label,
      totalUsd: docs.reduce((a, x) => a + x.balanceUsd, 0),
      documents: docs,
      severity: agingSeverity(label),
    }))
    .sort(
      (a, b) =>
        Math.min(...a.documents.map((x) => x.overdueDays)) -
        Math.min(...b.documents.map((x) => x.overdueDays)),
    );
  const bucket = (label: string, docs: StatementDocument[], severity: string): AgingBucket => ({
    label,
    documents: docs,
    totalUsd: docs.reduce((a, x) => a + x.balanceUsd, 0),
    severity,
  });
  return {
    documents,
    currentTotalUsd: currentDocs.reduce((a, x) => a + x.balanceUsd, 0),
    overdueTotalUsd: overdueDocs.reduce((a, x) => a + x.balanceUsd, 0),
    current: bucket('Corriente', currentDocs, 'Al día'),
    overdue: bucket('Vencido', overdueDocs, 'Vencido'),
    aging,
  };
};
export const mapPdf = (value: unknown): PdfReport => {
  const j = (value ?? {}) as Json;
  if (j.Message && j.ExceptionType) throw new Error(s(j.Message));
  const report = { fileName: s(j.FileName ?? j.fileName), base64: s(j.FileBase64 ?? j.fileBase64) };
  if (!report.base64) throw new Error('El reporte no contiene un PDF.');
  return report;
};
