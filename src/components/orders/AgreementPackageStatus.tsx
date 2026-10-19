import { runUiAction } from '../../core/async/uiAction';
import type { useAgreementPackage } from '../../features/orderDraft/useAgreementPackage';
import { ErrorState, LoadingState } from '../ui/PageState';

export const AgreementPackageStatus = ({
  state,
}: {
  state: ReturnType<typeof useAgreementPackage>;
}) => {
  if (state.query.isFetching) return <LoadingState message="Cargando líneas del paquete..." />;
  if (state.query.isError)
    return (
      <ErrorState
        message="No se pudieron consultar las líneas del paquete."
        onRetry={() => runUiAction(() => state.query.refetch())}
      />
    );
  if (state.validation)
    return (
      <p role="alert" className="text-sm text-error">
        {state.validation}
      </p>
    );
  return (
    <output aria-live="polite" className="block text-sm">
      {state.query.data?.length ?? 0} líneas del paquete disponibles. Se conservarán sus cantidades,
      dimensiones y precios.
    </output>
  );
};
