# Inventario durante cambios de selección

Fecha: 2026-10-22.

## Causa y corrección

`useInventory` utilizaba `placeholderData: keepPreviousData`. Al cambiar la clave, React Query entregaba temporalmente los resultados de la selección anterior como datos disponibles: `isPending` era falso y la página seguía mostrando su tabla. No se encontró un problema en los endpoints ni un almacenamiento local duplicado de resultados.

Se retiró ese placeholder exclusivamente de la consulta de inventario. La clave conserva empresa, vendedor, producto, variante y página; la empresa se compara mediante `trim().toLowerCase()`. Los valores originales enviados al backend se conservan. La caché de una combinación vigente sigue disponible y no se elimina al cambiar de selección. Las consultas pendientes sin datos muestran el indicador existente y «Consultando inventario...», dentro de una región con `aria-live="polite"` y `aria-busy="true"`. No se oculta la caché válida de la misma selección por una actualización en segundo plano.

La página reinicia su estado local mediante la identidad normalizada de empresa: producto, variante, búsqueda y página no se trasladan a otra empresa. Las selecciones de producto y variante conservan sus reinicios originales de paginación. No se añaden efectos, temporizadores ni consultas manuales duplicadas.

Las consultas ya recibían y transmitían `AbortSignal`. Se conserva esa cancelación y el aislamiento por clave: aunque un transporte ignore la cancelación y complete tarde una respuesta anterior, esa respuesta no sustituye la selección actual. `useInventory` también es consumido por las páginas de agregar líneas; estas reciben ahora inventario exclusivo de su selección, sin modificar precios, bonificaciones, payloads ni operaciones transaccionales.

## Contratos conservados

- `POST /inventory`: empresa, vendedor (`sales_group`), producto (`itemid`), `multi_company: false`, `by_warehouse: true` y `pagination`.
- `POST /inventory/variant`: los mismos parámetros de consulta y `variantproduct` para la variante.
- Productos y variantes mantienen `/company/products` y `/company/products/variants`.

No se modificaron servicios, mapeadores, configuración de cobertura, SonarQube ni backend. Los datos de prueba utilizan los contratos existentes: `inventory`, `pagination`, `dataareaid`, `itemid`, `displayproductnumber`, `inventsiteid`, `inventlocationid`, `physicalinvent` y `totalavailable`.

## Pruebas de regresión

Se añadieron once casos en `InventoryPage.transitions.test.tsx`, con QueryClient, hooks, servicios y mapeadores reales. Solo se simulan la sesión y el transporte HTTP, con respuestas diferidas controladas:

1. Primera consulta y espera de variante obligatoria.
2. Cambio `LQ-000037-02` → `LQ-000037-04`, comprobando ausencia de filas anteriores antes de resolver la segunda petición.
3. Cambio de producto desde una segunda página; reinicio de variante y página.
4. Cambio de variante desde una segunda página; controles de paginación actuales.
5. Respuesta vacía, solo después de finalizar la carga.
6. Error del endpoint y reintento explícito para la selección vigente.
7. Limpieza del error al seleccionar otro producto.
8. Peticiones solapadas que terminan fuera de orden, incluso ignorando la cancelación.
9. Reutilización de caché válida al volver a una variante y aislamiento entre variantes.
10. Cambio de empresa sin filas ni selección de la empresa anterior.
11. Equivalencia de empresa por espacios/mayúsculas sin reescribir el valor enviado al backend.

La prueba crítica se ejecutó antes de la corrección y falló porque la tabla aún contenía `LQ-000037-02`. Tras la corrección comprueba también el estado de carga accesible y los resultados exclusivos de `LQ-000037-04`.

Durante la validación general se detectó una discrepancia previa: el commit `6acdab3` eliminó Producción y Forecast del menú, pero tres pruebas aún esperaban esas entradas. Se conservaron los tres escenarios de flags, comprobando ahora que las entradas eliminadas permanezcan ausentes y que Inventario siga navegando y cerrando el menú. Se retiró el import de `appConfig` que ese commit había dejado sin uso. No se restauraron funcionalidades de menú eliminadas por el usuario.

## Validación

| Validación | Resultado |
|---|---|
| `npm run test:coverage` | 570/570 pruebas aprobadas en 57 archivos; once casos nuevos; sin errores no controlados reportados |
| `npx tsc --noEmit` | Aprobado |
| `npm run build` | Aprobado, 1220 módulos |
| `npm run lint` | Aprobado, sin warnings |
| `npm run audit:quality` | 190 archivos revisados, cero hallazgos en las reglas seleccionadas, incluido el límite de complejidad 15 |
| `git diff --check` | Aprobado |

`coverage/lcov.info` se regeneró el 22 de octubre de 2026. Cobertura global local: líneas **75.17% (2619/3484)**, ramas **70.36% (2398/3408)**, sentencias **74.33% (2888/3885)** y funciones **70.16% (889/1267)**. `InventoryPage.tsx`: **100% de líneas (39/39)** y **97.44% de ramas (38/39)**.

El primer intento general encontró las tres discrepancias previas del menú descritas arriba. Otra ejecución simultánea con los analizadores agotó la espera de Testing Library al cargar el catálogo; la ejecución final completa pasó sin cambiar timeouts ni configuración. No se eliminaron casos ni se utilizaron skips.

LCOV local no representa el período New Code de SonarQube. No se ejecutó SonarScanner en esta corrección y no se afirma un Quality Gate verificado. Las pruebas utilizan transporte simulado; no se realizaron operaciones sobre Dynamics ni una validación visual en navegador real.
