import { pgTable, uuid, varchar, decimal, date, timestamp, jsonb, index, uniqueIndex, integer, boolean } from 'drizzle-orm/pg-core';

// Tabla de periodos contables (meses)
export const periodos = pgTable('periodos', {
  id: uuid('id').defaultRandom().primaryKey(),
  banco: varchar('banco', { length: 50 }).notNull(),
  mes: integer('mes').notNull(),
  anio: integer('anio').notNull(),
  estado: varchar('estado', { length: 20 }).notNull().default('ABIERTO'), // ABIERTO | CERRADO
  saldo_inicial_extracto: decimal('saldo_inicial_extracto', { precision: 18, scale: 2 }),
  saldo_inicial_mayor: decimal('saldo_inicial_mayor', { precision: 18, scale: 2 }),
  saldo_final_extracto: decimal('saldo_final_extracto', { precision: 18, scale: 2 }),
  saldo_final_mayor: decimal('saldo_final_mayor', { precision: 18, scale: 2 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Tabla de conciliaciones (una por cada par extracto+mayor procesado)
export const conciliaciones = pgTable('conciliaciones', {
  id: uuid('id').defaultRandom().primaryKey(),
  periodo_id: uuid('periodo_id').references(() => periodos.id),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  banco: varchar('banco', { length: 50 }).notNull().default('galicia'),
  extracto_filename: varchar('extracto_filename', { length: 255 }),
  mayor_filename: varchar('mayor_filename', { length: 255 }),
  extracto_original: jsonb('extracto_original'),
  mayor_original: jsonb('mayor_original'),
  fecha_inicio: date('fecha_inicio'),
  fecha_fin: date('fecha_fin'),
  estado: varchar('estado', { length: 20 }).notNull().default('PENDIENTE'),
  saldo_inicial_extracto: decimal('saldo_inicial_extracto', { precision: 18, scale: 2 }),
  saldo_final_extracto: decimal('saldo_final_extracto', { precision: 18, scale: 2 }),
  saldo_inicial_mayor: decimal('saldo_inicial_mayor', { precision: 18, scale: 2 }),
  saldo_final_mayor: decimal('saldo_final_mayor', { precision: 18, scale: 2 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Tabla de movimientos normalizados
export const movimientos = pgTable('movimientos', {
  id: uuid('id').defaultRandom().primaryKey(),
  conciliacion_id: uuid('conciliacion_id').references(() => conciliaciones.id, { onDelete: 'cascade' }).notNull(),
  source: varchar('source', { length: 10 }).notNull(), // EXTRACTO | MAYOR
  fecha: date('fecha').notNull(),
  descripcion: varchar('descripcion', { length: 500 }).notNull(),
  referencia: varchar('referencia', { length: 255 }).default(''),
  contraparte: varchar('contraparte', { length: 500 }).default(''),
  contraparte_normalizada: varchar('contraparte_normalizada', { length: 500 }).default(''),
  tipo: varchar('tipo', { length: 10 }).notNull(), // CREDITO | DEBITO
  monto: decimal('monto', { precision: 18, scale: 2 }).notNull(),
  categoria: varchar('categoria', { length: 20 }).notNull().default('OTRO'),
  metadata: jsonb('metadata').default({}),
  match_group_id: uuid('match_group_id'),
  match_type: varchar('match_type', { length: 20 }).notNull().default('UNMATCHED'),
}, (table) => ({
  conciliacionIdx: index('idx_mov_conciliacion').on(table.conciliacion_id),
  matchGroupIdx: index('idx_mov_match_group').on(table.match_group_id),
  tipoFechaIdx: index('idx_mov_tipo_fecha').on(table.tipo, table.fecha),
  montoIdx: index('idx_mov_monto').on(table.monto),
}));

// Tabla de matches
export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  conciliacion_id: uuid('conciliacion_id').references(() => conciliaciones.id, { onDelete: 'cascade' }).notNull(),
  match_type: varchar('match_type', { length: 20 }).notNull(), // AUTO | MANUAL | GROUPED | TAX_CHILD
  confidence: decimal('confidence', { precision: 3, scale: 2 }).notNull().default('1.00'),
  diferencia: decimal('diferencia', { precision: 18, scale: 2 }).notNull().default('0'),
  group_members: jsonb('group_members').default([]), // IDs de movimientos agrupados
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  conciliacionIdx: index('idx_match_conciliacion').on(table.conciliacion_id),
}));

// Tabla pivote: match <-> movimientos
export const matchMovimientos = pgTable('match_movimientos', {
  id: uuid('id').defaultRandom().primaryKey(),
  match_id: uuid('match_id').references(() => matches.id, { onDelete: 'cascade' }).notNull(),
  movimiento_id: uuid('movimiento_id').references(() => movimientos.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 10 }).notNull(), // EXTRACTO | MAYOR
}, (table) => ({
  matchIdx: index('idx_mm_match').on(table.match_id),
  movIdx: index('idx_mm_mov').on(table.movimiento_id),
}));

// ══════════════════════════════════════════════════════════════════
// Módulo de Conciliación de Facturas (AFIP vs ERP)
// ══════════════════════════════════════════════════════════════════

// Maestro de proveedores del ERP (Nombre → CUIT). Se resincroniza aparte,
// no se sube en cada conciliación (ver plan_modulo_facturas.md, Sección 4.4).
export const proveedores = pgTable('proveedores', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: varchar('nombre', { length: 500 }).notNull(),
  nombre_normalizado: varchar('nombre_normalizado', { length: 500 }).notNull(),
  cuit: varchar('cuit', { length: 20 }).notNull(),
  condicion_iva: varchar('condicion_iva', { length: 50 }).default(''),
  activo: boolean('activo').notNull().default(true),
  sincronizado_en: timestamp('sincronizado_en').defaultNow().notNull(),
}, (table) => ({
  // El CUIT NO es único: el ERP agrupa proveedores del exterior sin CUIT
  // argentino bajo un mismo CUIT genérico (ej. 55000002126 para SaaS
  // extranjeros como AWS, GitHub, Anthropic). El nombre sí es único por fila.
  nombreIdx: uniqueIndex('idx_prov_nombre').on(table.nombre),
  cuitIdx: index('idx_prov_cuit').on(table.cuit),
  nombreNormIdx: index('idx_prov_nombre_norm').on(table.nombre_normalizado),
}));

// Concepto que el usuario le asigna a un proveedor (ej. "Hosting", "Alquiler
// oficina", "Honorarios contables") para no tener que ir a revisar el ERP
// cada vez que aparece una factura de ese proveedor. Es independiente del
// maestro de `proveedores` (que se reemplaza en cada sincronización) para
// que nunca se pierda al resincronizar — se identifica por nombre
// normalizado, así aplica tanto a comprobantes de AFIP como del ERP.
export const proveedorConceptos = pgTable('proveedor_conceptos', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre_normalizado: varchar('nombre_normalizado', { length: 500 }).notNull(),
  concepto: varchar('concepto', { length: 255 }).notNull().default(''),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nombreNormIdx: uniqueIndex('idx_concepto_nombre_norm').on(table.nombre_normalizado),
}));

// Tabla de conciliaciones de facturas (una por cada par AFIP+ERP procesado).
// Reutiliza la tabla `periodos` existente con banco = 'facturas'.
export const facturasConciliaciones = pgTable('facturas_conciliaciones', {
  id: uuid('id').defaultRandom().primaryKey(),
  periodo_id: uuid('periodo_id').references(() => periodos.id),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  afip_filename: varchar('afip_filename', { length: 255 }),
  erp_filename: varchar('erp_filename', { length: 255 }),
  fecha_inicio: date('fecha_inicio'),
  fecha_fin: date('fecha_fin'),
  estado: varchar('estado', { length: 20 }).notNull().default('PENDIENTE'),
  omitidos_afip: integer('omitidos_afip').notNull().default(0),
  omitidos_erp: integer('omitidos_erp').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Comprobantes normalizados (AFIP y ERP en la misma tabla, distinguidos por `source`).
export const comprobantes = pgTable('comprobantes', {
  id: uuid('id').defaultRandom().primaryKey(),
  conciliacion_id: uuid('conciliacion_id').references(() => facturasConciliaciones.id, { onDelete: 'cascade' }).notNull(),
  source: varchar('source', { length: 10 }).notNull(), // AFIP | ERP
  tipo_comprobante: varchar('tipo_comprobante', { length: 20 }).notNull(), // FACTURA | NOTA_CREDITO | NOTA_DEBITO
  letra: varchar('letra', { length: 2 }).notNull(),
  punto_venta: integer('punto_venta').notNull(),
  numero: integer('numero').notNull(),
  fecha: date('fecha').notNull(),
  cuit_emisor: varchar('cuit_emisor', { length: 20 }),
  emisor: varchar('emisor', { length: 500 }).default(''),
  emisor_normalizado: varchar('emisor_normalizado', { length: 500 }).default(''),
  moneda: varchar('moneda', { length: 20 }).default(''),
  cotizacion: decimal('cotizacion', { precision: 10, scale: 4 }).notNull().default('1'),
  importe_total: decimal('importe_total', { precision: 18, scale: 2 }).notNull(),
  importe_total_local: decimal('importe_total_local', { precision: 18, scale: 2 }).notNull(),
  metadata: jsonb('metadata').default({}),
  match_group_id: uuid('match_group_id'),
  match_type: varchar('match_type', { length: 20 }).notNull().default('UNMATCHED'),
}, (table) => ({
  conciliacionIdx: index('idx_comp_conciliacion').on(table.conciliacion_id),
  matchGroupIdx: index('idx_comp_match_group').on(table.match_group_id),
  // El PtoVta lo numera cada emisor de forma independiente: dos proveedores
  // distintos pueden compartir "Factura C, PtoVta 1, Número 134" sin ser el
  // mismo comprobante. La clave real de un comprobante es CUIT emisor + tipo
  // + letra + PtoVta + número (confirmado con datos reales — ver
  // plan_modulo_facturas.md, Sección 1.1).
  claveIdx: uniqueIndex('idx_comp_clave').on(table.conciliacion_id, table.source, table.cuit_emisor, table.tipo_comprobante, table.letra, table.punto_venta, table.numero),
}));

// Matches de facturas. Los AUTO (paso 1/2 del motor) son siempre 1 AFIP : 1 ERP
// y usan afip_comprobante_id/erp_comprobante_id. Los MANUAL pueden agrupar
// varios comprobantes de cada lado (selección múltiple en la UI) — en ese
// caso group_members tiene todos los IDs y las columnas simples solo se
// completan cuando hay exactamente uno de cada lado.
export const comprobanteMatches = pgTable('comprobante_matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  conciliacion_id: uuid('conciliacion_id').references(() => facturasConciliaciones.id, { onDelete: 'cascade' }).notNull(),
  afip_comprobante_id: uuid('afip_comprobante_id').references(() => comprobantes.id, { onDelete: 'cascade' }),
  erp_comprobante_id: uuid('erp_comprobante_id').references(() => comprobantes.id, { onDelete: 'cascade' }),
  match_type: varchar('match_type', { length: 20 }).notNull(), // AUTO | MANUAL
  confidence: decimal('confidence', { precision: 3, scale: 2 }).notNull().default('1.00'),
  diferencia: decimal('diferencia', { precision: 18, scale: 2 }).notNull().default('0'),
  group_members: jsonb('group_members').default([]), // IDs de comprobantes agrupados (matches manuales multi-selección)
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  conciliacionIdx: index('idx_cm_conciliacion').on(table.conciliacion_id),
}));
