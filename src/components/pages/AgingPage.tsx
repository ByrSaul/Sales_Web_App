import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStatement } from '../../features/billing/billingQueries';
import { Button, Card, EmptyState } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';
/**
 * Pantalla de antigüedad de saldos obtenida desde el reporte financiero real.
 *
 * Dependencias:
 * - Contexto de sesión.
 * - Query de reporte Aging.
 */
const AgingPage = () => {
  const [p] = useSearchParams();
  const nav = useNavigate();
  const account = p.get('customer') ?? '',
    label = p.get('bucket') ?? '',
    multi = p.get('multiCompany') === 'true';
  const q = useStatement(account, multi);
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message="No se pudo cargar la antigüedad." />;
  const bucket = [q.data?.current, ...(q.data?.aging ?? [])].find((x) => x?.label === label);
  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        onClick={() =>
          nav(
            `/estado-cuenta?customer=${encodeURIComponent(account)}${multi ? '&multiCompany=true' : ''}`,
          )
        }
      >
        Volver
      </Button>
      <h1 className="text-xl font-bold">Antigüedad · {label}</h1>
      {!bucket ? (
        <EmptyState title="No se encontró el rango solicitado" />
      ) : (
        <>
          <Card className="p-4">
            <strong>{bucket.severity}</strong>
            <p>
              {bucket.documents.length} documentos · USD {bucket.totalUsd.toFixed(2)}
            </p>
          </Card>
          {bucket.documents.map((d) => (
            <Card
              key={`${d.companyId}-${d.voucher}`}
              className="p-4"
              onClick={() =>
                nav(
                  `/estado-cuenta/documento/${encodeURIComponent(d.voucher)}?customer=${encodeURIComponent(account)}&bucket=${encodeURIComponent(label)}${multi ? '&multiCompany=true' : ''}`,
                )
              }
            >
              <div className="flex justify-between">
                <strong>{d.internalInvoice || d.voucher}</strong>
                <span>{d.status}</span>
              </div>
              <p className="text-sm">
                {d.timePeriod} · {d.overdueDays} días · {d.currency} {d.balance.toFixed(2)}
              </p>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};
export default AgingPage;
