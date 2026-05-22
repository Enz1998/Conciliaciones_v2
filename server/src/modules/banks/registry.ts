import { BankParser } from '../../shared/types';
import { GaliciaExtractoParser } from './galicia/extracto-parser';
import { MercadoPagoExtractoParser } from './mercadopago/extracto-parser';

/**
 * Registro de parsers bancarios.
 * Para agregar un nuevo banco:
 * 1. Crear una carpeta con el nombre del banco
 * 2. Implementar la interfaz BankParser
 * 3. Registrarlo aquí
 */
export const bankParsers: Map<string, BankParser> = new Map();

// Registrar parsers disponibles
const galiciaParser = new GaliciaExtractoParser();
bankParsers.set('galicia', galiciaParser);

const mpParser = new MercadoPagoExtractoParser();
bankParsers.set('mercadopago', mpParser);

export function getBankParser(bankName: string): BankParser {
  const parser = bankParsers.get(bankName.toLowerCase());
  if (!parser) {
    throw new Error(`No parser found for bank: ${bankName}. Available: ${[...bankParsers.keys()].join(', ')}`);
  }
  return parser;
}

export function listBanks(): string[] {
  return [...bankParsers.keys()];
}

export { GaliciaExtractoParser, MercadoPagoExtractoParser };
