import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Punto de integración para observabilidad. No registrar datos ni errores crudos.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen grid place-items-center bg-surface p-6">
        <section role="alert" className="max-w-lg rounded-xl bg-white p-6 text-center shadow">
          <h1 className="text-xl font-bold">Sales4App no pudo continuar</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Recargue la aplicación. Si el problema continúa, contacte a soporte e indique la ruta y
            la hora del incidente.
          </p>
          <button
            className="mt-5 rounded-lg bg-primary px-4 py-2 font-semibold text-white"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </section>
      </main>
    );
  }
}
