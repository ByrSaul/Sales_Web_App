# Arquitectura final

```text
Browser / React 18 + React Router
  ├─ GlobalErrorBoundary
  ├─ MSAL AuthProvider (Entra ID, public client)
  ├─ SessionProvider (cuenta, empresa, vendedor, permisos)
  ├─ TanStack Query (server state segregado por contexto)
  └─ Feature pages lazy-loaded
       ↓ feature services y mappers
     ApiClient (Bearer, 401 controlado, timeout, AbortSignal)
       ↓ HTTPS + CORS
     FastAPI Proxy
       ↓
     Dynamics 365
```

`App.tsx` declara rutas y guards; `SessionProvider` es el contexto operativo y crea el `ApiClient`; cada feature contiene contrato, mapper y queries/mutations. Las rutas comerciales se cargan dinámicamente. El estado remoto vive en TanStack Query y se limpia al cambiar empresa o cerrar sesión.

MSAL guarda su caché administrada en `sessionStorage`. El contexto operativo también usa `sessionStorage`. El draft versionado (TTL 7 días) y la recuperación transaccional segregada por cuenta/empresa usan `localStorage`. No se persisten manualmente tokens, archivos, PDF ni Base64.

Los queries incluyen empresa y, cuando aplica, vendedor, cliente, pedido, filtros y página. Geografía no incluye empresa porque son catálogos globales; aun así todo el cache se limpia al cambiar empresa. Las mutaciones transaccionales tienen retry deshabilitado o recuperación explícita.

Navegadores objetivo: versiones empresariales soportadas y actuales de Edge/Chrome; Firefox/Safari modernos son compatibles conceptualmente. Internet Explorer no está soportado.

