import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import type { Vendor } from '../../core/session/types';
import { userErrorMessage } from '../../core/api/errors';
import { sessionService } from '../../features/session/sessionService';
import { Button, Icon } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';

const VendorSelectPage: React.FC = () => {
  const { api, context, completeVendorSelection, operationError } = useSession();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState(context.vendor?.id ?? '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!context.company) return;
    setLoading(true);
    setError(null);
    try {
      setVendors(await sessionService(api).getVendors(context.company.id));
    } catch (cause) {
      setError(userErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [api, context.company]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!context.company) return <Navigate to="/company" replace />;
  if (loading) return <LoadingState message="Cargando vendedores..." />;
  if (error && vendors.length === 0)
    return <ErrorState message={error} onRetry={() => void load()} />;
  const submit = async () => {
    const vendor = vendors.find((item) => item.id === selected);
    if (!vendor) return;
    setSubmitting(true);
    setError(null);
    try {
      await completeVendorSelection(vendor);
      navigate('/home', { replace: true });
    } catch (cause) {
      setError(userErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <Icon name="person" size={40} className="text-primary" />
          <h1 className="text-xl font-bold mt-2">Favor seleccione vendedor</h1>
          <p className="text-xs text-on-surface-variant mt-1">Empresa: {context.company.name}</p>
        </div>
        {(error || operationError) && (
          <p role="alert" className="text-sm text-error bg-red-50 rounded-lg p-3 mb-3">
            {error ?? operationError}
          </p>
        )}
        <div className="space-y-2">
          {vendors.map((vendor) => (
            <button
              key={vendor.id}
              onClick={() => setSelected(vendor.id)}
              className={`w-full flex items-center gap-4 p-4 bg-white rounded-xl border text-left ${selected === vendor.id ? 'border-primary ring-1 ring-primary/20' : 'border-outline-variant'}`}
            >
              <Icon name="person" className="text-primary" />
              <span className="flex-1">
                <strong className="block text-sm">{vendor.name}</strong>
                <span className="text-xs text-on-surface-variant">{vendor.id}</span>
              </span>
              {selected === vendor.id && <Icon name="check_circle" className="text-primary" />}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-6">
          <Button variant="ghost" onClick={() => navigate('/company')}>
            Volver
          </Button>
          <Button
            loading={submitting}
            disabled={!selected}
            icon="arrow_forward"
            iconPosition="right"
            onClick={() => void submit()}
          >
            Continuar
          </Button>
        </div>
      </div>
    </main>
  );
};
export default VendorSelectPage;
