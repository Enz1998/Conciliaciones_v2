// Tipos compartidos para el sistema de conciliación

export type MovementSource = 'EXTRACTO' | 'MAYOR';

export type MovementType = 'CREDITO' | 'DEBITO';

export type MovementCategory =
  | 'COBRANZA'
  | 'PAGO'
  | 'IMPUESTO'
  | 'COMISION'
  | 'INTERES'
  | 'MOV_FONDOS'
  | 'SUELDOS'
  | 'RENDIMIENTO'
  | 'OTRO';

export type MatchType = 'AUTO' | 'MANUAL' | 'GROUPED' | 'TAX_CHILD' | 'UNMATCHED';

// Movimiento normalizado (estructura común)
export interface NormalizedMovement {
  id: string;
  source: MovementSource;
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  referencia: string;
  contraparte: string;
  contraparte_normalizada: string;
  tipo: MovementType;
  monto: number;
  categoria: MovementCategory;
  metadata: Record<string, unknown>;
  match_group_id: string | null;
  match_type: MatchType;
}

// Movimiento crudo del extracto bancario (Galicia)
export interface RawExtractoMovement {
  Fecha: string;
  Descripcion: string;
  Origen: string;
  Debitos: string;
  Creditos: string;
  GrupoConceptos: string;
  Concepto: string;
  NumeroTerminal: string;
  ObservacionesCliente: string;
  NumeroComprobante: string;
  LeyendaAdicional1: string;
  LeyendaAdicional2: string;
  LeyendaAdicional3: string;
  LeyendaAdicional4: string;
  TipoMovimiento: string;
  Saldo: string;
}

// Movimiento crudo del extracto MercadoPago
export interface RawMPExtractoMovement {
  fechaPago: string;         // ISO 8601: "2026-04-22T10:09:05Z"
  tipoOperacion: string;     // "Cobro", "Costo de Mercado Pago", etc.
  numeroMovimiento: string;  // ID único del movimiento
  operacionRelacionada: string; // ID del grupo de operaciones relacionadas
  importe: number;           // positivo = crédito, negativo = débito
}

// Movimiento crudo del Libro Mayor (ERP)
export interface RawMayorMovement {
  FECHA: string;
  DOCUMENTO: string;
  ORGANIZACION: string;
  CENTRODECOSTO: string;
  CUENTA: string;
  DESCRIPCION: string;
  DEBEMONPRINCIPAL: string;
  HABERMONPRINCIPAL: string;
  SALDOMONPRINCIPAL: string;
}

// Resultado de un match individual
export interface MatchResult {
  id: string;
  extracto_id: string | null;
  mayor_id: string | null;
  match_type: MatchType;
  confidence: number; // 0 a 1
  difference: number;
  group_members?: string[]; // IDs de movimientos agrupados
}

// Resumen de conciliación
export interface ConciliacionSummary {
  total_extracto: number;
  total_mayor: number;
  matched_count: number;
  matched_amount: number;
  unmatched_extracto_count: number;
  unmatched_extracto_amount: number;
  unmatched_mayor_count: number;
  unmatched_mayor_amount: number;
  diferencia: number;
}

// Estado de conciliación completo
export interface ConciliacionState {
  id: string;
  nombre: string;
  extracto_file: string;
  mayor_file: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADA';
  movimientos: NormalizedMovement[];
  matches: MatchResult[];
  summary: ConciliacionSummary | null;
  created_at: string;
  updated_at: string;
}

export interface MatchStrategy {
  name: string;
  execute(extractoMovs: NormalizedMovement[], mayorMovs: NormalizedMovement[]): MatchResult[];
}

export interface BankMetadata {
  value: string;
  label: string;
  icon: string;
  extractoLabel: string;
  mayorLabel: string;
  acceptFormats: string;
}

export interface ParseResult<T> {
  movimientos: T[];
  saldoInicial?: number;
  saldoFinal?: number;
}

// Interface para parsers de banco (patrón Strategy)
export interface BankParser {
  bankName: string;
  metadata: BankMetadata;
  // CSV para Galicia
  parseCSV?(content: string): ParseResult<any>;
  // XLSX para MercadoPago
  parseXLSX?(buffer: any): ParseResult<any>;
  normalize(raw: (RawExtractoMovement | RawMPExtractoMovement)[]): NormalizedMovement[];
  getMatchingPipeline(): MatchStrategy[];
}

// Interface para parser de ERP (patrón Strategy)
export interface ERPParser {
  erpName: string;
  // CSV (Galicia)
  parseCSV?(content: string): ParseResult<RawMayorMovement>;
  // XLSX (MercadoPago Mayor)
  parseXLSX?(buffer: any): ParseResult<RawMayorMovement>;
  normalize(raw: RawMayorMovement[]): NormalizedMovement[];
}
