# Production readiness

## Decisión

**NOT READY FOR PRODUCTION**

La Web compila, pasa lint y pruebas, no contiene secretos detectados y tiene controles transaccionales conservadores. Sin embargo, el flujo principal de creación/recovery carece de idempotencia y usa un GET con body para verificar líneas; además no existen E2E, CORS productivo confirmado, URL/hosting/Entra productivos ni smoke test real. Estos P0 impiden una declaración READY.

## Evidencia Fase 10

- Baseline: `npm ci` exitoso (357 paquetes); lint 0 warnings; 27 archivos/129 tests aprobados; TypeScript/build exitoso; E2E no configurado.
- Dependencias: instalación total 11 moderate + 2 high en la cadena de tooling `nanoid → postcss → Tailwind/Vite/Vitest`; los advisories afectan generadores custom con tamaños inválidos y no una ruta ejecutada por la SPA. No hay fix disponible en el árbol actual y no se forzó una actualización mayor. `npm audit --omit=dev`: 0 vulnerabilidades productivas.
- Build baseline: 515 módulos; principal 166.99 kB/53.53 gzip; `SessionProvider` 275.18/71.44; `DashboardPage` 81.45/28.83. Lazy loading conservado. El resultado final se registra al cerrar la validación.
- Source maps productivos deshabilitados explícitamente.
- Secret scan: placeholders públicos y referencias legítimas a bearer/token; ningún secreto real encontrado.
- Logs: se retiraron dos logs de errores crudos. No hay mocks productivos; fixtures/mocks están en pruebas.
- Observabilidad: no existe proveedor/integración.

Resultado final: 28 archivos/130 tests aprobados; lint sin warnings; TypeScript y build aprobados. Build final de 516 módulos: principal 167.82 kB/53.81 gzip, `SessionProvider` 275.08/71.41 y `DashboardPage` 81.45/28.83. El único warning de build es informativo sobre tiempo del plugin CSS. Frente a Fase 9, el principal aumentó 0.83 kB (0.28 gzip) por el Error Boundary; los módulos grandes continúan lazy-loaded.

## Storage y cache

`sessionStorage`: caché interna MSAL y contexto de cuenta/empresa/vendedor/usuario/permisos. `localStorage`: draft v1 con cuenta, empresa, `updatedAt` y TTL 7 días; submission recovery v1 por cuenta+empresa, incluyendo snapshot y SalesOrderNumber. No hay almacenamiento manual de tokens, PDFs, archivos o Base64. Logout elimina draft/contexto/cache pero preserva recovery; cambio de empresa limpia cache y draft.

TanStack Query usa stale time de 60 s por defecto (15/30 s donde procede), máximo dos retries sólo de queries transitorias y ninguno para mutaciones peligrosas. ApiClient: 20 s normal; 60 s transaccional/soporte; 120 s SSRS/uploads. Crear/editar/cancelar/confirmar y soporte no tienen retry automático de mutation. El runner verifica antes de un segundo intento y se detiene si el resultado es desconocido.

## Seguridad

Controlado: public client sin secret; bearer sólo en memoria/MSAL; HTTPS requerido; PDF valida Base64, bytes y `%PDF`; tipos/tamaños de adjuntos; object URLs revocadas; nombres sanitizados; Error Boundary global seguro; no source maps. Pendiente en hosting: TLS, CSP validada, HSTS, nosniff, referrer, permissions/frame policy, fallback y cache headers. Accesibilidad/responsive tienen cobertura estructural básica, pero requieren prueba manual de contraste, focus y tres viewports.

## Inventario de endpoints usados por Web

| Feature | Método | Endpoint | Web | Estado | Observación |
|---|---|---|---|---|---|
| Sesión | POST | `/company/companies` | Sí | Operativo | Empresas |
| Sesión | POST | `/company/salesGroupByUser` | Sí | Operativo | Vendedores |
| Sesión | POST | `/user/data` | Sí | Operativo | Fallback compatible |
| Sesión | POST | `/company/accessMenuByUser` | Sí | Operativo | Permisos |
| Clientes | POST | `/customer` | Sí | Operativo | Paginado |
| Direcciones | POST | `/customer/address` | Sí | Operativo | Consulta cliente |
| Direcciones | POST | `/d365/address` | Sí | Parcial | Geografía bloquea flujo |
| Productos | POST | `/company/products` | Sí | Operativo | Paginado |
| Variantes | POST | `/company/products/variants` | Sí | Operativo | — |
| Inventario | POST | `/inventory` | Sí | Operativo | Empresa/vendedor |
| Inventario | POST | `/inventory/variant` | Sí | Operativo | — |
| Precio | POST | `/d365_services/get_price` | Sí | Operativo | — |
| Catálogo | POST | `/delivery/mode` | Sí | Operativo | — |
| Catálogo | POST | `/company/sales_origin` | Sí | Operativo | — |
| Acuerdos | POST | `/customer/agreement` | Sí | Operativo | — |
| Acuerdos | POST | `/customer/agreement/details` | Sí | Operativo | — |
| Acuerdos | POST | `/customer/agreement/parcial_lines` | Sí | Operativo | — |
| Promociones | POST | `/suppItemGroup` | Sí | Operativo | — |
| Geografía | GET | `/d365/address/country_regions`, `/states`, `/counties`, `/cities`, `/zip_codes` | Sí | Bloqueado | GET con body |
| NIT | GET | `/d365/vat_num`, `/d365/vat_num/document_type` | Sí | Bloqueado | GET con body |
| Pedidos | POST | `/sales` | Sí | Operativo | Lista/header |
| Pedidos | POST | `/sales/details` | Sí | Parcial | Requiere InventoryLotId |
| Pedidos | POST | `/d365/sales` | Sí | Riesgo P0 | Sin idempotencia |
| Líneas | POST | `/d365/sales/line`, `/agreement` | Sí | Parcial | Cantidad int |
| Líneas | GET | `/d365/sales/line` | Sí | Bloqueado | Recovery GET-body |
| Líneas | PATCH | `/d365/sales/line` | Sí | Parcial | InventoryLotId |
| Líneas | POST | `/d365_services/post_cancle_sales_line` | Sí | Parcial | Sin retry |
| Pedido | POST | `/d365_services/confirm_sales_order` | Sí | Operativo | Sin retry |
| Adjuntos | GET/POST | `/d365/sales_header_documents_atachments` | Sí | Parcial | Listado GET-body |
| Facturas | POST | `/custumer/invoice` | Sí | Operativo | Nombre contractual actual |
| Facturas | GET | `/custumer/invoice/time_period` | Sí | Operativo | Sin body |
| Cartera | POST | `/customer/statement` | Sí | Operativo | — |
| PDF | POST | `/d365_services/get_ssrs_report_pdf` | Sí | Operativo | 120 s, firma PDF |
| Soporte | POST | `/support/send_email` | Sí | Operativo | 60 s, no idempotente |
| Producción | POST | `/production`, `/production/daily` | Sí | Operativo | Consulta |
| Forecast | POST | `/forecastSales` | Sí | Operativo | Consulta |

## Observabilidad y versión

La versión desplegada es `package.json` (`1.0.0`) y debe adjuntarse como metadata/release del hosting. Estrategia mínima futura: capturar errores sanitizados con versión, timestamp, ruta y correlation ID retornado por Backend. Nunca enviar tokens, Authorization, Base64, archivos, cuerpos de pedido ni datos financieros/personales completos. No se incorporó proveedor arbitrario.

## Riesgos residuales priorizados

1. P0: creación de header sin idempotencia y recovery de líneas incompatible con browser.
2. P0: CORS/origen productivo no configurado ni probado.
3. P0 de readiness: existe E2E mock automatizado, pero continúa pendiente el smoke real autorizado del flujo principal.
4. P1: geografía/NIT/adjuntos GET-body; InventoryLotId extremo a extremo; cantidades decimales vs int.
5. P2: uploads/soporte sin idempotencia/correlation y observabilidad ausente.
6. P3: validar accesibilidad, contraste, navegadores y responsive manualmente; revisar vulnerabilidades dev en upgrades controlados.

## Requisitos antes del Go-Live

- [ ] Resolver BE-04 y BE-07 con contrato idempotente/browser-compatible.
- [ ] Definir URL productiva y configurar hosting HTTPS/fallback/cache/headers.
- [ ] Configurar Entra SPA, redirects, logout y scope para ambos ambientes.
- [ ] Configurar y probar CORS con origen exacto y preflight.
- [ ] Alinear cantidad decimal/int e InventoryLotId con pruebas contractuales reales.
- [ ] Resolver GET-body para adjuntos, NIT y geografía o excluir formalmente esos flujos.
- [x] Crear E2E mock seguro sin credenciales reales.
- [ ] Ejecutar smoke real completo con datos autorizados.
- [ ] Definir observabilidad sanitizada y versionado de release.
- [ ] Repetir `npm ci`, lint, tests, build y auditoría en CI.

La decisión sólo puede subir a CONDITIONALLY READY/READY después de aportar evidencia de estos controles; no basta con que el frontend compile.
