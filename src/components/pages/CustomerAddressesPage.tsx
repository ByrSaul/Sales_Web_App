import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCustomerAddresses } from '../../features/catalogs/hooks';
import { Button, Card, EmptyState } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';
/** Pantalla de consulta de las direcciones pertenecientes a un cliente. */
const CustomerAddressesPage = () => {
  const { customerAccount = '' } = useParams();
  const [p] = useSearchParams();
  const nav = useNavigate();
  const q = useCustomerAddresses(customerAccount);
  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={() => nav(`/clientes${p.toString() ? `?${p}` : ''}`)}>
        Volver a clientes
      </Button>
      <div className="flex justify-between">
        <div>
          <h1 className="text-xl font-bold">Direcciones</h1>
          <p className="text-sm">Cliente {customerAccount}</p>
        </div>
        <Button
          onClick={() =>
            nav(
              `/clientes/${encodeURIComponent(customerAccount)}/direcciones/nueva${p.toString() ? `?${p}` : ''}`,
            )
          }
        >
          Nueva dirección
        </Button>
      </div>
      {q.isLoading ? (
        <LoadingState message="Consultando direcciones..." />
      ) : q.isError ? (
        <ErrorState
          message="No se pudieron consultar las direcciones existentes."
          onRetry={() => q.refetch()}
        />
      ) : !q.data?.length ? (
        <EmptyState title="El cliente no tiene direcciones" />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {q.data.map((a) => (
            <Card key={a.recId || a.locationId} className="p-4">
              <strong>{a.description}</strong>
              <p className="text-sm mt-1">{a.formattedAddress}</p>
              <small>
                {a.roles} · {a.countryId} · {a.locationId}
              </small>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
export default CustomerAddressesPage;
