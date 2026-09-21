import fs from 'fs';
import { GaliciaExtractoParser } from './src/modules/banks/galicia/extracto-parser';

async function test() {
  const parser = new GaliciaExtractoParser();
  const stream = fs.createReadStream('../Archivos/Galicia_extracto.csv');
  try {
    const result = await parser.parseCSV(stream as any, 'utf8');
    console.log(`Parsed ${result.movimientos.length} records successfully.`);
  } catch (e) {
    console.error('Error parsing:', e);
  }
}
test();
