# Estrategia de pruebas

- Unitarias: mappers, validaciones, storage, reglas y ApiClient.
- Componentes: estados, URLs, páginas y mutaciones con servicios simulados.
- Integración Web: providers, guards, servicios y contratos verifican payloads sin llamar Dynamics.
- E2E mock: Playwright/Chromium con `vite --mode e2e`, autenticación sintética y `fetch` interceptado antes de cargar la aplicación.
- Integración real: no existe suite automatizada y no debe ejecutarse contra Dynamics productivo.

Comandos disponibles: `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e` y `npm run test:smoke`. Los fixtures E2E no alimentan módulos productivos ni contienen tokens reales.

CI ejecuta instalación limpia, lint, 136 pruebas Vitest, build MSAL, instalación de Chromium y E2E. No requiere secretos empresariales. En Windows restringido puede ser necesario iniciar Vite E2E por separado y Playwright reutiliza el servidor; en CI Linux el `webServer` lo administra.

## Smoke test de staging/producción

Usar cuenta y datos autorizados. Marcar `N/A` sólo con aprobación.

- [ ] Login y renovación silenciosa; 401 controlado.
- [ ] Seleccionar empresa, vendedor y validar permisos/home.
- [ ] Clientes, productos, variantes, inventario, precios/promociones/acuerdos.
- [ ] Crear draft, refrescar y revisar restauración segregada.
- [ ] Crear un pedido controlado; verificar número y líneas una sola vez.
- [ ] Historial y detalle; editar/cancelar línea únicamente con pedido de prueba.
- [ ] Confirmar pedido únicamente con pedido de prueba.
- [ ] Listar/subir/abrir adjunto autorizado.
- [ ] Facturas, estado de cuenta, aging y PDF válido.
- [ ] Direcciones; creación sólo después de resolver geografía GET-body.
- [ ] Soporte con destinatario/ambiente autorizado.
- [ ] Cambiar Empresa A → B y comprobar ausencia total de datos/draft A.
- [ ] Logout, regreso a login y ausencia de datos previos; comprobar que recovery real permanece trazable.
- [ ] Refrescar rutas profundas directamente.
- [ ] Revisar desktop, tablet y viewport móvil; teclado, focus, labels, dialogs, errores, tablas y contraste.
