# Cobertura funcional de componentes React — 2026-10-19

## 1. Objetivo y resultado

Se añadieron **101 pruebas funcionales** en siete suites de componentes React. La ejecución completa aprobó **331/331 pruebas en 41 archivos**, conservando las 230 pruebas existentes y sin errores no controlados. `npm run build`, `npm run lint` y `npx tsc --noEmit` finalizaron correctamente.

Solo se crearon archivos de pruebas y este informe. No se modificaron componentes productivos, contratos HTTP, dependencias, exclusiones, configuración de cobertura ni Quality Gate. No se hicieron solicitudes a Dynamics ni se ejecutó SonarScanner. Los cambios productivos que ya estaban en el workspace se conservaron.

## 2. Prioridad y límites de la evidencia

El usuario confirmó desde la interfaz de SonarQube:

| Área | Coverage on New Code | Líneas nuevas sin cubrir | Condiciones nuevas sin cubrir |
|---|---:|---:|---:|
| src/components | 13.6% | 246 | 293 |
| src/features | 96.5% | 0 | 3 |

El Quality Gate informado estaba Failed, con cobertura New Code global 23.6%, objetivo 80%, cero bugs/vulnerabilidades/hotspots nuevos y cuatro Code Smells nuevos. Estas cifras corresponden al último análisis comunicado por el usuario, no a una nueva medición del servidor después de estas pruebas.

La consulta inicial de solo lectura de medidas SonarQube respondió 401. No había SONAR_TOKEN en el entorno. El usuario autorizó continuar con LCOV y cambios locales sin solicitar credenciales ni volver a consultar la API. No se leyó ni utilizó un token incrustado en archivos. No se dispone del desglose exacto por archivo ni de las condiciones del período New Code.

Se priorizaron los archivos que simultáneamente tenían cambios locales respecto a HEAD, complejidad condicional relevante y 0% de líneas cubiertas en el LCOV previo: AddExistingOrderLinePage, VatSelector, NewAddressForm, CustomerAddressSelector, AccountStatementPage, Sidebar y TopBar. Se revisó su implementación y se verificó que no tenían suites propias. Las pruebas existentes de otras páginas se mantuvieron intactas.

El volumen del diff se utilizó solo como orientación: puede contener formato y cambios anteriores al período de SonarQube. **No se presupone que todo el código de src/components, ni todo el diff local, sea New Code.** Los archivos de adjuntos ya tenían 100% de líneas en el baseline anterior y se conservaron.

## 3. Cobertura local individual

LCOV final de `npm run test:coverage`. Los porcentajes cubren el archivo completo instrumentado; no son porcentajes de New Code ni equivalencias exactas de las condiciones calculadas por SonarQube.

| Componente productivo | Pruebas nuevas | Líneas cubiertas | Ramas cubiertas | Funciones cubiertas |
|---|---:|---:|---:|---:|
| `src/components/pages/AddExistingOrderLinePage.tsx` | 34 | **99.55% (226/227)** | **97.06% (265/273)** | 98.41% (62/63) |
| `src/components/orders/VatSelector.tsx` | 15 | **100% (52/52)** | **97.26% (71/73)** | 100% (19/19) |
| `src/components/orders/NewAddressForm.tsx` | 12 | **100% (47/47)** | **100% (26/26)** | 100% (17/17) |
| `src/components/orders/CustomerAddressSelector.tsx` | 12 | **100% (34/34)** | **97.29% (36/37)** | 100% (15/15) |
| `src/components/pages/AccountStatementPage.tsx` | 16 | **100% (29/29)** | **96.66% (29/30)** | 100% (13/13) |
| `src/components/layout/Sidebar.tsx` | 7 | **100% (19/19)** | **93.75% (15/16)** | 100% (8/8) |
| `src/components/layout/TopBar.tsx` | 5 | **100% (6/6)** | **100% (12/12)** | 100% (1/1) |

Las siete suites agregan 101 casos. Los siete archivos suman 413/414 líneas cubiertas y 454/467 ramas. No se ejecutaron handlers privados desde tests ni se exportaron funciones internas para alcanzar cobertura; los flujos se accionan desde elementos de la interfaz y eventos del navegador.

## 4. Escenarios agregados

### 4.1 AddExistingOrderLinePage

- Encabezado cargando, fallido, ausente y pedido cerrado; regreso al detalle y error recuperable de consulta.
- Cuenta de contado sin comprobante, enlace a adjuntos y verificación de pago antes del envío.
- Búsqueda de productos con debounce: carga, error, vacío y paginación.
- Productos simples/maestros, variante obligatoria, dimensiones enviadas al precio y forzar registro condicionado al país de entrega.
- Consulta de precio fallida, recuperación, precio cero con mensaje, edición de precio con permiso anidado y validación de cantidad/precio.
- Selección de inventario, validación, edición/cancelación de pendientes, bonificación independiente y promoción vinculada; eliminar la línea original retira su bonificación.
- Persistencia local, recuperación corrupta, clave heredada ausente, protección beforeunload y confirmación al abandonar pendientes.
- Envío secuencial con claves persistidas antes del POST; no crea otra cabecera ni utiliza una ruta diferente para acomodar las pruebas.
- Doble clic durante upload de línea y durante comprobación de pago: no duplica la solicitud en esos escenarios.
- Timeout detiene las líneas siguientes, conserva clave/payload y bloquea envío hasta consulta. Replay confirma y continúa pendientes.
- Restaurar submitting produce ambiguous y no envía automáticamente. Processing permanece bloqueado.
- Failed exige GET complementario: evidencia insuficiente bloquea, CREATED recupera el efecto y NONE autorizado permite otra clave. El POST de consulta conserva la clave original.
- Línea de acuerdo utiliza su endpoint especializado y conserva MatchingAgreementLine.

Se usan QueryClientProvider/QueryClient reales, mappers y servicios de creación existentes. Se simulan las respuestas de catálogos y el transporte ApiClient; se comprueba el payload y el header Idempotency-Key. Ningún test crea datos reales en Dynamics.

### 4.2 VatSelector

Debounce y habilitación de búsqueda, selección/quitar NIF, estados cargando/error/vacío, paginación y bloqueo del botón mientras carga. Cambio de país limpia el término y mantiene la consulta deshabilitada mientras el debounce conserva el texto anterior.

Creación validada por país: PAN requiere tipo de contribuyente, SLV requiere tipo de persona y GTM no inventa esos valores. Se comprueban trim de campos, payload, selección devuelta, errores estructurados/no estructurados, cancelación, catálogos vacíos/ausentes/fallidos y estado pendiente de la mutación.

### 4.3 NewAddressForm

Validación previa a la mutación, jerarquía habilitada progresivamente, reinicio de todos los descendientes al cambiar país/estado/municipio/ciudad, payload completo y callback con la dirección devuelta. Catálogos ausentes, cargando o fallidos, fallback de nombre de ciudad, cancelación y errores de creación. El botón queda bloqueado cuando el hook informa una mutación pendiente.

### 4.4 CustomerAddressSelector

Campo deshabilitado sin cliente; debounce real de 1000 ms y filtrado por descripción, dirección o país. Selección del objeto original, fallback sin descripción, cambio de cliente y selección, opción Cambiar, Escape, clic interno/externo y limpieza de listener al desmontar. Estados sin datos, cargando, error con retry y resultados cacheados durante refetch.

### 4.5 AccountStatementPage

Cuenta ausente/blanca, filtros URL y trim, multiempresa, carga/error/retry/vacío, totales corrientes/vencidos y suma visual. Documentos con y sin factura interna/moneda, buckets de antigüedad, rutas con cuenta/voucher codificados y preservación del contexto multiempresa.

Solicitud de PDF con nombre devuelto/fallback, errores de solicitud y apertura, limpieza del error al consultar nuevamente y botón bloqueado mientras el reporte está pendiente. Las pruebas de estado pendiente representan la información del hook; no demuestran una exclusión global o entre pestañas.

### 4.6 Sidebar y TopBar

Sidebar verifica ruta activa, navegación, cierre del drawer, cambio de compañía/logout mediante sesión y módulos producción/forecast con cada combinación de flags. Incluye callbacks opcionales ausentes y versión móvil.

TopBar verifica prioridades de identidad: nombre operativo, ID, nombre heredado y No disponible; trim de compañía/vendedor, inicial y menú o regreso según callback.

## 5. Validación completa y artefacto

| Validación | Resultado |
|---|---|
| Nuevas suites enfocadas | 7 archivos, 101 pruebas aprobadas |
| `npm run test:coverage` | **41 archivos, 331 pruebas aprobadas, 0 fallidas, 0 errores no controlados** |
| `npx tsc --noEmit` | Aprobado |
| `npm run build` | Aprobado; TypeScript y Vite, 1208 módulos transformados |
| `npm run lint` | Aprobado, sin warnings |

Comparación global local con el baseline previo, usando el mismo alcance explícito de todo src:

| Métrica | Baseline: 230 pruebas | Actual: 331 pruebas |
|---|---:|---:|
| Líneas | 40.44% (1245/3078) | **54.45% (1676/3078)** |
| Ramas | 34.38% (1135/3301) | **49.19% (1624/3301)** |
| Funciones | 33.12% (375/1132) | **46.37% (525/1132)** |
| Sentencias | 40.66% (1409/3465) | **53.79% (1864/3465)** |

Solo src/components, sobre archivos completos: 754/1379 líneas y 837/1693 ramas. El resto del directorio incluye páginas antiguas sin pruebas; estos denominadores no corresponden a las 246 líneas/293 condiciones nuevas pendientes informadas por SonarQube.

Artefacto regenerado: [`coverage/lcov.info`](../coverage/lcov.info), ignorado por Git. Se verificó que sus rutas SF existan y correspondan a src. El archivo mantiene registros de los componentes nuevos y de los adjuntos cubiertos previamente. La configuración `sonar.javascript.lcov.reportPaths=coverage/lcov.info` se conserva sin modificar.

## 6. Archivos creados en esta ampliación

1. `src/components/pages/AddExistingOrderLinePage.test.tsx`.
2. `src/components/pages/AccountStatementPage.test.tsx`.
3. `src/components/orders/VatSelector.test.tsx`.
4. `src/components/orders/NewAddressForm.test.tsx`.
5. `src/components/orders/CustomerAddressSelector.test.tsx`.
6. `src/components/layout/Sidebar.test.tsx`.
7. `src/components/layout/TopBar.test.tsx`.
8. Este informe: `docs/cobertura-componentes-2026-10-19.md`.

## 7. Pendientes

- **Confirmar New Code con otro análisis SonarQube.** No se declara alcanzado el 80% ni aprobado el Quality Gate con el LCOV local. Cuando esté disponible el desglose por archivo se podrá ajustar la prioridad sin confundir código antiguo con nuevo.
- Los cuatro Code Smells comunicados no tienen detalle por regla/archivo en esta tarea. No se afirma que estén resueltos; no se modificó lógica productiva para elevar métricas.
- La única línea instrumentada sin ejecutar entre los siete archivos es el regreso al detalle desde el bloqueo de comprobante de pago (AddExistingOrderLinePage, línea 569). Otras ramas remanentes incluyen defaults/guards; no se forzaron handlers internos ni se alteró DOM deshabilitado para inflar cobertura.
- Los formularios verifican bloqueo según el estado pendiente del hook. No se cambia ni se presume una garantía de exclusión entre pestañas o instancias.
- Se mantienen las discrepancias Backend y limitaciones de adjuntos descritas en [el informe anterior](./pruebas-cobertura-2026-10-19.md). Ningún endpoint fue cambiado.
