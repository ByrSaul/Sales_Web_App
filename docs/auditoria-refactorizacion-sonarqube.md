# Auditoría y refactorización de Sales4App Web Frontend

Fecha: 2026-10-19. Alcance: frontend, sin commits ni despliegues.

**Estado vigente:** consulte [Recuperación de Coverage on New Code](#recuperación-de-coverage-on-new-code--2026-10-19). Las secciones anteriores documentan la fase de refactorización; el último análisis comunicado es FAILED con 76.2% de New Code.

## Resultado y límites

Se conservaron las **331 pruebas iniciales** y se agregaron **55 casos**: **386/386 aprobados en 46 archivos**, sin pruebas fallidas ni errores no controlados en Vitest. TypeScript, ESLint y build aprobados. Se regeneró `coverage/lcov.info`.

El análisis local final recorrió **175 archivos** (167 de src, dos de e2e, cinco de configuración en la raíz y el script de auditoría). No quedan hallazgos de las reglas seleccionadas en ese análisis. Esta conclusión **no equivale a resolver todos los issues del servidor**.

El último estado comunicado por el usuario es Quality Gate Passed, New Code 98.3%, duplicación New Code 0.13% y ratings A. **No se ejecutó SonarScanner ni se volvió a consultar su API; el Quality Gate posterior a estos cambios queda sin verificar.** No se solicitaron ni almacenaron credenciales. La cobertura local global no representa el período New Code.

## Método e inventario

Se comparó contra una copia del workspace al iniciar esta auditoría, que ya contenía cambios del usuario y de las tareas anteriores. No se utilizó HEAD como supuesto baseline limpio. Se recorrieron recursivamente fuentes, servicios, hooks, providers, utilidades, formularios, pruebas, e2e y configuraciones TS/JS. Se revisaron por AST los callbacks, operadores condicionales y claves, además de usar análisis tipado.

Herramientas: ESLint 10.9.0, @typescript-eslint 8.67.0 y eslint-plugin-sonarjs 4.2.2. Este plugin local tiene una versión y conjunto de reglas distintos al analizador configurado en SonarQube 9.9.8. Los niveles siguientes son prioridades de revisión locales, no severidades importadas del servidor.

| Patrón revisado | Inicial | Final local | Prioridad/riesgo |
|---|---:|---:|---|
| Complejidad cognitiva >15 (S3776) | 5 funciones | 0 | Alta en operaciones transaccionales; media en UI |
| Ternarios anidados (S3358) | 50 | 0 | Media: conservar prioridad y evaluación diferida |
| Promesas sin consumir / callbacks void | 15 / 70 | 0 / 0 | Alta para mutaciones; media para consultas/navegación |
| role=status con alternativa nativa (S6819) | 7 | 0 | Media: anuncios accesibles y presentación |
| Claves con índice (S6479) | 8 por AST + 2 por revisión | 0 | Media: identidad al filtrar, eliminar o paginar |
| Math.random (S2245, revisión contextual) | 3, exclusivamente en pruebas | 0 | Baja: fixtures; ninguna clave productiva usaba este patrón |
| Import sin utilizar (S1128) | 1 | 0 | Baja |
| Escrituras muertas y ramas duplicadas | 0 | 0 | Sin hallazgos confirmados en las reglas seleccionadas |

Los 70 avisos tipados no son 70 defectos de ejecución demostrados: incluyen la firma de React Router `void | Promise<void>`. Se unificó su manejo seguro para soportar ambos modos. Los avisos de timers/act en pruebas se resolvieron con callbacks explícitamente síncronos. El inventario inicial y la lista final de archivos están en [auditoria-calidad-inicial.json](auditoria-calidad-inicial.json) y [auditoria-calidad-local.json](auditoria-calidad-local.json).

## Cambios y validación por regla

| Regla | Archivo | Problema | Solución | Validación |
|---|---|---|---|---|
| S3776 | AddExistingOrderLinePage.tsx | Componente 27; envío secuencial 36 | Hook usePendingOrderLines para persistencia/exclusión/recuperación; hook useExistingOrderLinePrice; vistas PendingOrderLines y OrderProductSearchResults | 37 pruebas de página; claves/body conservados; análisis local |
| S3776 | AddOrderLinePage.tsx | Complejidad 18 | Precio mostrado resuelto mediante guardas, sin cambiar condiciones comerciales | Complejidad 13; TS/build/lint; validación de selección reutilizada |
| S3776 | core/api/apiClient.ts | request 24 | Separar adquisición de token, decisión de renovación y decodificación de respuesta | request 9; 19 casos HTTP; 401 transaccional sin retry |
| S3776 | features/orders/submissionRunner.ts | uploadAttachments 23 | Separar carga individual, evidencia de persistencia y comprobante remoto | Orquestación 5; métodos extraídos 4/2/4; 42 pruebas del runner |
| Promesas tipadas | core/async/uiAction.ts, core/hooks/useSafeNavigate.ts y consumidores | Rechazos en eventos, efectos o navegación sin frontera de error | Ejecución inmediata una sola vez con catch explícito; mensaje seguro; navegación admite ruta/opciones/delta | Ocho pruebas nuevas de frontera/navegación; lint tipado en src y auditoría tipada ampliada |
| Promesas tipadas | usePendingOrderLines.ts | Fallos en verificación de pago, persistencia o invalidación podían escapar y dejar bloqueo visual | catch con mensaje local y finally para exclusión/estado; sin reenviar POST por el error | Pago rechazado, liberación de lock y verificación repetida con misma clave/body |
| S6819 | ProtectedLayout, AddExistingOrderLinePage/PendingOrderLines, OrderAttachmentsPage, OrderDetailPage, OrderDraftReviewPage, SupportPage | Contenedores con role=status | output con aria-live polite/aria-atomic; display block solo en antiguos contenedores de bloque | Pruebas existentes de mensajes y estados aprobadas |
| Accesibilidad adicional | components/ui/index.tsx, Sidebar, TopBar | Labels desconectados, tarjetas clicables y overlays sin teclado, botones de icono sin nombre | useId + htmlFor; tarjetas interactivas/overlays como botones nativos; nombres accesibles | Pruebas de labels, IDs estables, tarjeta nativa y suites de layout |
| S3358 | Páginas AccountStatement, AddOrderLine, Clients, CustomerAddresses, Forecast, Inventory, Invoices, OrderDraftReview, Production, Products y tarjetas Dashboard | Prioridades condicionales anidadas | Guardas con nombres según su contenido; se conserva el orden loading/error/vacío/datos | Suites de componentes, diez pruebas nuevas de tarjetas y análisis AST |
| S3358 | env/AuthProvider/ProtectedLayout, servicios address/catalog/VAT/forecast, mapeadores y submissionStorage | Selección de modos, envelopes o recuperación anidada | Condiciones independientes con el mismo orden y fallback | Pruebas de contratos, recuperación y diez casos VAT nuevos |
| S6479 | AddExistingOrderLine, AddOrderLine, Inventory, Forecast, Production | Índices incorporados a claves | Tuplas de identidad comercial, empresa, almacén y dimensiones; sin cantidades cambiantes | AST final contempla índices de map incluso dentro de IIFEs |
| S6479 | SupportPage.tsx | Clave nombre+índice al eliminar adjuntos iguales | UUID criptográfico asignado una vez al seleccionar; eliminación por ID; File[] original al enviar | Prueba conserva el nodo del segundo archivo y envía solo ese File |
| S6479 | selectionValidation.ts y OrderDraftReviewPage | Índice o texto potencialmente repetido de errores | Identidad de producto/bonificación/código/campo para preview, localId persistido para revisión | Suite de selección/bonificaciones aprobada; sin UUID generado para construir keys |
| S2245 | domain.test, orderSubmissionMapper.test, OrderDraftReviewPage.test | Fixtures con Math.random | Contador determinista solo en el mock de crypto de las pruebas | Suite completa; generador criptográfico productivo sin cambios |
| Ciclo de recursos | features/attachments/attachmentService.ts | Excepción al abrir o descargar dejaba URL sin revocar | Programar revocación en finally sin cambiar MIME, nombres, Base64 o demora | Dos pruebas nuevas de excepción; cobertura de líneas 100% |
| S1128 | DashboardHero.tsx | Import Icon innecesario | Retirar import sin uso | Auditoría y ESLint |

### Complejidad de la cola extraída

`processLine` queda en 15, `sendLines` en 8 y `execute` en 6. La página queda en 15. La extracción separa responsabilidades operativas y visuales; no cambia el umbral ni desactiva reglas.

### Conservación transaccional y contratos

Se mantienen las claves persistidas antes de cada POST, la exclusión síncrona mediante ref, los estados pending/submitting/failed/ambiguous y la interrupción ante un resultado sin confirmar. El modo de verificación de líneas conserva **el mismo endpoint, clave y payload**; no crea otra clave. Solo evidencia read-only del backend habilita una nueva solicitud tras fallo confirmado. La restauración convierte submitting en ambiguous y no envía nada al montar.

La verificación de adjuntos solo consulta su listado; una excepción de listado no provoca otro upload. Se mantiene la heurística existente por nombre y descripción, sin presentarla como identidad criptográfica del contenido. El endpoint de adjuntos conserva su contrato actual; no se inventó soporte de Idempotency-Key.

La comparación estática de los servicios encontró **53 llamadas HTTP antes y 53 después, con los mismos métodos y expresiones de ruta**. Las suites comprueban también payloads, permisos, precios, bonificaciones, comprobante, confirmación/cancelación y persistencia. La prueba de doble clic detectó durante la extracción una espera adicional antes del primer POST; se corrigió y conserva el inicio inmediato y la persistencia previa originales.

No se cambiaron endpoints para alinearlos con contratos históricos. Las discrepancias previas siguen documentadas en [pruebas-cobertura-2026-10-19.md](pruebas-cobertura-2026-10-19.md) y los documentos de contratos existentes. Los contratos efectivos se conservan hasta contar con evidencia adicional del backend.

## Pruebas y cobertura

Se añadieron 55 casos: 5 de uiAction, 3 de navegación, 9 HTTP, 10 del runner, 3 de AddExistingOrderLinePage, 2 de apertura de adjuntos, 1 de soporte, 2 de controles/tarjeta, 10 de tarjetas Dashboard y 10 de VAT. Se conservaron casos y aserciones previos; las tablas de mensajes y stubs deterministas no reducen escenarios.

| Validación | Resultado |
|---|---|
| npm run test:coverage | 386/386 pruebas, 46 archivos, 0 errores no controlados |
| npx tsc --noEmit | Aprobado |
| npm run build | Aprobado; 1216 módulos; sin sourcemaps productivos |
| npm run lint | Aprobado, max-warnings 0, incluidas reglas nuevas |
| npm run audit:quality -- --output docs/auditoria-calidad-local.json | 175 archivos, 0 hallazgos en reglas seleccionadas |
| git diff --check | Aprobado |
| npm run test:smoke | 2/2 aprobados en Chromium; API e identidad simuladas |

| Cobertura global local | Antes | Después |
|---|---:|---:|
| Líneas | 54.45% (1676/3078) | **57.46% (1894/3296)** |
| Ramas | 49.19% (1624/3301) | **52.41% (1738/3316)** |
| Sentencias | 53.79% | 56.92% (2158/3791) |
| Funciones | 46.37% | 49.84% (623/1250) |

Las extracciones y guardas cambian el número de líneas instrumentadas; los porcentajes por archivo no se comparan sin considerar el código movido a hooks/vistas. No se cambiaron exclusiones de cobertura, configuración de Sonar ni Quality Gate. LCOV cubre todo src instrumentado, incluidas áreas sin pruebas; no es una medición de New Code.

| Archivo productivo | Líneas | Ramas |
|---|---:|---:|
| `src/components/orders/DraftAttachments.tsx` | 100.00% (26/26) | 100.00% (25/25) |
| `src/components/orders/OrderProductSearchResults.tsx` | 100.00% (7/7) | 100.00% (20/20) |
| `src/components/orders/PendingOrderLines.tsx` | 100.00% (19/19) | 100.00% (27/27) |
| `src/components/pages/AddExistingOrderLinePage.tsx` | 100.00% (117/117) | 95.80% (137/143) |
| `src/components/pages/OrderAttachmentsPage.tsx` | 100.00% (84/84) | 91.43% (64/70) |
| `src/core/api/apiClient.ts` | 100.00% (55/55) | 88.64% (39/44) |
| `src/core/async/uiAction.ts` | 100.00% (7/7) | 100.00% (3/3) |
| `src/core/hooks/useSafeNavigate.ts` | 100.00% (6/6) | 100.00% (2/2) |
| `src/features/attachments/attachmentService.ts` | 100.00% (60/60) | 91.18% (31/34) |
| `src/features/catalogs/vatService.ts` | 100.00% (19/19) | 100.00% (40/40) |
| `src/features/dashboard/components/DashboardHighlightCard.tsx` | 100.00% (8/8) | 100.00% (6/6) |
| `src/features/dashboard/components/DashboardMetricCard.tsx` | 100.00% (10/10) | 100.00% (11/11) |
| `src/features/orders/submissionRunner.ts` | 89.59% (241/269) | 84.09% (111/132) |
| `src/features/orders/useExistingOrderLinePrice.ts` | 100.00% (14/14) | 100.00% (24/24) |
| `src/features/orders/usePendingOrderLines.ts` | 100.00% (100/100) | 96.61% (57/59) |

Los tres archivos de adjuntos previamente identificados mantienen **100% de líneas**. AddExistingOrderLinePage y las dos vistas y el hook de precio extraídos alcanzan 100% de líneas; las vistas y precio también 100% de ramas. Las ramas globales todavía tienen huecos, especialmente providers y páginas fuera de las suites existentes.

## Prevención y reproducción

Se agregó eslint-plugin-sonarjs como dependencia de desarrollo y se incorporaron explícitamente las reglas revisadas a ESLint, incluyendo complejidad máxima 15 y manejo tipado de promesas. `npm run audit:quality` amplía el recorrido a TS/JS fuera de src y comprueba por AST las claves y status. No incluye archivos generados ni dependencias externas. Su inventario JSON enumera exactamente los archivos recorridos.

```powershell
npm ci
npm run test:coverage
npx tsc --noEmit
npm run build
npm run lint
npm run audit:quality -- --output docs/auditoria-calidad-local.json
```

## Validación de navegador, riesgos y pendientes

Los smoke tests usan modo e2e e identidad/API simuladas. El primer intento no pudo lanzar Chromium porque faltaba el ejecutable de Playwright; se instaló el headless shell en una carpeta temporal y se repitió la validación: **2/2 aprobados**. Comprueban completar empresa/vendedor y entrar al Dashboard, además de la navegación directa SPA protegida. Este recorrido no sustituye una prueba con autenticación Microsoft ni servicios Dynamics reales.

Para reproducirlo en un equipo sin Chromium de Playwright: `npx playwright install chromium --only-shell`, seguido de `npm run test:smoke`. En esta ejecución se usó `PLAYWRIGHT_BROWSERS_PATH` temporal, únicamente para almacenar el navegador de validación fuera del proyecto.

Pendientes que no se presentan como aprobados:

- Ejecutar un nuevo análisis SonarQube con el perfil real para confirmar Quality Gate, New Code, duplicación, hotspots y reglas adicionales. No se infieren estos resultados desde ESLint ni LCOV.
- Validar con lector de pantalla los output y labels; revisar apariencia/foco de tarjetas y overlays en móvil y escritorio. Los tests DOM no sustituyen esa comprobación visual.
- Validar contra un entorno de pruebas Dynamics los flujos de autenticación MSAL, renovación, precios/permisos y los resultados ambiguos reales de cargas y líneas. Los tests locales no enviaron operaciones comerciales reales.
- Confirmar la unicidad de las claves compuestas de agregados de inventario/forecast/producción con datos representativos del backend. Se incluyeron sus dimensiones comerciales; no se dispone de un recId en esos DTO. No se fusionaron ni eliminaron registros.
- Las cargas siguen dependiendo de la heurística existente nombre/descripción y del contrato efectivo del backend. Una mejora por hash o clave de carga requeriría un contrato explícito; no se introdujo durante esta auditoría.

No hay pruebas Vitest fallidas ni rechazos no controlados conocidos pendientes en los flujos ejecutados. La revisión local de reglas seleccionadas no constituye certificación completa de seguridad o accesibilidad.

## Archivos modificados durante esta auditoría

Esta lista compara con la copia inicial de esta fase; el git status completo incluye además cambios previos que se conservaron. La mayoría de páginas recibe solo la frontera de promesas/navegación o la sustitución del ternario confirmado. No se modificaron Backend ni Mobile.

- `src/App.tsx`
- `src/main.tsx`
- `src/app/config/env.ts`
- `src/app/providers/AuthProvider.tsx`
- `src/app/providers/SessionProvider.tsx`
- `src/app/router/ProtectedLayout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/TopBar.tsx`
- `src/components/orders/CustomerAddressSelector.test.tsx`
- `src/components/orders/CustomerAddressSelector.tsx`
- `src/components/orders/NewAddressForm.tsx`
- `src/components/orders/OrderProductSearchResults.tsx`
- `src/components/orders/PendingOrderLines.tsx`
- `src/components/orders/VatSelector.test.tsx`
- `src/components/orders/VatSelector.tsx`
- `src/components/pages/AccountStatementPage.test.tsx`
- `src/components/pages/AccountStatementPage.tsx`
- `src/components/pages/AddExistingOrderLinePage.test.tsx`
- `src/components/pages/AddExistingOrderLinePage.tsx`
- `src/components/pages/AddOrderLinePage.tsx`
- `src/components/pages/AgingPage.tsx`
- `src/components/pages/ClientsPage.tsx`
- `src/components/pages/CompanySelectPage.tsx`
- `src/components/pages/CreateOrderPage.tsx`
- `src/components/pages/CustomerAddressesPage.tsx`
- `src/components/pages/DashboardPage.tsx`
- `src/components/pages/FinancialDocumentPage.tsx`
- `src/components/pages/ForecastPage.tsx`
- `src/components/pages/InventoryPage.tsx`
- `src/components/pages/InvoicesPage.tsx`
- `src/components/pages/NewCustomerAddressPage.tsx`
- `src/components/pages/OrderAttachmentsPage.tsx`
- `src/components/pages/OrderDetailPage.tsx`
- `src/components/pages/OrderDraftReviewPage.test.tsx`
- `src/components/pages/OrderDraftReviewPage.tsx`
- `src/components/pages/OrdersPage.tsx`
- `src/components/pages/ProductionPage.tsx`
- `src/components/pages/ProductsPage.tsx`
- `src/components/pages/SupportPage.test.tsx`
- `src/components/pages/SupportPage.tsx`
- `src/components/pages/VendorSelectPage.tsx`
- `src/components/ui/fields.test.tsx`
- `src/components/ui/index.tsx`
- `src/core/api/apiClient.test.ts`
- `src/core/api/apiClient.ts`
- `src/core/async/uiAction.test.ts`
- `src/core/async/uiAction.ts`
- `src/core/hooks/useSafeNavigate.test.tsx`
- `src/core/hooks/useSafeNavigate.ts`
- `src/features/addresses/addressService.ts`
- `src/features/attachments/attachmentMappers.ts`
- `src/features/attachments/attachmentService.test.ts`
- `src/features/attachments/attachmentService.ts`
- `src/features/auth/LoginPage.tsx`
- `src/features/catalogs/catalogService.ts`
- `src/features/catalogs/inventoryIdentity.ts`
- `src/features/catalogs/vatService.test.ts`
- `src/features/catalogs/vatService.ts`
- `src/features/forecast/forecastService.ts`
- `src/features/orderDraft/domain.test.ts`
- `src/features/orderDraft/selectionValidation.ts`
- `src/features/orders/mutationOutcome.ts`
- `src/features/orders/orderSubmissionMapper.test.ts`
- `src/features/orders/orderSubmissionMapper.ts`
- `src/features/orders/submissionRunner.test.ts`
- `src/features/orders/submissionRunner.ts`
- `src/features/orders/submissionStorage.ts`
- `src/features/orders/useExistingOrderLinePrice.ts`
- `src/features/orders/usePendingOrderLines.ts`
- `src/features/dashboard/components/DashboardCards.test.tsx`
- `src/features/dashboard/components/DashboardHero.tsx`
- `src/features/dashboard/components/DashboardHighlightCard.tsx`
- `src/features/dashboard/components/DashboardMetricCard.tsx`
- `e2e/mockApi.ts`
- `eslint.config.js`
- `package.json`
- `package-lock.json`
- `scripts/audit-quality.mjs`
- `docs/auditoria-calidad-inicial.json`
- `docs/auditoria-calidad-local.json`
- `docs/auditoria-refactorizacion-sonarqube.md`

## Recuperación de Coverage on New Code — 2026-10-19

### Estado vigente y alcance

El usuario informó un nuevo análisis posterior a la refactorización: **Quality Gate FAILED**, únicamente por Coverage on New Code **76.2%**, mínimo 80%, objetivo de esta fase **85%** y 858 líneas nuevas por cubrir según su informe. También comunicó 0 bugs, vulnerabilidades y hotspots nuevos, cuatro Code Smells y ratings A. Ese resultado reemplaza como referencia vigente al Passed histórico descrito en las secciones anteriores.

Se añadieron **143 pruebas funcionales**. Resultado local final: **529/529 pruebas aprobadas en 54 archivos**, manteniendo las 386 previas, sin errores no controlados. Se modificaron únicamente ocho suites nuevas, una suite existente de pruebas y esta documentación. No se modificaron componentes, providers, hooks ni servicios productivos, contratos HTTP, reglas de precios/bonificación/inventario/idempotencia, configuración de cobertura, Quality Gate o período de New Code.

Los doce archivos prioritarios ya tienen cobertura funcional alta. **El objetivo de 85% de New Code y el Quality Gate Passed todavía no están confirmados**: el análisis local no reproduce el conjunto de líneas/condiciones del período del servidor.

### Pruebas agregadas

| Suite | Casos agregados | Comportamiento comprobado |
|---|---:|---|
| src/components/pages/CatalogPages.coverage.test.tsx | 23 | Products, Inventory y CustomerAddresses: resultados, debounce, variantes, selección, filtros, navegación, paginación y rechazos de consultas. |
| src/components/pages/ClientsPage.test.tsx | 17 | Búsqueda y paginación; selección/deselección; estados de direcciones; formulario nuevo; invalidación; NIF condicionado a cliente y país; rechazos. |
| src/components/pages/CompanySelectPage.test.tsx | 5 | Carga diferida, selección explícita, contexto previo, lista vacía, moneda ausente, error y retry manual. |
| src/components/pages/PlanningPages.coverage.test.tsx | 21 | Forecast y Production: loading/error/vacío/éxito; fechas; filtros aplicados; paginación; métricas cero/importe/volumen; modos de producción. |
| src/components/pages/OrdersPage.coverage.test.tsx | 12 | Consulta habilitada únicamente al buscar; filtros; limpiar; historial; paginación; navegación codificada; recuperación local por compañía/estado. |
| src/components/pages/AddOrderLinePage.test.tsx | 17 | Producto/variante/stock/precio; permisos; override; cantidad; bonificaciones/promociones; convenio y saldo; estados y rechazos asíncronos; registro forzado. |
| src/components/pages/OrderDraftReviewPage.test.tsx | 24 | Ampliación conservando seis casos existentes: edición y bloqueo, confirmaciones, validaciones, navegación de éxito, recuperación, cargas inciertas y rechazos. |
| src/app/router/ProtectedLayout.test.tsx | 7 | Módulo activo, títulos, identidad, advertencia accesible, FAB, navegación e historial real de MemoryRouter. |
| src/app/providers/AuthProvider.test.tsx | 17 | MSAL con cuenta activa/cacheada/ausente, popup y silent; renovación forzada; login cancelado; errores; logout; modos dev-token/e2e explícitos. |

Las pruebas accionan controles y verifican mensajes, filtros, rutas, argumentos de callbacks, selección, habilitación/bloqueo, datos y cantidades reales. Se usan QueryClient/MemoryRouter reales cuando corresponden y servicios/MSAL simulados; no hay operaciones comerciales remotas. Los formularios de direcciones y NIF tienen sus propias suites existentes y se simulan en ClientsPage para comprobar la integración y el ciclo de selección sin duplicar sus pruebas internas. Los rechazos se esperan o se comprueba su presentación al usuario, sin reintentos automáticos.

### Cobertura local anterior y posterior

Se preservó el LCOV de las 386 pruebas antes de ejecutar esta fase y se comparó con el LCOV regenerado. Las cifras siguientes son de **archivo completo local**, no de New Code. El conjunto de líneas instrumentadas globales permanece en 3296 y el de ramas en 3316.

| Métrica global local | Antes: 386 pruebas | Después: 529 pruebas |
|---|---:|---:|
| Líneas | 57.46% (1894/3296) | **71.75% (2365/3296)** |
| Ramas | 52.41% (1738/3316) | **65.83% (2183/3316)** |
| Sentencias | 56.92% (2158/3791) | **70.56% (2675/3791)** |
| Funciones | 49.84% (623/1250) | **66.48% (831/1250)** |

| Archivo prioritario | Líneas antes → después | Ramas antes → después |
|---|---:|---:|
| src/app/providers/AuthProvider.tsx | 4.88% → **98.78%** | 0.00% → **93.75%** |
| src/app/router/ProtectedLayout.tsx | 0.00% → **100.00%** | 0.00% → **100.00%** |
| src/components/pages/AddOrderLinePage.tsx | 0.00% → **100.00%** | 0.00% → **95.14%** |
| src/components/pages/ClientsPage.tsx | 0.00% → **98.73%** | 0.00% → **89.66%** |
| src/components/pages/CompanySelectPage.tsx | 0.00% → **100.00%** | 0.00% → **100.00%** |
| src/components/pages/CustomerAddressesPage.tsx | 0.00% → **100.00%** | 0.00% → **100.00%** |
| src/components/pages/ForecastPage.tsx | 40.74% → **100.00%** | 33.33% → **95.56%** |
| src/components/pages/InventoryPage.tsx | 0.00% → **100.00%** | 0.00% → **100.00%** |
| src/components/pages/OrderDraftReviewPage.tsx | 58.46% → **100.00%** | 71.76% → **97.65%** |
| src/components/pages/OrdersPage.tsx | 46.34% → **100.00%** | 62.16% → **100.00%** |
| src/components/pages/ProductionPage.tsx | 37.50% → **100.00%** | 42.22% → **100.00%** |
| src/components/pages/ProductsPage.tsx | 0.00% → **100.00%** | 0.00% → **100.00%** |

Los doce archivos suman **99.63% de líneas (541/543)** y **96.45% de ramas (544/564)**. Tampoco este agregado equivale a New Code. Los tres archivos de adjuntos de la auditoría anterior conservan el 100% de líneas.

### Validaciones ejecutadas

| Comando | Resultado de esta fase |
|---|---|
| npm run test:coverage | 529/529 pruebas, 54 archivos, cero errores no controlados; coverage/lcov.info actualizado |
| npx tsc --noEmit | Aprobado |
| npm run build | Aprobado; 1216 módulos. El primer intento dentro del sandbox falló por spawn EPERM; la repetición autorizada con permisos de proceso pasó. |
| npm run lint | Aprobado; conserva complejidad máxima 15, análisis tipado de promesas y reglas SonarJS |
| npm run audit:quality | 183 archivos, cero hallazgos en las reglas seleccionadas; no sustituye SonarQube |
| SonarScanner CLI 8.0.1.6346 | Ejecutado tras autorización explícita del destino; código de salida 1 por falta de autenticación. Servidor accesible: SonarQube 9.9.8.100196. No se completó un nuevo análisis. |
| API de medidas, Quality Gate e issues | Las tres consultas devolvieron HTTP 401; resultados actuales no verificables desde esta sesión. |

### SonarScanner: destino autorizado; autenticación pendiente

El usuario autorizó expresamente ejecutar SonarScanner y enviar el código fuente y la cobertura a **http://192.168.1.163:9000**. Tras esa autorización se ejecutó SonarScanner CLI 8.0.1.6346 con la configuración existente y espera del Quality Gate. Se utilizó la variable SONAR_TOKEN solo si estaba disponible y se anularon argumentos de credenciales históricas; no se mostraron ni guardaron tokens.

El proceso alcanzó **SonarQube Server 9.9.8.100196**, pero terminó a las 14:16 del 2026-10-19 con código de salida **1**: el servidor requiere autenticación para analizar el proyecto. No llegó a completar ni publicar un nuevo análisis. La denegación automática inicial por destino quedó resuelta mediante la autorización explícita del usuario; el bloqueo vigente es de autenticación del servidor.

Se comprobó únicamente la presencia, sin imprimir valores, de SONAR_TOKEN, SONAR_LOGIN y SONAR_PASSWORD en los ámbitos de proceso, usuario y máquina: ninguna estaba disponible. Tampoco había credenciales en las variables de opciones/JSON del scanner del proceso ni propiedades de autenticación disponibles en las configuraciones revisadas.

También se intentaron consultas de solo lectura para el proyecto **sales4app-web-frontend**: medidas de cobertura/New Code, estado del Quality Gate e issues sin resolver. **Las tres devolvieron HTTP 401**. Por tanto, el 76.2% de New Code, Quality Gate FAILED y cuatro Code Smells continúan siendo el último estado comunicado por el usuario, no medidas verificadas después de estas 143 pruebas nuevas. No se confirma el objetivo de 85%, un Quality Gate Passed ni la lista actual de hallazgos remotos.

Pendiente: que SONAR_TOKEN esté configurado fuera del repositorio y sea accesible al proceso de análisis, con autorización suficiente para analizar y consultar el proyecto. No debe pegarse en el informe ni compartirse en la conversación. Después corresponde repetir el análisis, comprobar la importación del LCOV actualizado y leer las medidas y los issues reales. Si el resultado todavía no alcanza 85%, se ajustarán las pruebas utilizando su desglose efectivo.

No se recibió otro desglose por archivo del servidor además de los doce prioritarios. Se revisó el LCOV completo: aún existen huecos globales en SessionProvider, otras páginas y providers transaccionales; no se presupone que esos huecos pertenezcan al período New Code. Permanecen también las validaciones manuales de accesibilidad y de integración real con Microsoft/Dynamics documentadas en la auditoría anterior.
