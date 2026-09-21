# Plan: Módulo de Conciliación de Facturas (AFIP vs ERP)

> Objetivo: conciliar los comprobantes que figuran en **"Mis Comprobantes Recibidos" (AFIP)** contra las facturas cargadas en el **ERP**. Este documento reúne todas las consideraciones resueltas antes de escribir código, con las decisiones ya confirmadas por el usuario.

Analicé los cuatro archivos reales en `FACTURAS/` para que el diseño no se base en supuestos:

1. `Mis Comprobantes Recibidos - CUIT 30715919792 (44).xlsx` — export de AFIP.
2. `Factura.xlsx` — muestra parcial del libro de facturas del ERP (43 filas).
3. `Factura copia.xlsx` — **el libro completo del año** del ERP (773 filas), mismo formato que el anterior.
4. `Capasitio SAS - Proveedores.xlsx` — **maestro de proveedores del ERP** (445 proveedores, con CUIT).

---

## 1. Qué hay realmente en los archivos

### 1.1 AFIP — `Mis Comprobantes Recibidos - CUIT 30715919792 (44).xlsx`

- **113 comprobantes**, 1 sola hoja (`Sheet1`).
- **Fila 1 = título**, **fila 2 = headers reales**, datos desde fila 3. Ningún parser actual del proyecto tiene este offset → hay que manejarlo explícitamente (detectar la fila de headers, no asumir fila fija).
- **30 columnas**, la mayoría desglose de IVA por alícuota (0%, 2.5%, 5%, 10.5%, 21%, 27% × neto + IVA), casi siempre vacías salvo 2-3 por fila. Esta es la causa real del problema de "moverse mucho para ver un valor".
- **Tipos presentes**: `1 - Factura A` (55), `11 - Factura C` (46), `3 - Nota de Crédito A` (8), `81 - Tique Factura A` (1), `15 - Recibo C` (1), `63 - Liquidaciónes A` (2).
- **Clave natural**: `Punto de Venta` + `Número Desde` (=`Hasta` en el 100% de los casos). Ojo: hay 1 colisión de PtoVta+Número entre dos tipos distintos → la clave debe incluir siempre la letra/tipo.
- **Identificación del emisor**: `Nro. Doc. Emisor` = CUIT limpio y numérico (fuente confiable).
- **Multi-moneda real**: hay filas en `$` y `USD` con `Tipo Cambio` propio.
- No hay columna de estado (anulado/rechazado) en este export.

### 1.2 ERP — `Factura.xlsx` (muestra) y `Factura copia.xlsx` (año completo)

Mismo esquema de 14 columnas en ambos: `Fecha, F. Fiscal, Tipo, Comprobante, Proveedor, Moneda, Importe Bruto, Impuestos, Total, Observaciones, Provincia, Cotización, Total Mon. Principal, cbuinformada`. `Factura.xlsx` es un subconjunto de `Factura copia.xlsx` (mismas primeras filas) — **`Factura copia.xlsx` es la fuente real a usar**, `Factura.xlsx` era solo una muestra de prueba.

- **773 filas en el año completo**, con `Tipo` mucho más variado de lo que mostraba la muestra chica:

  | Tipo ERP | Cantidad | Notas |
  |---|---|---|
  | Factura | 650 | En alcance |
  | Nota de Crédito | 51 | **En alcance** — confirmado que sí se cargan, en negativo (ej. `-8733.95`) |
  | Nota de Débito | 1 | En alcance |
  | Recibo | 8 | **Fuera de alcance** (confirmado) |
  | Extracto Bancario | 62 | **Fuera de alcance** (confirmado — "es aparte") |
  | Otros Comprobantes | 1 | Fuera de alcance — `Comprobante` no tiene formato Letra-PtoVta-Número |

- **`Comprobante` es un string compuesto** `"A-00001-00001689"` = Letra-PtoVta-Número. Para `Extracto Bancario` y `Otros Comprobantes` el campo no sigue este formato (ej. `"00000012"`), lo cual los excluye naturalmente del parser de facturas con solo aplicar el regex de la clave — no hace falta un filtro especial aparte de filtrar por `Tipo`.
- **Notas de Crédito confirmadas end-to-end**: la NC `A-00079-00012028` de MERCADOLIBRE S.R.L. en el ERP (Total `-8733.95`) es exactamente la misma que la `3 - Nota de Crédito A` de AFIP (PtoVta 79, Número 12028, Emisor MERCADOLIBRE S.R.L., Imp. Total `8733.95`). **Confirma el signo**: AFIP informa el total de la NC en positivo (es un monto, no un saldo), el ERP la registra en negativo (reduce la cuenta del proveedor). El normalizador tiene que aplicar el signo según el tipo de comprobante, no copiar el signo crudo de ningún lado.
- **Multi-moneda confirmado en ERP también**: aparece `Dólares` además de `Pesos Argentinos` en el año completo.
- **El ERP no tiene columna de CUIT en el libro de facturas** — solo `Proveedor` (nombre). Ver 1.3.

### 1.3 Maestro de proveedores ERP — `Capasitio SAS - Proveedores.xlsx`

- **445 proveedores**, con columnas: `Nombre, Codigo, Condición IVA, Tipo de Identificación, Número de Identificación, Es Cliente, Es Banco, Pais, Provincia, Localidad, Domicilio, Email, ..., Cuenta contable (compras), Es agente de retención, Activo`.
- **100% de los proveedores tienen `Tipo de Identificación = CUIT`** con `Número de Identificación` cargado (0 filas sin identificación).
- **Crucé los 144 nombres de proveedor únicos que aparecen en `Factura copia.xlsx` contra este maestro por nombre exacto: matchean el 100% (144/144)**. Esto es una muy buena noticia: el ERP mantiene su propio maestro consistente, así que no hace falta fuzzy matching para resolver el CUIT de una factura del ERP — alcanza con un `JOIN` exacto por nombre contra este archivo.
- **Conclusión práctica**: este archivo es el que resuelve la Decisión 2 del borrador anterior. En vez de "aprender" la relación proveedor↔CUIT con el tiempo, se **importa este maestro directamente** (carga inicial + resincronización periódica) y se usa como tabla de referencia (`proveedores`) para enriquecer cada factura del ERP con su CUIT real antes de matchear. Con CUIT de los dos lados, la clave de matching pasa a ser **CUIT + Letra + PtoVta + Número**, sin ambigüedad posible (a diferencia de la alternativa anterior de confiar solo en PtoVta+Número+nombre-parecido).

---

## 2. Decisiones — confirmadas

| # | Tema | Resolución |
|---|---|---|
| 1 | Notas de Crédito sin contrapartida | **Sí se cargan en el ERP** (confirmado con datos: 51 NC en `Factura copia.xlsx`, matcheadas contra AFIP). Entran en el alcance del matching como comprobante propio, con signo negativo en el ERP y positivo en AFIP (ver 1.2). El extracto bancario **no se toca**, es un módulo aparte y ya existe. |
| 2 | CUIT del proveedor en el ERP | Se resuelve por **triangulación con el maestro de proveedores** (`Capasitio SAS - Proveedores.xlsx`), que matchea 100% por nombre exacto con las facturas del ERP. Se importa como tabla de referencia `proveedores` (Nombre → CUIT). Clave de matching primaria: `CUIT + Letra + PtoVta + Número`. |
| 3 | Recibos | **Excluidos** del alcance (tanto el `Recibo C` de AFIP como los 8 `Recibo` del ERP). |
| 4 | Alcance de tipos de comprobante | **Excluidos**: Tiques, Recibos, Liquidaciones (lado AFIP) y Recibo, Extracto Bancario, Otros Comprobantes (lado ERP). **En alcance**: Factura (A/B/C/M/E) y Nota de Crédito/Débito, en ambos lados. |
| 5 | Multi-moneda | Comparar siempre en moneda local: `Imp. Total × Tipo Cambio` en AFIP cuando `Moneda ≠ $`; `Total Mon. Principal` directo en ERP (ya viene convertido). |
| 6 | Periodicidad de carga | Igual que el módulo bancario: un período mensual por carga (tabla `periodos`), con índice único de comprobante para detectar y manejar duplicados si se sube un acumulado que se solapa con cargas previas. |
| 7 | Tolerancia de diferencia | $1 o 0.1% del monto (el que sea mayor), configurable. |

---

## 3. Estrategia de matching (actualizada con el maestro de proveedores)

**Paso 0 — Enriquecimiento**: al normalizar cada factura del ERP, resolver su CUIT haciendo `lookup` del campo `Proveedor` contra la tabla `proveedores` (importada del maestro) por nombre exacto. Si no se encuentra (proveedor nuevo, no sincronizado todavía), hacer fallback por nombre normalizado (`normalizarContraparte`, ya existe en `shared/utils.ts`) contra el mismo maestro antes de darlo por no resuelto.

**Paso 1 — Match exacto por comprobante** (`AUTO`, confidence 1.0): `CUIT + Letra + PtoVta + Número` idéntico en ambos lados. Esta es ahora una clave **fuerte y determinística** gracias al maestro de proveedores — no necesita el guardrail probabilístico que se había planteado antes. Si el importe difiere más que la tolerancia (Decisión 7), igual se matchea pero con `difference > 0` (mismo patrón que `MatchResult.difference` ya usado en conciliación bancaria).

**Paso 2 — Match por proveedor + importe + fecha cercana** (`AUTO`, confidence menor, ej. 0.7): para comprobantes que no matchearon por clave exacta (typo de carga del número, o CUIT no resuelto en el paso 0) pero coinciden CUIT (o nombre normalizado si no hay CUIT) + importe total (± tolerancia) + fecha dentro de N días.

**Resultado**: comprobantes sin match en ninguno de los dos pasos quedan `UNMATCHED`, separados en dos bandejas:
- **"En AFIP, falta cargar en ERP"** → lo que el proveedor informó y todavía no está en el sistema contable.
- **"En ERP, no está en AFIP"** → señal de alerta: factura cargada con datos que no coinciden con lo informado por el proveedor (número mal tipeado, proveedor no informó, etc.).

No hace falta una tabla de "aprendizaje" de proveedor↔CUIT como se había considerado antes — el maestro de proveedores ya cumple esa función y es la fuente de verdad. Se deja como posible mejora futura (opcional, no v1) para los pocos casos de proveedores nuevos que aún no estén en el maestro.

---

## 4. Arquitectura técnica

### 4.1 Nuevo módulo de servidor
```
server/src/modules/facturas/
├── afip-parser.ts        # parsea "Mis Comprobantes Recibidos" (detecta fila de headers, Tipo → letra+código)
├── erp-parser.ts         # parsea el libro de facturas del ERP (Tipo → filtra alcance, Comprobante → letra+ptovta+numero, signo por tipo)
├── proveedores-parser.ts # parsea el maestro de proveedores del ERP (Nombre, CUIT, Condición IVA, Activo)
├── service.ts            # equivalente a conciliacion/service.ts pero para facturas
├── routes.ts
└── matching/
    ├── comprobante-exacto.ts   # paso 1
    └── proveedor-importe.ts    # paso 2
```

### 4.2 Tipos nuevos en `shared/types.ts`
- `RawAfipComprobante` (30 columnas crudas).
- `RawERPFactura` (14 columnas crudas).
- `RawProveedorERP` (columnas del maestro: Nombre, TipoIdentificacion, NumeroIdentificacion, CondicionIVA, Activo, etc.).
- `NormalizedComprobante`: análogo a `NormalizedMovement` pero con campos de factura:
  `id, source ('AFIP'|'ERP'), tipoComprobante ('FACTURA'|'NOTA_CREDITO'|'NOTA_DEBITO'), letra, puntoVenta, numero, fecha, cuitEmisor, emisor, emisor_normalizado, moneda, cotizacion, importeTotal, importeTotalLocal (con signo aplicado según tipo), metadata (acá va todo lo demás sin perder nada: desglose de IVA por alícuota, F. Fiscal, Observaciones, Provincia, etc. — no se muestra por default, ver Sección 5)`.
- `MatchType` se reutiliza (`AUTO | MANUAL | UNMATCHED`).

### 4.3 Base de datos (Drizzle, mismo estilo que `db/schema.ts`)
Tablas nuevas, en paralelo a `conciliaciones/movimientos/matches` (no se reutilizan las existentes: los campos de una factura — letra, PtoVta, número, CUIT — no tienen equivalente en el modelo de movimiento bancario):

- `facturas_conciliaciones` (id, periodo_id, nombre, afip_filename, erp_filename, fecha_inicio, fecha_fin, estado, created_at, updated_at).
- `comprobantes` (id, conciliacion_id, source, tipo_comprobante, letra, punto_venta, numero, fecha, cuit_emisor, emisor, emisor_normalizado, moneda, importe_total, importe_total_local, metadata jsonb, match_group_id, match_type) — índice único parcial en `(conciliacion_id, source, letra, punto_venta, numero)` para evitar duplicados de carga.
- `comprobante_matches` (id, conciliacion_id, match_type, confidence, diferencia, group_members jsonb).
- `proveedores` (id, nombre, nombre_normalizado, cuit, condicion_iva, activo, sincronizado_en timestamp) — tabla de referencia importada desde el maestro del ERP (Sección 1.3), con `cuit` indexado. Se resincroniza cuando el usuario sube una versión nueva del maestro; no se recarga en cada conciliación.

### 4.4 Frontend
- Nueva sección "Facturas" en `App.tsx`, junto a la conciliación bancaria existente.
- Flujo de carga en dos partes independientes (no todo junto en un solo formulario):
  1. **"Proveedores"** (una vez, o cuando cambie el maestro): un dropzone para subir `Capasitio SAS - Proveedores.xlsx` y sincronizar la tabla `proveedores`. No se pide en cada conciliación.
  2. **Conciliación del período**: dos dropzones, "Comprobantes AFIP" y "Facturas ERP" (reutilizando el patrón de `UploadPage`), que dispara el `service.ts` de facturas usando la tabla `proveedores` ya sincronizada.
- Resultados con el patrón de `ConciliacionPage`/`ListPage`, con el diseño de la Sección 5 para no repetir el problema de las 30 columnas.

---

## 5. UX — cómo resolver el problema de las 30 columnas

1. **Tabla resumen por default**: `Fecha | Comprobante (Letra-PtoVta-Nro) | Proveedor | Total | Estado (✓ Matched / ⚠ Diferencia / ✗ Sin match) | Fuente`. 6 columnas, cero scroll horizontal.
2. **Detalle expandible por fila** (drawer lateral, no fila in-line): las 30 columnas de AFIP agrupadas por secciones (Datos del comprobante / Emisor / IVA por alícuota / Totales). El desglose de IVA (14 columnas) se muestra como mini-tabla vertical `Alícuota | Importe`, filtrando las vacías (de 14 columnas casi siempre solo 2-3 tienen datos).
3. **Comparación lado a lado** para casos `⚠ Diferencia` / `✗ Sin match`: dos tarjetas compactas (AFIP vs ERP) con los mismos 6 campos, resaltando en rojo el campo que no coincide.
4. **Filtros**: proveedor, estado de match, tipo de comprobante, rango de fecha, "solo con diferencia".
5. **Export de pendientes**: Excel/CSV solo de `UNMATCHED`, con las columnas resumen.
6. Vista aparte "Ver datos originales" para auditoría puntual, con primera columna sticky + `overflow-x-auto` contenido, nunca desborde de página.

---

## 6. Validaciones y edge cases del parser

- Detección dinámica de la fila de headers en AFIP (buscar la fila que contenga `"Fecha"` y `"Punto de Venta"`).
- `Tipo` de AFIP (`"1 - Factura A"`) → regex `^(\d+)\s*-\s*(.+?)\s+([A-Z])$`; mapear código AFIP → categoría con tabla de códigos conocidos (1/6/11/... = Factura, 3/8/13 = NC, 2/7/12 = ND, etc.), no adivinar por el texto libre.
- `Comprobante` del ERP (`"A-00001-00001689"`) → regex `^([A-Z])-(\d+)-(\d+)$`; si no matchea (caso `Extracto Bancario`, `Otros Comprobantes`), la fila queda automáticamente fuera del alcance.
- Filtrar por `Tipo` del ERP antes de intentar parsear la clave: solo `Factura`, `Nota de Crédito`, `Nota de Débito` entran al pipeline de matching (Decisión 4).
- **Signo por tipo de comprobante**: aplicar signo negativo a NC en la normalización (independiente del signo crudo del archivo, ya que AFIP lo informa en positivo y el ERP en negativo — ver hallazgo en 1.2). ND siempre positivo. Factura siempre positivo.
- Fechas: normalizar todo a `YYYY-MM-DD` (mismo patrón que `parseFechaDMYGuion`/`parseFechaISO`).
- Filas vacías / fila de totales al final (mismo patrón que `mayor-parser.ts`).
- Reintentos de carga: índice único `(conciliacion_id, source, letra, punto_venta, numero)` para evitar duplicar comprobantes si se sube un acumulado que se solapa con una carga previa (reemplazar la fila existente, no rechazar, por si el comprobante fue corregido).
- Proveedor no encontrado en el maestro (nuevo, no sincronizado): no debe romper el parseo — se guarda igual con `cuit_emisor = null` y ese comprobante cae directo al Paso 2 de matching (por nombre) en vez del Paso 1.

---

## 7. Roadmap de implementación

1. `afip-parser.ts` + `erp-parser.ts` + `proveedores-parser.ts` + tipos nuevos, con tests contra los archivos reales de `FACTURAS/` como fixtures (`Mis Comprobantes...xlsx`, `Factura copia.xlsx`, `Capasitio SAS - Proveedores.xlsx`).
2. Tabla `proveedores` + endpoint de sincronización del maestro.
3. Estrategias de matching (Paso 1 y 2 de la Sección 3) + motor.
4. Schema DB (`facturas_conciliaciones`, `comprobantes`, `comprobante_matches`) + migración + `service.ts` + `routes.ts`.
5. Frontend: sección "Proveedores" (sync del maestro) + upload de conciliación + tabla resumen + drawer de detalle + comparación lado a lado.
6. Filtros + export de pendientes.

Todas las decisiones de diseño están cerradas — este roadmap ya se puede ejecutar fase por fase. Avisame si querés que arranque por la Fase 1.
