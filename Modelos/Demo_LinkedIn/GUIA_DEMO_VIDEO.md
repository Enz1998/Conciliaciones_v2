# Guía de Grabación para Video de LinkedIn — Conciliación Bancaria

Este documento acompaña a los archivos de prueba generados en `Archivos/Demo_LinkedIn/` y `Modelos/Demo_LinkedIn/`.
Los datos son **100% ficticios** (nombres evidentes de fantasía, CUITs de prueba), pero reflejan **la operativa real de una empresa argentina**.

---

## 📁 Archivos Disponibles en el Proyecto

- [Extracto_Bancario_Galicia_DEMO.csv](file:///Users/enzoirribarra/Applications/Proyectos/Conciliaciones_v2/Archivos/Demo_LinkedIn/Extracto_Bancario_Galicia_DEMO.csv): Extracto mensual oficial de Banco Galicia (delimitado por `;`, formato argentino de importes con coma).
- [Libro_Mayor_ERP_DEMO.csv](file:///Users/enzoirribarra/Applications/Proyectos/Conciliaciones_v2/Archivos/Demo_LinkedIn/Libro_Mayor_ERP_DEMO.csv): Exportación del Libro Mayor contable del ERP en formato CSV.
- [Libro_Mayor_ERP_DEMO.xlsx](file:///Users/enzoirribarra/Applications/Proyectos/Conciliaciones_v2/Archivos/Demo_LinkedIn/Libro_Mayor_ERP_DEMO.xlsx): Misma exportación en formato Excel (para mostrar compatibilidad `.xlsx`).

---

## 💰 Saldos Iniciales y Finales (Para la "Prueba de Conciliación")

Al cargar los archivos en la pantalla de **Nueva Conciliación**, podés desplegar el paso 3 ("Saldos iniciales y finales") e ingresar estos valores (o verificar que el sistema los tome automáticamente):

| Concepto | Extracto Bancario | Libro Mayor ERP |
| :--- | :---: | :---: |
| **Saldo Inicial (01/05/2026)** | **$ 25.000.000,00** | **$ 25.000.000,00** |
| **+ Variación Movimientos** | -$ 1.959.500,00 | -$ 2.329.500,00 |
| **Saldo Final Calculado** | **$ 23.040.500,00** | **$ 22.670.500,00** |
| **Saldo Real (en archivo)** | **$ 23.040.500,00** | **$ 22.670.500,00** |

> [!NOTE]
> **Diferencia entre saldos al cierre**: `$ 370.000,00`
> Como el asiento de impuestos y comisiones bancarias ya está registrado en el ERP por `$ 119.500,00`, la diferencia al cierre entre ambos saldos se explica con **exactitud matemática** por las dos partidas en tránsito:
> - `+ $ 220.000,00` (Depósito en Banco de `CLIENTE INVENTADO NORTE S.R.L.` aún no contabilizado en ERP)
> - `+ $ 150.000,00` (Pago con cheque en ERP de `PROVEEDOR VIRTUAL BETA S.A.` aún no debitado en Banco)
> $$\$ 220.000,00 + \$ 150.000,00 = \$ 370.000,00$$
> ¡Cierra al centavo! ✅

---

## 🎬 Guion de Grabación Paso a Paso (60 a 90 segundos)

### ⏱️ 0:00 - 0:15 | Introducción & Carga de Archivos
1. Comenzá en la pantalla **Nueva conciliación bancaria**.
2. Arrastrá `Extracto_Bancario_Galicia_DEMO.csv` al casillero de extracto.
3. Arrastrá `Libro_Mayor_ERP_DEMO.xlsx` (o `.csv`) al casillero de mayor.
4. Desplegá el paso 3 e ingresá o mostrá los saldos iniciales: `$ 25.000.000,00`.
5. Hacé clic en **"Procesar y conciliar"**.

### ⏱️ 0:15 - 0:25 | El "Efecto Wow" del Auto-Match
1. Mostrá cómo el motor procesa al instante y alcanza automáticamente más del **40% conciliado** con 7 grupos matcheados en verde (sueldos, cobranzas y pagos 1 a 1).
2. Mostrá la pestaña **"Conciliados"** un par de segundos.

### ⏱️ 0:25 - 0:50 | Casos de Matcheo Complejos (N a M) en "Pendientes"
Volvé a la pestaña **"Pendientes"** y mostrá cómo resolvés la operativa compleja:

1. **Caso 1 vs 3 (Cobranza agrupada)**:
   - En Banco seleccioná: `DEMO LOGISTICA S.R.L.` (`$ 600.000,00`).
   - En ERP seleccioná las 3 facturas del mismo cliente: Factura A-104 (`$ 250.000`), Factura A-105 (`$ 200.000`) y Factura A-106 (`$ 150.000`).
   - Mostrá la barra flotante: Banco `$ 600.000,00` | ERP `$ 600.000,00` | Diferencia `$ 0,00` (en verde).
   - Clic en **"Conciliar"** ⚡.

2. **Caso 2 vs 1 (Pago desdoblado por límite diario)**:
   - En Banco seleccioná los 2 tramos de `ACME INGENIERIA FICTICIA S.A.`: `$ 400.000,00` y `$ 300.000,00`.
   - En ERP seleccioná la OP total: `OP-000504 Prov Equipos` (`$ 700.000,00`).
   - Barra flotante en `$ 0,00`.
   - Clic en **"Conciliar"** ⚡.

3. **Caso 1 vs 2 (Débito consolidado)**:
   - En Banco seleccioná el débito de `SERVICIOS IMAGINARIOS S.A.` (`$ 350.000,00`).
   - En ERP seleccioná los 2 comprobantes: `$ 200.000,00` y `$ 150.000,00`.
   - Clic en **"Conciliar"** ⚡.

### ⏱️ 0:50 - 1:10 | ¡La Conciliación de Impuestos desde la Pestaña "Impuestos" (8 vs 1)!
1. Hacé clic en la pestaña **"Impuestos"**.
2. Mostrá el panel superior **Resumen para Asiento ERP** (con los subtotales de IVA 21%, SIRCREB, Ley 25413, Mantenimiento, Sellos, Intereses).
3. **El Match 8 vs 1**:
   - En la tabla de la izquierda ("Impuestos y Comisiones"), hacé clic en **"Sel. visibles"** en la esquina superior derecha (o tildá los 8 movimientos de impuestos). Suma: `$ 119.500,00`.
   - En la tabla de la derecha ("Registros ERP"), seleccioná: `Pago N° OP-000508 - Liquidación Impuestos y Comisiones Galicia` (`$ 119.500,00`).
   - La barra flotante inferior muestra:
     - **Banco**: `$ 119.500,00`
     - **ERP**: `$ 119.500,00`
     - **Diferencia**: `$ 0,00` (verde)
     - **9 seleccionados**
   - Hacé clic en **"Conciliar"** ⚡.
4. La pestaña "Impuestos" queda limpia en **"Todo conciliado"** con tilde verde.

### ⏱️ 1:10 - 1:25 | Pestaña "Resumen" & Prueba de Conciliación
1. Entrá en la pestaña **"Resumen"**.
2. Mostrá la **Prueba de Conciliación**:
   - Banco: Saldo Inicial `$ 25.000.000,00` + Movimientos = Saldo Calculado `$ 23.040.500,00` (Igual al Real).
   - ERP: Saldo Inicial `$ 25.000.000,00` + Movimientos = Saldo Calculado `$ 22.670.500,00` (Igual al Real).
3. Explicá que la diferencia de `$ 370.000,00` corresponde únicamente a las 2 partidas en tránsito identificadas (`CLIENTE INVENTADO NORTE S.R.L.` por `$ 220.000` y `PROVEEDOR VIRTUAL BETA S.A.` por `$ 150.000`).

---

## 📝 Propuesta de Copy para el Post de LinkedIn

```text
🚀 De horas en Excel a segundos: construí mi propio sistema de Conciliación Bancaria inteligente 💡

Cualquiera que haya trabajado en Finanzas o Contabilidad sabe lo desgastante que es cerrar el mes:
❌ Extractos bancarios con cientos de líneas crípticas.
❌ Cobranzas que entran en una sola transferencia pero cancelan 3 facturas distintas en el ERP.
❌ Pagos a proveedores desdoblados en 2 tramos por límites operativos de home banking.
❌ Desglosar a mano SIRCREB, Ley 25413, IVA y percepciones bancarias para el asiento contable.

Para resolver este problema de raíz, desarrollé este SaaS de Conciliación Bancaria. En este video de 1 minuto muestro el flujo completo con datos simulados:

✨ Capacidades clave de la plataforma:
1️⃣ Ingesta flexible: compatible con extractos bancarios oficiales (Banco Galicia, Macro, Mercado Pago) y libros mayores de cualquier ERP (formatos CSV y XLSX).
2️⃣ Pipeline de matching inteligente: algoritmos que detectan operaciones 1 a 1 por fecha, importe y normalización de contrapartes en milisegundos.
3️⃣ Conciliación asistida N a M: interfaz reactiva para matchear 1 vs 3, 2 vs 1 o grupos complejos con validación flotante de diferencias en centavos en tiempo real.
4️⃣ Módulo fiscal integrado: panel que agrupa y desglosa impuestos (SIRCREB, Ley 25413, IVA, sellos) y permite conciliar todos los débitos del banco contra el asiento resumen del ERP en 1 clic.
5️⃣ Prueba de conciliación matemática: control estricto de saldos iniciales, movimientos del período y detección precisa de partidas en tránsito al cierre.

🛠️ Stack tecnológico:
• Frontend: React + TypeScript + Tailwind CSS
• Backend: Node.js + Express + Drizzle ORM + PostgreSQL
• Motor: Pipelines de matching modulares y aritmética de alta precisión con Decimal.js.

Me encantaría conocer la opinión de la comunidad tech, contadores y directores de finanzas. ¿Qué otra funcionalidad sumarían?

#FinTech #SoftwareDevelopment #FullStack #React #NodeJS #TypeScript #Contabilidad #Finanzas
```
