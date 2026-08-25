import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { NewAddressForm } from '../orders/NewAddressForm';
import { Button, Card } from '../ui';

/** Pantalla dedicada a la creación de una dirección para el cliente indicado. */
const NewCustomerAddressPage = () => {
  const { customerAccount = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnToAddresses = () =>
    navigate(
      `/clientes/${encodeURIComponent(customerAccount)}/direcciones${params.toString() ? `?${params}` : ''}`,
    );

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={returnToAddresses}>Volver</Button>
      <h1 className="text-xl font-bold">Nueva dirección · {customerAccount}</h1>
      <Card className="p-4">
        <NewAddressForm
          customerAccount={customerAccount}
          onCancel={returnToAddresses}
          onCreated={returnToAddresses}
        />
      </Card>
    </div>
  );
};

export default NewCustomerAddressPage;
