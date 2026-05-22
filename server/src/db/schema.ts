import { pgTable, uuid, varchar, decimal, date, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

// Tabla de conciliaciones (una por cada par extracto+mayor procesado)
export const conciliaciones = pgTable('conciliaciones', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
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
