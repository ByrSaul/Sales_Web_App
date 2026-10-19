import { useSafeNavigate } from '../../core/hooks/useSafeNavigate';
import { buildAgreementPackageLines } from '../../features/orderDraft/agreementPackage';
import { useAgreementPackage } from '../../features/orderDraft/useAgreementPackage';
import type { OrderDraft } from '../../features/orderDraft/types';
import { Button } from '../ui';
import { AgreementPackageStatus } from './AgreementPackageStatus';

export const OrderLinesContinue = ({
  draft,
  ready,
  update,
}: {
  draft: OrderDraft;
  ready: boolean;
  update: (patch: Partial<OrderDraft>) => void;
}) => {
  const state = useAgreementPackage(draft);
  const navigate = useSafeNavigate();
  const proceed = () => {
    if (!ready) return;
    if (!draft.agreement) {
      navigate('/crear-pedido/linea');
      return;
    }
    if (!state.ready) return;
    update({ lines: buildAgreementPackageLines(draft, state.query.data ?? []) });
    navigate('/crear-pedido/revision');
  };
  return (
    <>
      {draft.agreement && <AgreementPackageStatus state={state} />}
      <Button
        size="lg"
        fullWidth
        disabled={!ready || Boolean(draft.agreement && !state.ready)}
        onClick={proceed}
      >
        Continuar a líneas
      </Button>
    </>
  );
};
