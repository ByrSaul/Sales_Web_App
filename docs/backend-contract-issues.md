# Limitaciones contractuales del Backend

Auditoría de sólo lectura del proxy actual. No se modificó Backend.

| ID | Endpoint | Problema | Impacto Web | Riesgo | Severidad | Recomendación |
|---|---|---|---|---|---|---|
| BE-01 | GET `/d365/address/country_regions`, `/states`, `/counties`, `/cities`, `/zip_codes` | FastAPI exige modelo en body de GET | Navegadores/fetch no admiten body GET; alta de dirección queda bloqueada con seguridad | Flujo incompleto | P1 | Ofrecer POST de consulta o GET con query params documentados |
| BE-02 | GET `/d365/vat_num` y `/document_type` | Filtros en body GET | NIT/tipo documental no son consumibles de forma portable | Alta especial degradada | P1 | Contrato browser-compatible |
| BE-03 | GET `/d365/sales_header_documents_atachments` | Filtros en body GET | Listado de adjuntos puede fallar antes de red | Adjuntos degradados | P1 | POST de búsqueda o query params |
| BE-04 | GET `/d365/sales/line` | Recuperación usa body GET | No se puede verificar con fiabilidad si una línea ambigua ya existe | Riesgo de recovery detenido; Web evita retry ciego | P0 | Endpoint POST/GET compatible e idempotencia por línea |
| BE-05 | POST `/sales/details` | Debe devolver `InventoryLotId`; el mapper del proxy OData sí lo contempla, pero requiere validación real extremo a extremo | Sin ID no se puede editar/cancelar línea | Gestión degradada por respuesta real | P1 | Prueba contractual con respuesta real y campo obligatorio |
| BE-06 | POST `/d365/sales/line` y `/agreement` | `OrderedSalesQuantity` es `int`; Mobile/Web modelan cantidades numéricas potencialmente decimales | 422 o truncamiento conceptual | Pedido inválido | P1 | Alinear Decimal/float y reglas de negocio en los tres clientes |
| BE-07 | POST `/d365/sales` | No hay idempotency key contractual | Timeout/network tras crear encabezado deja resultado ambiguo | Duplicación si se reintenta | P0 | Idempotency-Key estable y consulta por clave de cliente |
| BE-08 | POST adjuntos/soporte | Sin idempotencia/correlation contractual visible | Timeout de upload/envío no puede reintentarse con certeza | Duplicado o estado incierto | P2 | Correlation/idempotency key y estado consultable |
| BE-09 | API global | No se encontró configuración CORS en el repositorio | Browser bloquea incluso contratos correctos si infraestructura no lo habilita | Go-live bloqueado | P0 | Allowlist por origen y preflight en staging/producción |

P0 significa que la capacidad afectada no debe habilitarse en go-live sin condición externa cumplida. Web no usa method override, proxy local ni query params inventados.

