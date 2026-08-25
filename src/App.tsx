import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { appConfig } from './app/config/env';
import { RequireAuthentication, RequireCompany, RequireCompleteContext } from './app/router/guards';
import ProtectedLayout from './app/router/ProtectedLayout';
import LoginPage from './features/auth/LoginPage';
import CompanySelectPage from './components/pages/CompanySelectPage';
import VendorSelectPage from './components/pages/VendorSelectPage';
import { LoadingState } from './components/ui/PageState';
import { OrderDraftProvider } from './features/orderDraft/OrderDraftProvider';
import {
  OrderSubmissionProvider,
  useOrderSubmission,
} from './features/orders/OrderSubmissionProvider';
const DashboardPage = lazy(() => import('./components/pages/DashboardPage'));
const OrdersPage = lazy(() => import('./components/pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./components/pages/OrderDetailPage'));
const AddExistingOrderLinePage = lazy(() => import('./components/pages/AddExistingOrderLinePage'));
const ClientsPage = lazy(() => import('./components/pages/ClientsPage'));
const InventoryPage = lazy(() => import('./components/pages/InventoryPage'));
const InvoicesPage = lazy(() => import('./components/pages/InvoicesPage'));
const CreateOrderPage = lazy(() => import('./components/pages/CreateOrderPage'));
const AddOrderLinePage = lazy(() => import('./components/pages/AddOrderLinePage'));
const AccountStatementPage = lazy(() => import('./components/pages/AccountStatementPage'));
const ProductsPage = lazy(() => import('./components/pages/ProductsPage'));
const CatalogsPage = lazy(() => import('./components/pages/CatalogsPage'));
const OrderDraftReviewPage = lazy(() => import('./components/pages/OrderDraftReviewPage'));
const OrderAttachmentsPage = lazy(() => import('./components/pages/OrderAttachmentsPage'));
const AgingPage = lazy(() => import('./components/pages/AgingPage'));
const FinancialDocumentPage = lazy(() => import('./components/pages/FinancialDocumentPage'));
const SupportPage = lazy(() => import('./components/pages/SupportPage'));
const CustomerAddressesPage = lazy(() => import('./components/pages/CustomerAddressesPage'));
const NewCustomerAddressPage = lazy(() => import('./components/pages/NewCustomerAddressPage'));
const ProductionPage = lazy(() => import('./components/pages/ProductionPage'));
const ForecastPage = lazy(() => import('./components/pages/ForecastPage'));
/** Protege rutas que requieren un borrador aún editable. */
const DraftEditableRoute = ({ children }: { children: React.ReactNode }) => {
  const { submission, active } = useOrderSubmission();
  return active || submission?.salesOrderNumber || submission?.headerAmbiguous ? (
    <Navigate to="/crear-pedido/revision" replace />
  ) : (
    children
  );
};

/** Declara las rutas funcionales conservadas del prototipo Web. */
const ExistingPrototypeRoutes: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Routes>
      <Route path="/home" element={<DashboardPage />} />
      <Route path="/pedidos" element={<OrdersPage />} />
      <Route path="/pedidos/:salesOrderNumber" element={<OrderDetailPage />} />
      <Route
        path="/pedidos/:salesOrderNumber/lineas/nueva"
        element={<AddExistingOrderLinePage />}
      />
      <Route path="/pedidos/:salesOrderNumber/adjuntos" element={<OrderAttachmentsPage />} />
      <Route
        path="/clientes"
        element={
          <ClientsPage
            onEstadoCuenta={(customerAccount) =>
              navigate(`/estado-cuenta?customer=${encodeURIComponent(customerAccount)}`)
            }
          />
        }
      />
      <Route path="/clientes/:customerAccount/direcciones" element={<CustomerAddressesPage />} />
      <Route
        path="/clientes/:customerAccount/direcciones/nueva"
        element={<NewCustomerAddressPage />}
      />
      <Route path="/inventario" element={<InventoryPage />} />
      <Route path="/productos" element={<ProductsPage />} />
      <Route path="/catalogos" element={<CatalogsPage />} />
      <Route path="/facturas" element={<InvoicesPage />} />
      {/* Producción/Forecast: implementados, ocultos temporalmente. Deep link bloqueado (fail closed) sin borrar el módulo. */}
      <Route
        path="/produccion"
        element={appConfig.featureProduction ? <ProductionPage /> : <Navigate to="/home" replace />}
      />
      <Route
        path="/forecast"
        element={appConfig.featureForecast ? <ForecastPage /> : <Navigate to="/home" replace />}
      />
      <Route
        path="/crear-pedido/*"
        element={
          <OrderDraftProvider>
            <OrderSubmissionProvider>
              <Routes>
                <Route
                  index
                  element={
                    <DraftEditableRoute>
                      <CreateOrderPage />
                    </DraftEditableRoute>
                  }
                />
                <Route
                  path="linea"
                  element={
                    <DraftEditableRoute>
                      <AddOrderLinePage />
                    </DraftEditableRoute>
                  }
                />
                <Route path="revision" element={<OrderDraftReviewPage />} />
              </Routes>
            </OrderSubmissionProvider>
          </OrderDraftProvider>
        }
      />
      <Route path="/estado-cuenta" element={<AccountStatementPage />} />
      <Route path="/estado-cuenta/aging" element={<AgingPage />} />
      <Route path="/estado-cuenta/documento/:id" element={<FinancialDocumentPage />} />
      <Route path="/soporte" element={<SupportPage />} />
    </Routes>
  );
};
/**
 * Raíz de la aplicación y composición de providers y rutas.
 *
 * Dependencias:
 * - React Router.
 * - TanStack Query.
 * - Providers de autenticación, sesión, borrador y envío.
 */
const App: React.FC = () => (
  <Suspense fallback={<LoadingState message="Cargando módulo..." />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuthentication />}>
        <Route path="/company" element={<CompanySelectPage />} />
        <Route element={<RequireCompany />}>
          <Route path="/vendor" element={<VendorSelectPage />} />
        </Route>
        <Route element={<RequireCompleteContext />}>
          <Route element={<ProtectedLayout />}>
            <Route path="*" element={<ExistingPrototypeRoutes />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  </Suspense>
);
export default App;
