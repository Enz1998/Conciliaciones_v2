# Plan de Remediación y Ejecución por Fases
**Proyecto:** Conciliaciones_v2
**Objetivo:** Mitigar vulnerabilidades críticas y reestructurar deuda técnica según hallazgos de auditoría ("auditoria_critica.md").

---

## - [x] 🛑 Fase 1: Hotfixes y Seguridad Crítica
**Objetivo:** Cerrar inmediatamente brechas que comprometen la integridad de los datos, la seguridad del sistema y previenen denegaciones de servicio inminentes.

- [x] **1. Middleware de Autenticación (1)**: Proteger `/api/conciliaciones` (`server/src/modules/conciliacion/routes.ts`).
- [x] **2. Envolver operaciones en Transacciones ACID (2)**: Refactorizar `service.ts` para usar `db.transaction()` (`server/src/modules/conciliacion/service.ts`).
- [x] **3. Manejador Global de Errores (Ocultar logs) (3)**: Evitar fugar `error.message` al cliente (`server/src/index.ts`, `server/src/modules/conciliacion/routes.ts`).
- [x] **4. Limitar tamaño en Multer (Prevención OOM) (4)**: Limitar a 10MB la subida en RAM (`server/src/modules/conciliacion/routes.ts`).

---

## - [ ] 🏗️ Fase 2: Refactorización y Arquitectura
**Objetivo:** Mejorar la escalabilidad, resolver cuellos de botella algorítmicos y asegurar la robustez de los datos.

- [x] **1. Refactor API a asíncrona (Colas/Polling) (6)** (`routes.ts`, `service.ts`, Frontend)
- [x] **2. Migrar bucle DB a Batch Updates masivos (5)** (`server/src/modules/conciliacion/service.ts`)
- [x] **3. Implementar Zod para validación de Payload (9)** (`server/src/modules/conciliacion/routes.ts`)
- [x] **4. Optimizar algoritmo O(N*M) a O(N) con Set (8)** (`server/src/modules/conciliacion/service.ts`)
- [x] **5. Integrar librería de Precisión Decimal (11)** (`server/src/modules/conciliacion/service.ts`)

---

## - [ ] 🧹 Fase 3: Funcionalidades Faltantes y Limpieza
**Objetivo:** Pagar deuda técnica de bajo impacto y realizar hardening de la configuración.

- [x] **1. Restringir políticas CORS (7)** (`server/src/index.ts`)
- [x] **2. Eliminar Fallbacks e Inseguridad en `.env` (10)** (`server/src/config.ts`)
- [x] **3. Migrar lectura `toString` a flujos Stream (4)** (`server/src/modules/conciliacion/service.ts`)

---

## - [ ] 🚀 Fase 4: Pruebas y Despliegue
**Objetivo:** Validar que los cambios no introdujeron regresiones y establecer un proceso seguro para pasar a producción.

- [ ] **1. Pruebas de Estrés (Load Testing)**
- [ ] **2. Prueba de Invariantes ACID**
- [ ] **3. Validación End-to-End de Autenticación**
- [ ] **4. Plan de Pase a Producción (Migración, Shadow Mode)**
