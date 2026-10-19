import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildStatementSummary } from '../../features/billing/billingMappers';
import type { PdfReport, StatementSummary } from '../../features/billing/billingTypes';
import AccountStatementPage from './AccountStatementPage';

type StatementQuery = { isLoading: boolean; isError: boolean; data?: StatementSummary; refetch: () => Promise<void> };
const mocks = vi.hoisted(() => ({ query: vi.fn<(account: string, multi: boolean) => StatementQuery>(), refetch: vi.fn<() => Promise<void>>(), report: vi.fn<(account: string) => Promise<PdfReport>>(), open: vi.fn(), pending: false }));
vi.mock('../../features/billing/billingQueries', () => ({
  useStatement: (account: string, multi: boolean) => mocks.query(account, multi),
  useAgingReport: () => ({ mutateAsync: mocks.report, isPending: mocks.pending }),
}));
vi.mock('../../features/billing/billingService', () => ({ openPdfReport: mocks.open }));
let query: StatementQuery;
const Location = () => { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output>; };
const mount = (url = '/estado-cuenta?customer=C%26%201&multiCompany=true') => render(
  <MemoryRouter initialEntries={[url]}>
    <Location />
    <Routes>
      <Route path="/estado-cuenta" element={<AccountStatementPage />} />
      <Route path="/estado-cuenta/aging" element={<p>Aging destination</p>} />
      <Route path="/estado-cuenta/documento/:id" element={<p>Document destination</p>} />
    </Routes>
  </MemoryRouter>,
);
const summary = () => buildStatementSummary([
  { dataareaid: 'CO', voucher: 'V/1', internalinvoice: 'INV-1', externalinvoice: 'EXT-1', transdate: '2026-10-01', duedate: '2026-10-31', currencycode: 'USD', remainamountcur: 100, remainamountcur_usd: 100, time_period: 'Corriente', status: 'Open' },
  { dataareaid: 'CO', voucher: 'V2', internalinvoice: '', currencycode: '', remainamountcur: 30, remainamountcur_usd: 30, time_period: '31-60 días', dias_diff: 40 },
]);
beforeEach(() => {
  vi.resetAllMocks(); mocks.pending = false; mocks.refetch.mockResolvedValue(undefined);
  query = { isLoading: false, isError: false, data: summary(), refetch: mocks.refetch };
  mocks.query.mockImplementation(() => query);
  mocks.report.mockResolvedValue({ fileName: 'aging.pdf', base64: 'JVBERg==' });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('AccountStatementPage', () => {
  it('requires an account and prevents blank/whitespace queries', () => {
    mount('/estado-cuenta');
    expect(screen.getByText('Seleccione una cuenta de cliente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled();
    expect(mocks.query).toHaveBeenLastCalledWith('', false);
    expect(mocks.report).not.toHaveBeenCalled();
  });
  it('takes filters from the URL, trims a submitted account and preserves multi-company selection', () => {
    mount();
    expect(mocks.query).toHaveBeenCalledWith('C& 1', true);
    expect(screen.getByRole('textbox')).toHaveValue('C& 1');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' C2 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(mocks.query).toHaveBeenLastCalledWith('C2', true);
    expect(screen.getByRole('textbox')).toHaveValue('C2');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Multiempresa' }));
    expect(mocks.query).toHaveBeenLastCalledWith('C2', false);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'C3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/estado-cuenta?customer=C3');
    expect(screen.getByTestId('location')).not.toHaveTextContent('multiCompany');
  });
  it.each([["loading","Cargando estado de cuenta..."],["error","No se pudo consultar el estado de cuenta."],["empty","Este cliente no tiene saldo pendiente"],["absent","Este cliente no tiene saldo pendiente"]])('shows the %s state instead of financial documents', async (state, expected) => {
    query.isLoading = state === 'loading'; query.isError = state === 'error';
    if (state === 'empty') query.data = buildStatementSummary([]);
    if (state === 'absent') query.data = undefined;
    mount();
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    if (state === 'error') {
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' })));
      expect(mocks.refetch).toHaveBeenCalledTimes(1);
    }
  });
  it('renders current/overdue totals, dynamic aging, invoice fallbacks and default USD currency', () => {
    mount();
    const usd = (amount: number) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'USD' }).format(amount).replace(/\s+/g, ' ');
    expect(screen.getAllByText(usd(100)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(usd(30)).length).toBeGreaterThan(0);
    expect(screen.getByText(usd(130))).toBeInTheDocument();
    expect(screen.getByText('INV-1')).toBeInTheDocument();
    expect(screen.getByText('V2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /31-60 días.*Atención/ })).toBeInTheDocument();
  });
  it.each([true, false])('preserves account/bucket and multi-company=%s during aging navigation', (multi) => {
    mount('/estado-cuenta?customer=C%26%201' + (multi ? '&multiCompany=true' : ''));
    fireEvent.click(screen.getByRole('button', { name: /31-60 días.*Atención/ }));
    expect(screen.getByText('Aging destination')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/estado-cuenta/aging?customer=C%26%201&bucket=31-60%20d%C3%ADas' + (multi ? '&multiCompany=true' : ''));
  });
  it.each([true, false])('encodes voucher/account and multi-company=%s in document navigation', (multi) => {
    mount('/estado-cuenta?customer=C%26%201' + (multi ? '&multiCompany=true' : ''));
    fireEvent.click(screen.getByText('INV-1').closest('tr')!);
    expect(screen.getByText('Document destination')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/estado-cuenta/documento/V%2F1?customer=C%26%201' + (multi ? '&multiCompany=true' : ''));
  });
  it.each(['aging.pdf', ''])('opens the aging PDF with the returned filename or account fallback (%s)', async (fileName) => {
    mocks.report.mockResolvedValue({ fileName, base64: 'JVBERg==' });
    mount();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Ver reporte' })));
    expect(mocks.report).toHaveBeenCalledExactlyOnceWith('C& 1');
    expect(mocks.open).toHaveBeenCalledExactlyOnceWith(fileName || 'Antiguedad-C& 1.pdf', 'JVBERg==');
  });
  it.each(['request', 'opening'])('shows a recoverable error when PDF %s fails', async (failure) => {
    if (failure === 'request') mocks.report.mockRejectedValueOnce(new Error('request failed'));
    else mocks.open.mockImplementationOnce(() => { throw new Error('invalid PDF'); });
    mount();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Ver reporte' })));
    expect(screen.getByRole('alert')).toHaveTextContent('No fue posible generar el reporte de antigüedad.');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Ver reporte' })));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.report).toHaveBeenCalledTimes(2);
  });
  it('disables a second report request while the mutation is pending', () => {
    mocks.pending = true;
    mount();
    const button = screen.getByRole('button', { name: /Generando/ });
    expect(button).toBeDisabled(); fireEvent.click(button);
    expect(mocks.report).not.toHaveBeenCalled();
  });
});
