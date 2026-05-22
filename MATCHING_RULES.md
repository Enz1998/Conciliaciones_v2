# Reglas de Matcheo — Conciliación Bancaria

## 1. Modelo de Datos Normalizado

Ambos archivos (extracto bancario y libro mayor) se normalizan a una estructura común:

| Campo | Descripción |
|-------|-------------|
| `id` | UUID único |
| `source` | `EXTRACTO` o `MAYOR` |
| `fecha` | Date (sin hora) |
| `descripcion` | Texto descriptivo del movimiento |
| `referencia` | Nro de documento/comprobante |
| `contraparte` | Nombre de la organización/persona |
| `tipo` | `CREDITO` o `DEBITO` |
| `monto` | Decimal absoluto (positivo) |
| `categoria` | Clasificación: `COBRANZA`, `PAGO`, `IMPUESTO`, `COMISION`, `INTERES`, `MOV_FONDOS`, `SUELDOS`, `OTRO` |
| `metadata` | JSON con datos originales (banco, sucursal, terminal, etc.) |
| `match_group_id` | UUID del grupo de matcheo (si está matcheado) |
| `match_type` | `AUTO`, `MANUAL`, `GROUPED`, `TAX_CHILD`, `UNMATCHED` |

---

## 2. Estrategias de Matcheo Automático

### 2.1 Match Exacto (One-to-One)

**Condiciones:**
1. `monto` **idéntico** entre extracto y mayor
2. `tipo` **coincidente** (CREDITO con CREDITO, DEBITO con DEBITO)
3. `fecha` con tolerancia de **±1 día hábil**
4. `contraparte` con **fuzzy match ≥ 80%** (Levenshtein o Jaro-Winkler)

**Aplica a:**
- Cobranzas: `Cobranza Auto` (ERP) ↔ `TRANSFERENCIA DE TERCEROS` / `CREDITO TRANSFERENCIA COELSA` / `TRANSFERENCIAS CASH PROVEEDORES` / `SERVICIO PAGO A PROVEEDORES` (Banco)
- Pagos: `Pago N°` (ERP) ↔ `TRF INMED PROVEED` (Banco)

**Ejemplo:**
```
ERP:  CASA ALARCIA S A C I F I A G — 353164.71 — 04/05/2026
BANCO: CREDITO TRANSFERENCIA COELSA — CASA ALARCIA S A C I F I A G — 353164.71 — 04/05/2026
→ MATCH EXACTO ✅
```

### 2.2 Agrupación Manual/Asistida (Many-to-One / One-to-Many)

**Condiciones:**
1. La **suma** de los montos de N movimientos de una fuente = monto de 1 movimiento de la otra fuente
2. Las fechas están dentro de un **rango de ±2 días**
3. El usuario **confirma** la agrupación (o se sugiere automáticamente)

**Escenarios típicos:**
- Dos cobranzas del mismo cliente el mismo día que en ERP se registraron como una sola
- Un pago del banco que en ERP se desglosó en varios asientos

### 2.3 Asociación de Impuestos (Tax Child)

**Patrón detectado:** Cada crédito en el banco tiene 2 débitos de Ingresos Brutos:
- `ING. BRUTOS S/ CRED` — DT.301/03-TUCUMAN → ≈ 0.06% del crédito
- `ING. BRUTOS S/ CRED` — REG.RECAU.SIRCREB → ≈ 1.8% del crédito

**Condiciones:**
1. Movimiento de categoría `IMPUESTO` en el banco
2. Pertenece al mismo día que un crédito
3. El monto del impuesto está entre **0.05% y 2.5%** del crédito
4. Se asocia como `TAX_CHILD` del crédito padre (no afecta el match principal)

### 2.4 Cargos de Fin de Mes

**En el banco:** Múltiples débitos individuales:
- `COMISION SERVICIO DE CUENTA`, `IVA`, `PERCEP. IVA`
- `IMP. ING. BRUTOS`, `IMPUESTO DE SELLOS`
- `INTERESES SOBRE SALDOS DEUDORES`
- `IMP. DEB. LEY 25413 GRAL.`, `IMP. CRE. LEY 25413`

**En el ERP:** Un solo asiento sumarizado con el total.

**Condiciones:**
1. Agrupar TODOS los débitos bancarios de categoría `COMISION`/`IMPUESTO`/`INTERES` que:
   - Tengan `Grupo de Conceptos` = `000808 - Comisiones` o `000901 - Impuestos` o `000814 - Intereses`
   - Correspondan al mismo mes de facturación (ej: "Abril 2026" en el campo `Observaciones Cliente`)
2. La **suma** del grupo debe coincidir con un asiento del ERP de categoría `OTRO` con descripción que mencione "comisiones", "impuestos" o "gastos bancarios"
3. Si no hay match exacto en suma, se marcan como `UNMATCHED` para revisión manual

---

## 3. Flujo de Conciliación

```
1. IMPORTAR
   ├── Cargar Extracto Bancario (CSV) → parsear → normalizar → guardar en DB
   └── Cargar Libro Mayor (CSV/XLSX) → parsear → normalizar → guardar en DB

2. CLASIFICAR
   └── Asignar categoría a cada movimiento según reglas

3. MATCHEO AUTOMÁTICO
   ├── Match exacto (monto + fecha + contraparte)
   ├── Asociar impuestos por transacción (TAX_CHILD)
   └── Sugerir agrupaciones (many-to-one)

4. REVISIÓN MANUAL
   ├── Confirmar/rechazar matches sugeridos
   ├── Matchear items UNMATCHED manualmente (drag & drop)
   ├── Crear grupos manuales
   └── Marcar items como "no conciliable" (ej: movimientos entre cuentas propias)

5. REPORTE
   ├── Items matcheados (con detalle de match_type)
   ├── Pendiente en ERP (está en banco, no en ERP)
   ├── Pendiente en Banco (está en ERP, no en banco)
   └── Diferencia de saldos (conciliado vs extracto vs mayor)
```

---

## 4. Reglas de Clasificación (`categoria`)

| Condición | Categoría |
|-----------|-----------|
| Descripción contiene `TRANSFERENCIA DE TERCEROS`, `CREDITO TRANSFERENCIA`, `CASH PROVEEDORES`, `SERVICIO PAGO A PROVEEDORES`, `SNP PAGO`, `Cobranza Auto` | `COBRANZA` |
| Descripción contiene `TRF INMED PROVEED`, `Pago N°` | `PAGO` |
| Descripción contiene `ING. BRUTOS`, `IMP. DEB.`, `IMP. CRE.`, `IVA`, `PERCEP. IVA`, `SELLOS` | `IMPUESTO` |
| Descripción contiene `COMISION` | `COMISION` |
| Descripción contiene `INTERES` | `INTERES` |
| Descripción contiene `Movimiento de Fondos`, `TRANSF.FONDOS ENTRE BANCOS` | `MOV_FONDOS` |
| Descripción contiene `Salida de Fondos`, `SUELDO`, `HABERES`, `Asiento Manual` | `SUELDOS` |
| Descripción contiene `DEB. AUTOM. DE SERV.` | `PAGO` |
| Ninguna de las anteriores | `OTRO` |

---

## 5. Normalización de Nombres (Contraparte)

Para mejorar el fuzzy matching, los nombres se normalizan antes de comparar:

1. Pasar a **UPPERCASE**
2. Eliminar:
   - Tipo societario al final: `S.A.`, `S.R.L.`, `S.A.S.`, `S.C.`, `S. A.`, `S. R. L.`, `S. A. S.`
   - Puntuación sobrante: `.`, `,`, `;`, `-`
   - Palabras vacías: `DE`, `DEL`, `LA`, `EL`, `LOS`, `LAS`, `Y`, `E`
3. Trim y colapsar espacios múltiples
4. Para el fuzzy match usar **Jaro-Winkler** (umbral: 0.85) o **Dice coefficient** (umbral: 0.80)

**Ejemplo:**
```
Original:    "CASA ALARCIA S A C I F I A G"
Normalizado: "CASA ALARCIA SACIFIG"
Original:    "PETROZAPALA S A C E I"
Normalizado: "PETROZAPALA SACEI"
```

---

## 6. Manejo de Diferencias

| Diferencia | Acción |
|------------|--------|
| ≤ 0.01 (1 centavo) | Match automático, marcar con flag `rounding_diff` |
| > 0.01 y ≤ 1.00 | Sugerir match, requiere confirmación manual |
| > 1.00 | No matchear automáticamente |
