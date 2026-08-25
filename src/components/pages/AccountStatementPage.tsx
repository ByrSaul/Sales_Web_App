import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAgingReport, useStatement } from '../../features/billing/billingQueries';
import { openPdfReport } from '../../features/billing/billingService';
import { Button, Card, EmptyState, Input } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';
const usd = (v: number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'USD' }).format(v);
/**
 * Pantalla de estado de cuenta del cliente seleccionado.
 *
 * Responsabilidades:
 * - Consultar documentos y resumen financiero.
 * - Mantener el contexto de cliente recibido por navegación.
 * - Solicitar reportes PDF cuando corresponda.
 *
 * Dependencias:
 * - React Router.
 * - Queries de facturación.
 */
const AccountStatementPage = () => {
  const [p, setP] = useSearchParams();
  const navigate = useNavigate();
  const account = p.get('customer') ?? '';
  const multi = p.get('multiCompany') === 'true';
  const [input, setInput] = useState(account);
  useEffect(() => setInput(account), [account]);
  const q = useStatement(account, multi);
  const agingReport = useAgingReport();
  const [agingReportError, setAgingReportError] = useState('');
  const openAgingReport = async () => {
    if (!account || agingReport.isPending) return;
    setAgingReportError('');
    try {
      const report = await agingReport.mutateAsync(account);
      openPdfReport(report.fileName || `Antiguedad-${account}.pdf`, report.base64);
    } catch {
      setAgingReportError('No fue posible generar el reporte de antigüedad.');
    }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Estado de cuenta</h1>
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <Input label="Cuenta de cliente" value={input} onChange={(e) => setInput(e.target.value)} />
        <label className="flex items-center gap-2 text-sm pb-2">
          <input
            type="checkbox"
            checked={multi}
            onChange={(e) => setP({ customer: account, multiCompany: String(e.target.checked) })}
          />
          Multiempresa
        </label>
        <Button
          disabled={!input.trim()}
          onClick={() =>
            setP({ customer: input.trim(), ...(multi ? { multiCompany: 'true' } : {}) })
          }
        >
          Consultar
        </Button>
      </Card>
      {!account ? (
        <EmptyState title="Seleccione una cuenta de cliente" />
      ) : q.isLoading ? (
        <LoadingState message="Cargando estado de cuenta..." />
      ) : q.isError ? (
        <ErrorState
          message="No se pudo consultar el estado de cuenta."
          onRetry={() => q.refetch()}
        />
      ) : !q.data?.documents.length ? (
        <EmptyState title="Este cliente no tiene saldo pendiente" />
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Card className="p-4">
              <small>Corriente</small>
              <strong className="block text-xl">{usd(q.data.currentTotalUsd)}</strong>
            </Card>
            <Card className="p-4">
              <small>Vencido</small>
              <strong className="block text-xl text-error">{usd(q.data.overdueTotalUsd)}</strong>
            </Card>
            <Card className="p-4">
              <small>Saldo visual USD</small>
              <strong className="block text-xl">
                {usd(q.data.currentTotalUsd + q.data.overdueTotalUsd)}
              </strong>
            </Card>
          </div>
          <Card className="p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Antigüedad</h2>
              <Button
                size="sm"
                variant="outline"
                loading={agingReport.isPending}
                disabled={agingReport.isPending}
                onClick={() => void openAgingReport()}
              >
                {agingReport.isPending ? 'Generando...' : 'Ver reporte'}
              </Button>
            </div>
            {agingReportError && (
              <p role="alert" className="mb-2 text-xs text-error">
                {agingReportError}
              </p>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {[q.data.current, ...q.data.aging].map((b) => (
                <button
                  key={b.label}
                  className="border rounded p-3 text-left"
                  onClick={() =>
                    navigate(
                      `/estado-cuenta/aging?customer=${encodeURIComponent(account)}&bucket=${encodeURIComponent(b.label)}${multi ? '&multiCompany=true' : ''}`,
                    )
                  }
                >
                  <strong>{b.label}</strong>
                  <small className="block">
                    {b.severity} · {b.documents.length} documentos
                  </small>
                  <span>{usd(b.totalUsd)}</span>
                </button>
              ))}
            </div>
          </Card>
          <div className="overflow-x-auto">
            <table className="w-full bg-white text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left">Documento</th>
                  <th>Fecha</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th>Moneda</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {q.data.documents.map((d) => (
                  <tr
                    key={`${d.companyId}-${d.voucher}`}
                    className="border-t cursor-pointer"
                    onClick={() =>
                      navigate(
                        `/estado-cuenta/documento/${encodeURIComponent(d.voucher)}?customer=${encodeURIComponent(account)}${multi ? '&multiCompany=true' : ''}`,
                      )
                    }
                  >
                    <td className="p-2">
                      <strong>{d.internalInvoice || d.voucher}</strong>
                      <small className="block">{d.externalInvoice}</small>
                    </td>
                    <td>{d.transactionDate}</td>
                    <td>{d.dueDate}</td>
                    <td>
                      {d.status} · {d.timePeriod}
                    </td>
                    <td>{d.currency}</td>
                    <td className="text-right p-2">
                      {new Intl.NumberFormat('es-GT', {
                        style: 'currency',
                        currency: d.currency || 'USD',
                      }).format(d.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
export default AccountStatementPage;
