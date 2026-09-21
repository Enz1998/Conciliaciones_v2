// Tolerancia de diferencia de importe — Decisión 7 del plan: $1 o 0.1% del
// monto (lo que sea mayor), para absorber redondeos de IVA/cotización.
const TOLERANCIA_ABSOLUTA = 1;
const TOLERANCIA_RELATIVA = 0.001;

export function dentroDeTolerancia(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const base = Math.max(Math.abs(a), Math.abs(b));
  return diff <= Math.max(TOLERANCIA_ABSOLUTA, base * TOLERANCIA_RELATIVA);
}

export function diferencia(a: number, b: number): number {
  return Math.round(Math.abs(a - b) * 100) / 100;
}
