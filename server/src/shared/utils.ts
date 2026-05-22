import { MovementCategory, MovementType } from '../shared/types';

/**
 * Normaliza un string de nombre de contraparte para fuzzy matching.
 * Elimina tipos societarios, puntuación, y palabras vacías.
 */
export function normalizarContraparte(nombre: string): string {
  return nombre
    .toUpperCase()
    .replace(/S\.?\s*A\.?\s*S\.?\s*$/g, '')
    .replace(/S\.?\s*R\.?\s*L\.?\s*$/g, '')
    .replace(/S\.?\s*C\.?\s*$/g, '')
    .replace(/S\.?\s*A\.?\s*C\.?\s*I\.?\s*F\.?\s*I\.?\s*A\.?\s*$/g, '')
    .replace(/S\.?\s*A\.?\s*C\.?\s*E\.?\s*I\.?\s*$/g, '')
    .replace(/S\.?\s*A\.?\s*U\.?\s*$/g, '')
    .replace(/S\.?\s*A\.?\s*P\.?\s*E\.?\s*M\.?\s*$/g, '')
    .replace(/[.,;:\-–—()\[\]{}'"]/g, ' ')
    .replace(/\b(DE|DEL|LA|EL|LOS|LAS|Y|E|EN|CON|POR|PARA)\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Parsea un monto en formato argentino (coma decimal) a número.
 * Ej: "65000,00" → 65000.00, "1.296.811,80" → 1296811.80
 */
export function parseMontoArg(valor: string): number {
  if (!valor || valor.trim() === '') return 0;
  // Eliminar puntos de miles y reemplazar coma decimal por punto
  const limpio = valor.replace(/\./g, '').replace(',', '.');
  return parseFloat(limpio) || 0;
}

/**
 * Parsea un monto con punto decimal (formato ERP) a número.
 * Ej: "353164.7100" → 353164.71
 */
export function parseMontoERP(valor: string): number {
  if (!valor || valor.trim() === '') return 0;
  return parseFloat(valor.trim()) || 0;
}

/**
 * Parsea una fecha en formato DD/MM/YYYY a YYYY-MM-DD.
 */
export function parseFechaDMY(valor: string): string {
  const partes = valor.trim().split('/');
  if (partes.length !== 3) return valor;
  const [d, m, y] = partes;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Parsea una fecha en formato DD-MM-YYYY a YYYY-MM-DD.
 */
export function parseFechaDMYGuion(valor: string): string {
  const partes = valor.trim().split('-');
  if (partes.length !== 3) return valor;
  const [d, m, y] = partes;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Parsea una fecha/datetime ISO 8601 a YYYY-MM-DD.
 * Ej: "2026-04-22T10:09:05Z" → "2026-04-22"
 * Tambien acepta un objeto Date (que devuelve XLSX).
 */
export function parseFechaISO(valor: string | Date): string {
  if (valor instanceof Date) {
    // xlsx puede devolver un objeto Date directamente
    const y = valor.getUTCFullYear();
    const m = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const d = String(valor.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Tomar solo la parte de la fecha del string ISO
  return String(valor).substring(0, 10);
}

/**
 * Clasifica un movimiento según su descripción y concepto.
 */
export function clasificarMovimiento(
  descripcion: string,
  grupoConceptos?: string
): MovementCategory {
  const d = descripcion.toUpperCase();

  if (/DEB\.\s*AUTOM\.\s*DE\s*SERV/i.test(d)) return 'PAGO';
  if (/TRF\s*INMED\s*PROVEED/i.test(d)) return 'PAGO';
  if (/PAGO\s*N°/i.test(d)) return 'PAGO';
  if (/SERVICIO\s*ACREDITAMIENTO\s*DE\s*HABERES/i.test(d)) return 'SUELDOS';
  if (/SUELDO/i.test(d)) return 'SUELDOS';
  if (/Salida de Fondos/i.test(d)) return 'MOV_FONDOS';

  if (/ING\.\s*BRUTOS/i.test(d)) return 'IMPUESTO';
  if (/IMP\.\s*DEB\./i.test(d)) return 'IMPUESTO';
  if (/IMP\.\s*CRE\./i.test(d)) return 'IMPUESTO';
  if (/IVA\b/i.test(d)) return 'IMPUESTO';
  if (/PERCEP\.\s*IVA/i.test(d)) return 'IMPUESTO';
  if (/SELLOS/i.test(d)) return 'IMPUESTO';
  if (/IMP\.\s*ING\./i.test(d)) return 'IMPUESTO';

  if (grupoConceptos?.includes('000808')) return 'COMISION';
  if (/COMISION/i.test(d)) return 'COMISION';

  if (/INTERES/i.test(d)) return 'INTERES';
  if (/000814/i.test(grupoConceptos || '')) return 'INTERES';

  if (/Movimiento de Fondos/i.test(d)) return 'MOV_FONDOS';
  if (/TRANSF\.\s*FONDOS\s*ENTRE\s*BANCOS/i.test(d)) return 'MOV_FONDOS';
  if (/Asiento Manual/i.test(d)) return 'OTRO';

  if (
    /TRANSFERENCIA\s*DE\s*TERCEROS/i.test(d) ||
    /CREDITO\s*TRANSFERENCIA/i.test(d) ||
    /TRANSFERENCIAS\s*CASH\s*PROVEEDORES/i.test(d) ||
    /SERVICIO\s*PAGO\s*A\s*PROVEEDORES/i.test(d) ||
    /SNP\s*PAGO/i.test(d) ||
    /Cobranza\s*Auto/i.test(d) ||
    /Cobranza/i.test(d)
  ) {
    return 'COBRANZA';
  }

  // Patrones adicionales para entries del ERP (asientos manuales, gastos bancarios)
  if (/GASTOS\s*BANCARIOS|CARGOS\s*BANCARIOS/i.test(d)) return 'COMISION';
  if (/RETENCION|PERCEPCION/i.test(d)) return 'IMPUESTO';

  return 'OTRO';
}

/**
 * Clasifica un movimiento de MercadoPago según su Tipo de Operación.
 * Más preciso que clasificarMovimiento() porque usa el tipo explícito de MP.
 */
export function clasificarMovimientoMP(tipoOperacion: string): MovementCategory {
  const t = tipoOperacion.toLowerCase().trim();

  // Cobranzas / ingresos
  if (t === 'cobro') return 'COBRANZA';
  if (t === 'ingreso de dinero') return 'COBRANZA';
  if (t === 'dinero recibido') return 'COBRANZA';
  if (t === 'pago con descuento recibido') return 'COBRANZA';

  // Rendimiento de fondos (se agrupa mensualmente)
  if (t === 'rendimiento positivo de la inversión') return 'INTERES';

  // Impuestos y retenciones
  if (t.startsWith('retención') || t.startsWith('retencion')) return 'IMPUESTO';
  if (t.startsWith('impuesto')) return 'IMPUESTO';
  if (t.startsWith('anulación de retención') || t.startsWith('anulacion de retencion')) return 'IMPUESTO';
  if (t.startsWith('anulación de impuesto') || t.startsWith('anulacion de impuesto')) return 'IMPUESTO';

  // Comisiones de MercadoPago
  if (t === 'costo de mercado pago') return 'COMISION';
  if (t === 'anulación de costo de mercado pago' || t === 'anulacion de costo de mercado pago') return 'COMISION';

  // Pagos salientes
  if (t === 'pago') return 'PAGO';

  // Retiros / transferencias a banco propio
  if (t === 'retiro de dinero') return 'MOV_FONDOS';

  // Movimiento general = transferencia a cuenta propia
  if (t === 'movimiento general') return 'MOV_FONDOS';

  // Devoluciones
  if (t === 'devolución de cobro' || t === 'devolucion de cobro') return 'OTRO';

  return 'OTRO';
}

/**
 * Determina el tipo (CREDITO/DEBITO) a partir de los campos de monto.
 */
export function determinarTipo(
  tieneDebito: boolean,
  tieneCredito: boolean
): MovementType {
  if (tieneDebito && !tieneCredito) return 'DEBITO';
  if (tieneCredito && !tieneDebito) return 'CREDITO';
  return 'CREDITO'; // default
}
