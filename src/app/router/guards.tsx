import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useSession } from '../providers/SessionProvider';
import { LoadingState } from '../../components/ui/PageState';
export const RequireAuthentication: React.FC = () => {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <LoadingState message="Restaurando sesión..." />;
  if (auth.status !== 'authenticated')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
};
export const RequireCompany: React.FC = () => {
  const { context } = useSession();
  return context.company ? <Outlet /> : <Navigate to="/company" replace />;
};
export const RequireCompleteContext: React.FC = () => {
  const { context } = useSession();
  if (!context.company) return <Navigate to="/company" replace />;
  if (!context.vendor || !context.user) return <Navigate to="/vendor" replace />;
  return <Outlet />;
};
