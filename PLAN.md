# Plan de Implementación — Conciliación Bancaria

## 🎯 Objetivo

App web para conciliar extractos bancarios contra el Libro Mayor del ERP permitiendo matcheo automático y manual, con soporte para múltiples bancos.

---

## 📦 Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Frontend** | React 18 + TypeScript + Vite | SPA rápida, tipado seguro |
| **Backend** | Node.js + Express + TypeScript | Robusto, gran ecosistema |
| **DB** | PostgreSQL (local) → Neon Serverless | Migración fácil a serverless |
| **ORM** | Drizzle ORM | Liviano, type-safe, compatible con Neon |
| **Parsing** | csv-parse + xlsx | Ambos formatos de entrada |
| **Matching** | string-similarity-js (Jaro-Winkler) | Fuzzy matching de nombres |
| **Deploy** | Vercel (frontend + serverless functions) | Fase 2 |

---

## 🗂️ Estructura del Proyecto

```
conciliacion/
├── MATCHING_RULES.md          # Reglas de matcheo documentadas
├── PLAN.md                    # Este archivo
├── server/                    # Backend API
│   ├── src/
│   │   ├── index.ts           # Entry point Express
│   │   ├── config.ts          # Configuración
│   │   ├── db/
│   │   │   ├── schema.ts      # Esquema Drizzle (conciliaciones, movimientos, matches)
│   │   │   └── index.ts       # Conexión DB
│   │   ├── shared/
│   │   │   ├── types.ts       # Tipos compartidos
│   │   │   └── utils.ts       # Normalización, parseo, clasificación
│   │   └── modules/
│   │       ├── banks/         # 🧩 MÓDULO: Parsers bancarios
│   │       │   ├── registry.ts          # Banco registry → getBankParser('galicia')
│   │       │   └── galicia/
│   │       │       └── extracto-parser.ts  # Parser específico Galicia
│   │       ├── erp/           # 🧩 MÓDULO: Parser ERP
│   │       │   └── mayor-parser.ts
│   │       ├── matching/      # 🧩 MÓDULO: Motor de matcheo
│   │       │   ├── engine.ts           # Orchestrator
│   │       │   └── strategies/
│   │       │       ├── exact-match.ts   # Match 1:1 por monto+fecha+nombre
│   │       │       ├── tax-association.ts  # Impuestos asociados a créditos
│   │       │       └── grouped-match.ts    # Agrupaciones N:1 sugeridas
│   │       └── conciliacion/
│   │           ├── routes.ts   # API endpoints
│   │           └── service.ts  # Lógica de negocio
├── client/                    # Frontend React
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx            # Router + layout
│   │   ├── api/index.ts       # Cliente HTTP
│   │   ├── types/index.ts     # Tipos frontend
│   │   └── pages/
│   │       ├── UploadPage.tsx   # Subida de archivos (drag & drop)
│   │       ├── ListPage.tsx     # Lista de conciliaciones
│   │       └── ConciliacionPage.tsx  # Vista de conciliación con tabs
│   └── index.html
```

---

## 🔌 Diseño Modular para Múltiples Bancos

### Patrón Strategy para Parsers

```typescript
// Interface común
interface BankParser {
  bankName: string;
  parseCSV(content: string): RawExtractoMovement[];
  normalize(raw: RawExtractoMovement[]): NormalizedMovement[];
}

// Registry
bankParsers.set('galicia', new GaliciaExtractoParser());
bankParsers.set('santander', new SantanderExtractoParser()); // futuro
// ...
```

**Agregar un banco nuevo requiere solo:**
1. Crear carpeta `modules/banks/<nombre>/`
2. Implementar `BankParser`
3. Registrarlo en `registry.ts`

---

## 🔄 Flujo de la Aplicación

```
┌─────────────────────────────────────────────────────┐
│  1. UPLOAD                                          │
│  Usuario sube 2 archivos (extracto + mayor)         │
│  POST /api/conciliaciones/upload                    │
├─────────────────────────────────────────────────────┤
│  2. PARSE & NORMALIZE                               │
│  BankParser.parseCSV() → RawExtractoMovement[]       │
│  BankParser.normalize() → NormalizedMovement[]       │
│  MayorParser.parseCSV() → RawMayorMovement[]         │
│  MayorParser.normalize() → NormalizedMovement[]      │
├─────────────────────────────────────────────────────┤
│  3. CLASSIFY                                        │
│  clasificarMovimiento() → categoría por mov          │
│  (COBRANZA, PAGO, IMPUESTO, COMISION, etc.)         │
├─────────────────────────────────────────────────────┤
│  4. AUTO-MATCHING                                   │
│  ExactMatchStrategy → 1:1 por monto+fecha+nombre    │
│  TaxAssociationStrategy → impuestos → crédito padre │
│  GroupedMatchStrategy → sugerencias N:1             │
├─────────────────────────────────────────────────────┤
│  5. SAVE TO DB                                     │
│  conciliaciones, movimientos, matches, match_movs   │
├─────────────────────────────────────────────────────┤
│  6. REVIEW (UI)                                     │
│  Ver matches automáticos                            │
│  Confirmar/rechazar agrupaciones sugeridas           │
│  Match manual (seleccionar + botón)                 │
│  Deshacer matches                                   │
├─────────────────────────────────────────────────────┤
│  7. REPORT                                          │
│  Summary: matched vs unmatched counts & amounts     │
│  Diferencia de saldos                               │
│  Exportable (futuro)                                │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Fases de Implementación

### Fase 1 — MVP Local (ACTUAL)
- [x] Estructura del proyecto
- [x] DB schema + Drizzle ORM
- [x] Parser Galicia (extracto CSV)
- [x] Parser Libro Mayor (ERP CSV)
- [x] Motor de matcheo (exacto + tax + grouped)
- [x] API REST (upload, list, get, manual match, unmatch)
- [x] Frontend React (upload drag-drop, tabs, manual matching)
- [ ] PostgreSQL local → instalar y probar

### Fase 2 — Producción (PRÓXIMO)
- [ ] Migrar a Neon Serverless Postgres
- [ ] Deploy en Vercel (API serverless + frontend estático)
- [ ] Manejo de autenticación (opcional)
- [ ] Export CSV/PDF de conciliaciones

### Fase 3 — Mejoras
- [ ] Soporte para archivos XLSX directo (sin convertir a CSV)
- [ ] Dashboard con métricas de conciliaciones históricas
- [ ] Notificaciones de conciliaciones pendientes
- [ ] Reglas de matcheo configurables por banco (umbrales, tolerancias)
- [ ] Historial de cambios (audit log)
- [ ] Conciliación de múltiples cuentas bancarias simultáneas

---

## 🗄️ Esquema de Base de Datos

```
conciliaciones
├── id (UUID)
├── nombre
├── extracto_filename
├── mayor_filename
├── estado (PENDIENTE | EN_PROGRESO | COMPLETADA)
└── timestamps

movimientos
├── id (UUID)
├── conciliacion_id → FK conciliaciones
├── source (EXTRACTO | MAYOR)
├── fecha (DATE)
├── descripcion, referencia, contraparte
├── tipo (CREDITO | DEBITO)
├── monto (DECIMAL)
├── categoria (COBRANZA | PAGO | IMPUESTO | ...)
├── metadata (JSONB)
├── match_type (AUTO | MANUAL | GROUPED | TAX_CHILD | UNMATCHED)
└── match_group_id → agrupa movs matcheados

matches
├── id (UUID)
├── conciliacion_id → FK
├── match_type
├── confidence
├── diferencia
└── group_members (JSONB)

match_movimientos (pivote)
├── match_id → FK matches
├── movimiento_id → FK movimientos
└── role (EXTRACTO | MAYOR)
```

---

## 📋 API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/conciliaciones/upload` | Subir extracto + mayor, procesar |
| `GET` | `/api/conciliaciones` | Listar conciliaciones |
| `GET` | `/api/conciliaciones/:id` | Obtener conciliación completa |
| `POST` | `/api/conciliaciones/:id/match` | Match manual |
| `DELETE` | `/api/conciliaciones/:id/match/:matchId` | Deshacer match |

---

## ⚙️ Cómo Ejecutar Localmente

```bash
# 1. PostgreSQL local
createdb conciliacion

# 2. Backend
cd server
cp .env.example .env
npm install
npm run dev          # http://localhost:3001

# 3. Frontend
cd client
npm install
npm run dev          # http://localhost:5173
```

---

## 🧠 Lógica de Matcheo (Resumen)

Ver [MATCHING_RULES.md](./MATCHING_RULES.md) para el detalle completo.

1. **Exacto**: mismo monto + misma dirección + ±1 día + fuzzy name ≥ 75%
2. **Impuestos**: débitos ING. BRUTOS se asocian al crédito del mismo día (~0.06% + ~1.8%)
3. **Agrupado**: suma de 2 movs de un lado = 1 mov del otro, ±2 días, baja confianza → confirmación manual
4. **Manual**: el usuario selecciona cualquier combinación y fuerza el match
5. **Fin de mes**: impuestos/comisiones del banco se agrupan vs asiento sumarizado del ERP (pendiente de implementar)
