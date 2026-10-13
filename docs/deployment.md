# Build y despliegue

> **Referencia de fases anteriores.** Revisado documentalmente el 2026-10-13: se conserva el contenido histórico. Para implementación, contratos y resultados actuales consultar el [manual técnico](./MANUAL_TECNICO_SALES4APP_WEB.md), el [inventario](./INVENTARIO_COMPONENTES_SALES4APP.md) y la [idempotencia](./IDEMPOTENCIA_FRONTEND_SALES4APP.md). Las cifras de pruebas, GET con body, ausencia de idempotencia, redirect URI y estados de paridad/readiness de esta guía no son evidencia vigente ni validación real de Mobile o producción.

## Pipeline reproducible

```bash
npm ci
npm run lint
npm run test
npm run build
```

Publicar exclusivamente `dist/`. El lockfile es obligatorio. El build ejecuta TypeScript antes de Vite y no genera source maps públicos.

## Hosting agnóstico

El destino no está definido. Cualquier CDN/servidor debe servir HTTPS y aplicar fallback SPA de toda ruta no correspondiente a un asset hacia `/index.html` con estado 200. Esto incluye `/home`, `/pedidos/:id`, `/facturas`, `/estado-cuenta/aging` y `/soporte` al refrescar.

- Assets Vite con hash: `Cache-Control: public, max-age=31536000, immutable`.
- `index.html`: `Cache-Control: no-cache` o revalidación corta.
- No cachear respuestas autenticadas del proxy en caches compartidos.

## CORS

El Backend inspeccionado no declara `CORSMiddleware`; debe confirmarse en la infraestructura que lo envuelve.

| Ambiente | Web Origin | Backend | CORS requerido |
|---|---|---|---|
| Desarrollo | `http://localhost:5173` (o puerto real) | URL API dev | Origin exacto, `Authorization`/`Content-Type`, métodos GET/POST/PATCH/OPTIONS |
| Producción | `https://<WEB_ORIGIN_PRODUCTIVO>` | `https://<API_ORIGIN_PRODUCTIVO>` | Origin exacto; nunca `*` con credenciales; preflight habilitado |

## Headers recomendados

- `Strict-Transport-Security: max-age=31536000; includeSubDomains` después de validar todos los subdominios.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` negando cámara, micrófono, geolocalización y sensores no usados.
- `frame-ancestors 'none'` mediante CSP (o `X-Frame-Options: DENY` como compatibilidad).

CSP inicial a validar en staging: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://login.microsoftonline.com https://<API_ORIGIN_PRODUCTIVO>; frame-src https://login.microsoftonline.com; object-src 'none'; base-uri 'self'; form-action 'self' https://login.microsoftonline.com; frame-ancestors 'none'`. Ajustar con evidencia del flujo MSAL; no añadir `unsafe-eval`. `blob:` es necesario para PDF/adjuntos.

Antes del go-live: crear origen/dominio, TLS, fallback, CORS, registro Entra y headers; desplegar a staging; ejecutar smoke tests autorizados; luego promover el mismo artefacto si las variables pertenecen al mismo ambiente.

