import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import type { Company } from '../../core/session/types';
import { userErrorMessage } from '../../core/api/errors';
import { sessionService } from '../../features/session/sessionService';
import { Button, Card, Icon } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';

const CompanySelectPage: React.FC = () => {
  const { api, context, selectCompany } = useSession(); const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]); const [selected, setSelected] = useState(context.company?.id ?? '');
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setCompanies(await sessionService(api).getCompanies()); } catch (cause) { setError(userErrorMessage(cause)); } finally { setLoading(false); } }, [api]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <LoadingState message="Cargando empresas..." />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  return <main className="min-h-screen bg-background p-4 md:p-8"><div className="max-w-2xl mx-auto"><div className="text-center mb-6"><Icon name="business" size={40} className="text-primary" /><h1 className="text-xl font-bold mt-2">Favor seleccione la empresa</h1></div>{companies.length === 0 ? <Card className="p-8 text-center text-sm text-on-surface-variant">No hay empresas disponibles para tu usuario.</Card> : <div className="space-y-2">{companies.map(company => <button key={company.id} onClick={() => setSelected(company.id)} className={`w-full flex items-center gap-4 p-4 bg-white rounded-xl border text-left ${selected === company.id ? 'border-primary ring-1 ring-primary/20' : 'border-outline-variant'}`}><Icon name="business" className="text-primary" /><span className="flex-1"><strong className="block text-sm">{company.name}</strong><span className="text-xs text-on-surface-variant">{company.id} · {company.defaultCurrency || 'Sin moneda predeterminada'}</span></span>{selected === company.id && <Icon name="check_circle" className="text-primary" />}</button>)}</div>}<div className="flex justify-end mt-6"><Button icon="arrow_forward" iconPosition="right" disabled={!selected} onClick={() => { const company = companies.find(item => item.id === selected); if (company) { selectCompany(company); navigate('/vendor'); } }}>Continuar</Button></div></div></main>;
};
export default CompanySelectPage;

