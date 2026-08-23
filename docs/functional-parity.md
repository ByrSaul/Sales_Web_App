# Paridad Mobile ↔ Web

Estados permitidos por la auditoría final:

| Área | Funcionalidad Mobile | Web | Estado | Diferencia | Bloqueo |
|---|---|---|---|---|---|
| Autenticación | Microsoft | MSAL popup/silent | PARIDAD CON ADAPTACIÓN WEB | Public client SPA | Entra pendiente prod |
| Empresa/vendedor/usuario/permisos | Contexto operativo | Guards y providers reales | PARIDAD COMPLETA | — | — |
| Clientes | Consulta asignada | Consulta, filtros y detalle | PARIDAD COMPLETA | UI responsive | — |
| Productos/variantes | Catálogos | Servicios reales | PARIDAD COMPLETA | — | — |
| Inventario/precios | Consulta | Servicios reales por empresa/vendedor | PARIDAD COMPLETA | — | — |
| Promociones/acuerdos | Selección de líneas | Draft integrado | PARIDAD COMPLETA | — | — |
| Draft | Estado en flujo | Persistencia Web 7 días | PARIDAD CON ADAPTACIÓN WEB | localStorage segregado | — |
| Creación pedido | Header y líneas | Runner con recovery conservador | PARCIAL POR BACKEND | Evita retry ciego | BE-04/06/07 |
| Historial/detalle | Consulta | Rutas y contratos reales | PARIDAD COMPLETA | Filtros URL | — |
| Edición/cancelación | Por InventoryLotId | Mutaciones sin retry | PARCIAL POR BACKEND | Depende del ID real | BE-05 |
| Confirmación | Servicio Dynamics | Mutación sin retry | PARIDAD CON ADAPTACIÓN WEB | Lock UI | Validación real |
| Adjuntos | Listar/subir/abrir | Validación, Blob y revoke | PARCIAL POR BACKEND | Browser no admite GET-body | BE-03/08 |
| Facturas/statement/aging | Consulta financiera | Rutas, filtros y resumen | PARIDAD COMPLETA | Tablas responsive | — |
| PDF | SSRS | Firma `%PDF`, Blob/revoke | PARIDAD CON ADAPTACIÓN WEB | Apertura/descarga browser | — |
| Direcciones | Consultar/crear | Consulta y alta segura | PARCIAL POR BACKEND | Geografía bloqueada | BE-01/02 |
| Soporte | Mensaje/imágenes | Payload real y límites | PARIDAD CON ADAPTACIÓN WEB | Selector de archivos | BE-08 |
| Logout/cambio empresa | Reinicia contexto | Limpia cache/draft y conserva recovery | PARIDAD CON ADAPTACIÓN WEB | Protección transaccional | — |
| Producción/forecast | Consultas disponibles | Módulos reales de Fase 9 | NO IMPLEMENTADO JUSTIFICADAMENTE | No forman parte de la matriz Mobile mínima | No aplica paridad |

Una pantalla no fue considerada completa por existir: se verificaron servicios, payloads, mappers, query keys y bloqueo seguro donde el navegador no puede ejecutar el contrato.

