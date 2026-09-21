import { TipoComprobante } from '../../shared/types';

/**
 * Mapa código de comprobante AFIP → categoría normalizada.
 * `null` = fuera de alcance del módulo (Recibos, Tiques, Liquidaciones, Notas de
 * venta al contado, Otros comprobantes — ver plan_modulo_facturas.md, Decisión 4).
 * Un código no listado también se trata como fuera de alcance (default seguro).
 */
const AFIP_CODIGO_TIPO: Record<number, TipoComprobante | null> = {
  1: 'FACTURA', 6: 'FACTURA', 11: 'FACTURA', 19: 'FACTURA', 51: 'FACTURA',
  201: 'FACTURA', 206: 'FACTURA', 211: 'FACTURA',
  2: 'NOTA_DEBITO', 7: 'NOTA_DEBITO', 12: 'NOTA_DEBITO', 20: 'NOTA_DEBITO', 52: 'NOTA_DEBITO',
  202: 'NOTA_DEBITO', 207: 'NOTA_DEBITO', 212: 'NOTA_DEBITO',
  3: 'NOTA_CREDITO', 8: 'NOTA_CREDITO', 13: 'NOTA_CREDITO', 21: 'NOTA_CREDITO', 53: 'NOTA_CREDITO',
  203: 'NOTA_CREDITO', 208: 'NOTA_CREDITO', 213: 'NOTA_CREDITO',
  // Fuera de alcance (Decisión 4)
  4: null, 9: null, 15: null, 54: null,           // Recibo
  5: null, 10: null,                                // Nota de venta al contado
  39: null, 40: null, 41: null,                     // Otros comprobantes
  60: null, 61: null, 63: null, 64: null,           // Cuenta de venta / Liquidación
  81: null, 82: null, 83: null, 110: null, 111: null, 112: null, 113: null, 118: null, // Tique
};

/** Categoriza un comprobante AFIP por su código numérico. */
export function categorizarTipoAfip(codigo: number): TipoComprobante | null {
  return Object.prototype.hasOwnProperty.call(AFIP_CODIGO_TIPO, codigo) ? AFIP_CODIGO_TIPO[codigo] : null;
}

const ERP_TIPO_CATEGORIA: Record<string, TipoComprobante | null> = {
  'Factura': 'FACTURA',
  'Nota de Crédito': 'NOTA_CREDITO',
  'Nota de Débito': 'NOTA_DEBITO',
  'Recibo': null,
  'Extracto Bancario': null,
  'Otros Comprobantes': null,
};

/** Categoriza una fila del libro de facturas del ERP por su columna `Tipo`. */
export function categorizarTipoErp(tipo: string): TipoComprobante | null {
  const key = (tipo || '').trim();
  return Object.prototype.hasOwnProperty.call(ERP_TIPO_CATEGORIA, key) ? ERP_TIPO_CATEGORIA[key] : null;
}

/** Extrae código y letra del texto de AFIP: "1 - Factura A" → { codigo: 1, letra: 'A' }. */
export function parseTipoAfip(tipoRaw: string): { codigo: number; letra: string } | null {
  const m = (tipoRaw || '').trim().match(/^(\d+)\s*-\s*.+?\s+([A-Za-z])\s*$/);
  if (!m) return null;
  return { codigo: parseInt(m[1], 10), letra: m[2].toUpperCase() };
}

/** Extrae letra + PtoVta + Número del campo `Comprobante` del ERP: "A-00001-00001689". */
export function parseComprobanteErp(comprobante: string): { letra: string; puntoVenta: number; numero: number } | null {
  const m = (comprobante || '').trim().match(/^([A-Za-z])-(\d+)-(\d+)$/);
  if (!m) return null;
  return { letra: m[1].toUpperCase(), puntoVenta: parseInt(m[2], 10), numero: parseInt(m[3], 10) };
}

/**
 * Signo a aplicar según el tipo de comprobante, sobre el valor absoluto del monto.
 * No confía en el signo crudo del archivo: AFIP informa las NC en positivo,
 * el ERP las registra en negativo — acá se normaliza a una única convención
 * (NC siempre negativa) para que ambos lados sean comparables.
 */
export function signoPorTipo(tipo: TipoComprobante): 1 | -1 {
  return tipo === 'NOTA_CREDITO' ? -1 : 1;
}

/** Limpia un CUIT/DNI a solo dígitos, para comparar sin guiones/espacios/puntos. */
export function limpiarCuit(valor: string | number | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const digits = String(valor).replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

/** Clave canónica de comprobante, usada para matching exacto y para el índice único de la DB. */
export function claveComprobante(letra: string, puntoVenta: number, numero: number): string {
  return `${letra}-${String(puntoVenta).padStart(5, '0')}-${String(numero).padStart(8, '0')}`;
}
