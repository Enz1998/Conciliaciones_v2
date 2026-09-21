# Auditoría Crítica y de Seguridad
**Proyecto:** Conciliaciones_v2
**Fecha de evaluación:** 27 de Mayo, 2026

Como Auditor de Software Senior, he sometido el código base a un escrutinio hipercrítico. La premisa de esta revisión es no confiar en nada. El resultado es alarmante: el código tiene serios problemas estructurales, vulnerabilidades críticas de seguridad que comprometen directamente datos financieros sensibles y cuellos de botella que impedirán su funcionamiento bajo carga real. 

A continuación, la cruda realidad del estado del proyecto clasificada por nivel de riesgo.

---

## 🚨 RIESGO CRÍTICO (Solucionar Inmediatamente)

### 1. Ausencia Total de Autenticación y Autorización (Vulnerabilidad)
**Archivo:** `server/src/modules/conciliacion/routes.ts`

El sistema completo expone endpoints destructivos (POST, PUT, DELETE) sobre datos financieros al público. No hay middleware que verifique identidades, roles, ni pertenencia de los datos.

```typescript
// /server/src/modules/conciliacion/routes.ts (Línea 123)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await conciliacionService.delete(req.params.id);
    res.json({ success: true });
  } // ...
```
**Impacto:** Un atacante, o incluso un usuario malicioso o confundido, puede borrar, modificar o extraer libros mayores y extractos bancarios de cualquier otra persona simplemente iterando o conociendo un UUID.
**Solución:** Implementar JWT o manejo de sesiones con middleware (ej. `verifyAuth`) en todas las rutas de `/api/conciliaciones`.

### 2. Base de Datos Corruptible: Falta de Transacciones ACID (Arquitectura/Bugs)
**Archivo:** `server/src/modules/conciliacion/service.ts`

Las operaciones centrales (`procesar`, `rematch`, `createManualMatch`, `unmatch`) ejecutan múltiples sentencias `insert`, `update` y `delete` de manera secuencial sin estar envueltas en una transacción de base de datos.

```typescript
// /server/src/modules/conciliacion/service.ts (Línea 298 - unmatch)
    await db.delete(schema.matchMovimientos)
      .where(eq(schema.matchMovimientos.match_id, matchId));
    // SI EL SERVIDOR CRASHEA AQUÍ O LA BD DA ERROR DE CONEXIÓN...
    await db.delete(schema.matches)
      .where(eq(schema.matches.id, matchId));
```
**Impacto:** Si una operación falla a la mitad (por error de red, timeout, o fallo de nodo), los datos quedarán en estado inconsistente (ej. movimientos marcados como "UNMATCHED" pero el "match" en la tabla `matches` no se elimina). Es inaceptable en software financiero.
**Solución:** Usar el sistema de transacciones de Drizzle ORM: `await db.transaction(async (tx) => { ... })`.

### 3. Fuga de Información Sensible (Information Disclosure)
**Archivo:** `server/src/modules/conciliacion/routes.ts`

Absolutamente todos los bloques `catch` de la API exponen el `error.message` interno hacia el cliente.

```typescript
// Múltiples ocurrencias a lo largo de routes.ts
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
```
**Impacto:** Un error en la base de datos expondrá detalles del esquema, versiones de Drizzle/PG, consultas SQL fallidas o fallos de conexión, facilitando ataques dirigidos (SQLi o explotación de infraestructura).
**Solución:** Crear un middleware global de manejo de errores. En producción, ocultar el `error.message` bajo un simple `"Error interno del servidor"` y loguear el error real en la consola/logger del backend.

---

## 🔴 RIESGO ALTO

### 4. Denegación de Servicio (DoS) por Exhaustación de Memoria
**Archivo:** `server/src/modules/conciliacion/routes.ts` y `service.ts`

La subida de archivos utiliza `multer.memoryStorage()` sin límites. Esto carga todo el Excel/CSV directamente en la RAM de Node.js. Peor aún, en el servicio se procesa pasando a strings todo el buffer de golpe.

```typescript
// routes.ts
const upload = multer({ storage: multer.memoryStorage() }); // <- SIN LÍMITES

// service.ts (Línea 39)
let content = extractoBuffer.toString('utf-8');
```
**Impacto:** Un archivo de 500MB+ hará que la aplicación sufra un "Out Of Memory" (OOM) y crashee por completo el contenedor/proceso de Node, botando el servicio para todos los usuarios.
**Solución:** 
1. Limitar el tamaño en Multer: `multer({ limits: { fileSize: 10 * 1024 * 1024 } })`.
2. Usar parsers basados en flujos (Streams) para CSV (`csv-parser` o streams de Node) y evitar `.toString()` completo de buffers grandes.

### 5. Saturación de Pool de Conexiones a Base de Datos (Cuello de Botella)
**Archivo:** `server/src/modules/conciliacion/service.ts`

En la función `rematch`, se ejecutan bucles masivos de `Promise.all` para actualizar registros:

```typescript
// service.ts (Línea 409)
for (let i = 0; i < movsToUpdate.length; i += 200) {
    const chunk = movsToUpdate.slice(i, i + 200);
    await Promise.all(
    chunk.map((m) =>
        db.update(schema.movimientos) ...
    )
    );
}
```
**Impacto:** Ejecutar 200 sentencias SQL concurrentes agotará el límite de conexiones del pool de Postgres (generalmente 10-20 por defecto) provocando `timeout` y enlenteciendo el servidor dramáticamente (DDoS auto-infligido).
**Solución:** Utilizar Batch Updates soportados nativamente por Postgres (ej. `UPDATE ... FROM (VALUES ...)`) o, en el peor caso, ejecutar el map de forma síncrona/batch con un `Promise.all` mucho menor (10-20), o iterativamente.

### 6. Ejecución Síncrona Bloqueante en API (Arquitectura)
**Archivo:** `server/src/modules/conciliacion/routes.ts`

El endpoint `/upload` espera que `conciliacionService.procesar(...)` termine antes de responder.
**Impacto:** Conciliar miles de filas toma tiempo computacional y la conexión HTTP se mantendrá abierta, provocando timeouts del browser o del Load Balancer (504 Gateway Timeout).
**Solución:** Implementar un esquema asíncrono (colas con Redis/BullMQ o Webhooks). Retornar un ID de trabajo inmediato y que el frontend consulte el estado vía polling o websockets.

---

## 🟡 RIESGO MEDIO

### 7. Riesgo de Intercepción y CSRF (CORS mal configurado)
**Archivo:** `server/src/index.ts`

Se utiliza `app.use(cors())` sin opciones. Esto abre la API a peticiones cruzadas desde CUALQUIER dominio (`Access-Control-Allow-Origin: *`).
**Impacto:** Sitios web maliciosos pueden enviar peticiones al backend si los usuarios inician sesión y tienen tokens guardados en localStorage/cookies.
**Solución:** Restringir el CORS a la URL exacta del frontend en producción.

### 8. Algoritmo Ineficiente O(N*M) en Matches Manuales
**Archivo:** `server/src/modules/conciliacion/service.ts`

En `createManualMatch`, para calcular la diferencia se hace:
```typescript
const extSum = extMovs
    .filter((m) => extractoIds.includes(m.id))
    .reduce(...);
```
**Impacto:** Si `extMovs` tiene 100,000 registros y `extractoIds` tiene 10, `.includes()` se llama 1 millón de veces. Esto es extremadamente ineficiente.
**Solución:** Convertir `extractoIds` en un `Set` (`const extSet = new Set(extractoIds)`) para buscar en `O(1)`, resultando en una complejidad `O(N)`.

### 9. Ausencia Absoluta de Validación de Payload (Seguridad de Entrada)
**Archivo:** `server/src/modules/conciliacion/routes.ts`

A pesar de que el paquete `zod` está instalado (`package.json`), ninguna ruta de la API lo utiliza para validar los bodys. Se asumen propiedades a ciegas (`req.body.extractoIds`).
**Impacto:** Si un payload malformado se envía (ej. un string en vez de array), los métodos `.length` fallarán generando Excepciones no controladas.
**Solución:** Crear schemas de Zod y middleware de validación rigurosa para `req.body` y `req.params`.

---

## 🔵 RIESGO BAJO / BASURA TÉCNICA

### 10. Credenciales Hardcodeadas y Archivos .env Inseguros
**Archivo:** `server/src/config.ts`

Se expone la cadena de conexión de fallback: `postgres://postgres:postgres@localhost:5432/conciliacion`.
**Impacto:** Mala práctica que facilita a atacantes conocer la estructura de usuarios locales por defecto.
**Solución:** Arrojar un error si `process.env.DATABASE_URL` no existe y detener la inicialización de la app, forzando configuraciones seguras.

### 11. Pérdida de Precisión Financiera
**Archivo:** `server/src/modules/conciliacion/service.ts` (Línea 182)

Los montos vienen de la BD como strings (tipo `decimal`), pero se hace el cast directo en JS: `monto: Number(m.monto)`. JavaScript utiliza IEEE 754 de punto flotante.
**Impacto:** Para sumas complejas o valores muy altos, habrá pérdida de centavos e inexactitudes. Inadmisible para reconciliaciones contables.
**Solución:** Usar una librería especializada en precisión decimal (como `decimal.js` o `bignumber.js`) para todas las sumas/restas y conversiones.
