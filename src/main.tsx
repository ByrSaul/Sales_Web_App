import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { msalInstance } from './core/auth/msal';
import { AuthProvider } from './app/providers/AuthProvider';
import { SessionProvider } from './app/providers/SessionProvider';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './app/providers/queryClient';
import { GlobalErrorBoundary } from './app/errors/GlobalErrorBoundary';
import { appConfig, getConfigurationErrors } from './app/config/env';

const start = async () => {
  const fatal = getConfigurationErrors().find((error) =>
    error.includes('no está permitido en producción'),
  );
  if (fatal) throw new Error(fatal);
  if (appConfig.authMode === 'msal') {
    await msalInstance.initialize();
    const redirectResult = await msalInstance.handleRedirectPromise();
    if (redirectResult?.account) msalInstance.setActiveAccount(redirectResult.account);
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider instance={msalInstance}>
              <SessionProvider>
                <App />
              </SessionProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </GlobalErrorBoundary>
    </React.StrictMode>,
  );
};
void start();
