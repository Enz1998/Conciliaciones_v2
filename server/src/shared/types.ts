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

// Movimiento crudo del extracto Banco Macro
export interface RawMacroExtractoMovement {
  fecha: Date | string;       // Date object de Excel o string ISO
  referencia: string;         // Nro. de Referencia
  causal: string;             // Código causal (ej: "4254", "1684")
  concepto: string;           // Descripción del movimiento + contraparte
  importe: number;            // Positivo = crédito, negativo = débito
  saldo: number;              // Saldo acumulado
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
  parseCSV?(stream: any, encoding: any): Promise<ParseResult<any>>;
  // XLSX para MercadoPago
  parseXLSX?(buffer: any): ParseResult<any>;
  normalize(raw: (RawExtractoMovement | RawMPExtractoMovement | RawMacroExtractoMovement)[]): NormalizedMovement[];
  getMatchingPipeline(): MatchStrategy[];
}

// Interface para parser de ERP (patrón Strategy)
export interface ERPParser {
  erpName: string;
  // CSV (Galicia)
  parseCSV?(stream: any, encoding: any): Promise<ParseResult<RawMayorMovement>>;
  // XLSX (MercadoPago Mayor)
  parseXLSX?(buffer: any): ParseResult<RawMayorMovement>;
  normalize(raw: RawMayorMovement[]): NormalizedMovement[];
}

// ══════════════════════════════════════════════════════════════════
// Módulo de Conciliación de Facturas (AFIP vs ERP)
// ══════════════════════════════════════════════════════════════════

export type ComprobanteSource = 'AFIP' | 'ERP';

// Categoría fiscal normalizada. Solo FACTURA/NOTA_CREDITO/NOTA_DEBITO entran
// al pipeline de matching — el resto (Recibo, Tique, Liquidación, etc.) se
// filtra en el parser (ver plan_modulo_facturas.md, Decisión 4).
export type TipoComprobante = 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';

export type ComprobanteMatchType = 'AUTO' | 'MANUAL' | 'UNMATCHED';

// Movimiento crudo de "Mis Comprobantes Recibidos" (AFIP) — 30 columnas.
export interface RawAfipComprobante {
  Fecha: string | Date;
  Tipo: string; // ej: "1 - Factura A"
  PuntoDeVenta: number;
  NumeroDesde: number;
  NumeroHasta: number;
  CodAutorizacion: string;
  TipoDocEmisor: string;
  NroDocEmisor: string;
  DenominacionEmisor: string;
  TipoDocReceptor: string;
  NroDocReceptor: string;
  TipoCambio: number;
  Moneda: string;
  ImpTotal: number;
  // Resto del desglose de IVA por alícuota y otros totales — se preserva
  // completo en metadata pero no hace falta tipar cada columna acá.
  [key: string]: unknown;
}

// Movimiento crudo del libro de facturas del ERP — 14 columnas.
export interface RawERPFactura {
  Fecha: string | Date;
  FFiscal: string | Date;
  Tipo: string; // "Factura" | "Nota de Crédito" | "Nota de Débito" | "Recibo" | "Extracto Bancario" | "Otros Comprobantes"
  Comprobante: string; // "A-00001-00001689"
  Proveedor: string;
  Moneda: string;
  ImporteBruto: number;
  Impuestos: number;
  Total: number;
  Observaciones: string;
  Provincia: string;
  Cotizacion: number;
  TotalMonPrincipal: number;
  cbuinformada: string;
}

// Fila cruda del maestro de proveedores del ERP.
export interface RawProveedorERP {
  Nombre: string;
  Codigo: string;
  CondicionIVA: string;
  TipoIdentificacion: string;
  NumeroIdentificacion: string;
  Provincia: string;
  Activo: boolean;
}

// Comprobante normalizado (estructura común AFIP/ERP).
export interface NormalizedComprobante {
  id: string;
  source: ComprobanteSource;
  tipoComprobante: TipoComprobante;
  letra: string;
  puntoVenta: number;
  numero: number;
  fecha: string; // YYYY-MM-DD
  cuitEmisor: string | null;
  emisor: string;
  emisor_normalizado: string;
  moneda: string;
  cotizacion: number;
  importeTotal: number; // con signo aplicado por tipo (NC negativo), en moneda original
  importeTotalLocal: number; // con signo aplicado por tipo, convertido a moneda local
  metadata: Record<string, unknown>;
  match_group_id: string | null;
  match_type: ComprobanteMatchType;
  concepto?: string; // anotación del usuario a nivel proveedor (no viene del parser, se adjunta al leer)
}

// Proveedor normalizado (tabla de referencia importada del ERP).
export interface NormalizedProveedor {
  id: string;
  nombre: string;
  nombre_normalizado: string;
  cuit: string;
  condicion_iva: string;
  activo: boolean;
}

// Resultado de un match individual de facturas.
export interface ComprobanteMatchResult {
  id: string;
  afip_id: string | null;
  erp_id: string | null;
  match_type: ComprobanteMatchType;
  confidence: number; // 0 a 1
  difference: number;
  group_members?: string[];
}

export interface ComprobanteParseResult<T> {
  comprobantes: T[];
  omitidos: number; // filas fuera de alcance (Recibo, Tique, Extracto Bancario, etc.)
}

export interface FacturasMatchStrategy {
  name: string;
  execute(afipComps: NormalizedComprobante[], erpComps: NormalizedComprobante[]): ComprobanteMatchResult[];
}

export interface FacturasConciliacionSummary {
  total_afip: number;
  total_erp: number;
  matched_count: number;
  matched_amount: number;
  unmatched_afip_count: number;
  unmatched_afip_amount: number;
  unmatched_erp_count: number;
  unmatched_erp_amount: number;
  diferencia: number;
}
