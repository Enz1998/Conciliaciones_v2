export interface NormalizedMovement {
  id: string;
  source: 'EXTRACTO' | 'MAYOR';
  fecha: string;
  descripcion: string;
  referencia: string;
  contraparte: string;
  contraparte_normalizada: string;
  tipo: 'CREDITO' | 'DEBITO';
  monto: number;
  categoria: string;
  metadata: Record<string, unknown>;
  match_group_id: string | null;
  match_type: 'AUTO' | 'MANUAL' | 'GROUPED' | 'TAX_CHILD' | 'UNMATCHED';
}

export interface MatchResult {
  id: string;
  extracto_id: string | null;
  mayor_id: string | null;
  match_type: string;
  confidence: number;
  difference: number;
  group_members?: string[];
}

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

export interface ConciliacionState {
  id: string;
  nombre: string;
  extracto_filename: string;
  mayor_filename: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  extractoMovs: NormalizedMovement[];
  mayorMovs: NormalizedMovement[];
  matches: MatchResult[];
  summary: ConciliacionSummary;
  created_at: string;
}

// ── Módulo de Facturas (AFIP vs ERP) ──

export type TipoComprobante = 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';

export interface NormalizedComprobante {
  id: string;
  source: 'AFIP' | 'ERP';
  tipoComprobante: TipoComprobante;
  letra: string;
  puntoVenta: number;
  numero: number;
  fecha: string;
  cuitEmisor: string | null;
  emisor: string;
  emisor_normalizado: string;
  moneda: string;
  cotizacion: number;
  importeTotal: number;
  importeTotalLocal: number;
  metadata: Record<string, unknown>;
  match_group_id: string | null;
  match_type: 'AUTO' | 'MANUAL' | 'UNMATCHED';
  concepto?: string;
}

export interface ComprobanteMatchResult {
  id: string;
  afip_id: string | null;
  erp_id: string | null;
  match_type: string;
  confidence: number;
  difference: number;
  group_members?: string[];
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

export interface FacturasConciliacionState {
  id: string;
  nombre: string;
  afip_filename: string;
  erp_filename: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  omitidos_afip: number;
  omitidos_erp: number;
  afipComps: NormalizedComprobante[];
  erpComps: NormalizedComprobante[];
  matches: ComprobanteMatchResult[];
  summary: FacturasConciliacionSummary;
  created_at: string;
}
