import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type AppLayout from '../../components/layout/AppLayout';
import { emptyOperationalContext } from '../../core/session/storage';
import ProtectedLayout from './ProtectedLayout';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), session: vi.fn(), props: vi.fn() }));
vi.mock('../providers/AuthProvider', () => ({ useAuth: () => mocks.auth() }));
vi.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ context: mocks.session() }),
}));
vi.mock('../../components/layout/AppLayout', () => ({
  default: (props: ComponentProps<typeof AppLayout>) => {
    mocks.props(props);
    return (
      <main>
        {props.children}
        <span>{props.user.name}</span>
        <span>{props.user.role}</span>
        <span>{props.pageTitle}</span>
        <button onClick={() => props.onNavigate('/clientes')}>Clientes</button>
        {props.onBack && <button onClick={props.onBack}>Volver</button>}
        {props.showFab && <button onClick={props.onFab}>Crear</button>}
      </main>
    );
  },
}));
const Location = () => <output data-testid="location">{useLocation().pathname}</output>;
const mount = (path = '/home', entries = [path]) =>
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route element={<ProtectedLayout />}>
          <Route path="*" element={<p>Contenido protegido</p>} />
        </Route>
      </Routes>
      <Location />
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockReturnValue({ account: { name: 'Usuario', username: 'user@example.test' } });
  mocks.session.mockReturnValue(emptyOperationalContext('A1'));
});
afterEach(cleanup);
describe('ProtectedLayout', () => {
  it.each(['/pedidos/OV-1', '/crear-pedido/linea', '/inventario', '/clientes'])(
    'resolves active module and title for %s',
    (path) => {
      mount(path);
      const props = mocks.props.mock.lastCall![0] as ComponentProps<typeof AppLayout>;
      const modules: Record<string, string> = {
        '/pedidos/OV-1': '/pedidos',
        '/crear-pedido/linea': '/crear-pedido',
      };
      expect(props.activeRoute).toBe(modules[path] ?? path);
      expect(props.pageTitle).toBeTruthy();
      expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    },
  );
  it('uses vendor identity, announces context warnings and offers creation on home', () => {
    mocks.session.mockReturnValue({
      ...emptyOperationalContext('A1'),
      vendor: { name: 'Vendedor' },
      warning: 'Contexto incompleto',
    });
    mount();
    expect(screen.getByText('Vendedor')).toBeInTheDocument();
    expect(screen.getByText('user@example.test')).toBeInTheDocument();
    expect(screen.getByText('Contexto incompleto').tagName).toBe('OUTPUT');
    expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/crear-pedido');
  });
  it('navigates between modules and returns through the existing history', () => {
    mount('/clientes', ['/home', '/clientes']);
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/home');
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/clientes');
    expect(screen.queryByRole('button', { name: 'Crear' })).not.toBeInTheDocument();
  });
  it('handles absent identity without inventing a user or warning', () => {
    mocks.auth.mockReturnValue({ account: null });
    mount('/pedidos');
    expect(mocks.props.mock.lastCall![0].user).toEqual({ name: '', role: '' });
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument();
  });
});
