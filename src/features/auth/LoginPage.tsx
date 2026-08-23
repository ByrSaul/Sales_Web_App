import React from 'react';
import { Navigate } from 'react-router-dom';
import { getConfigurationErrors } from '../../app/config/env';
import { useAuth } from '../../app/providers/AuthProvider';
import { Button, Card, Icon } from '../../components/ui';
import { LoadingState } from '../../components/ui/PageState';

const LoginPage: React.FC = () => {
  const { mode, status, error, login } = useAuth();
  const configErrors = getConfigurationErrors();
  if (status === 'loading') return <LoadingState message="Restaurando sesión..." />;
  if (status === 'authenticated') return <Navigate to="/home" replace />;
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
          <Icon name="agriculture" size={36} />
        </div>
        <h1 className="text-2xl font-bold text-primary">Sales4App</h1>
        <p className="text-sm text-on-surface-variant mt-2 mb-6">
          {mode === 'msal'
            ? 'Ingresa con tu cuenta corporativa de Microsoft.'
            : 'Autenticación controlada de desarrollo.'}
        </p>
        {mode === 'dev-token' && (
          <p className="text-xs font-semibold text-warning mb-4">
            TEMPORAL · DEVELOPMENT ONLY · NOT FOR PRODUCTION
          </p>
        )}
        {configErrors.length > 0 && (
          <p role="alert" className="text-xs text-error bg-red-50 rounded-lg p-3 mb-4">
            Configuración pendiente: {configErrors.join(', ')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-error mb-4">
            {error}
          </p>
        )}
        <Button
          fullWidth
          size="lg"
          icon="login"
          onClick={() => void login()}
          disabled={configErrors.length > 0}
        >
          {mode === 'msal'
            ? 'Iniciar sesión con Microsoft'
            : 'Reintentar autenticación configurada'}
        </Button>
      </Card>
    </main>
  );
};
export default LoginPage;
