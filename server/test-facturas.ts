import fs from 'fs';
import path from 'path';
import { AfipComprobantesParser } from './src/modules/facturas/afip-parser';
import { ErpFacturasParser } from './src/modules/facturas/erp-parser';
import { ProveedoresParser, buildProveedorLookup } from './src/modules/facturas/proveedores-parser';
import { facturasMatchingEngine } from './src/modules/facturas/matching/engine';

const ROOT = path.resolve(__dirname, '..');

const afipBuf = fs.readFileSync(path.join(ROOT, 'FACTURAS/Mis Comprobantes Recibidos - CUIT 30715919792 (44).xlsx'));
const erpBuf = fs.readFileSync(path.join(ROOT, 'FACTURAS/Factura copia.xlsx'));
const provBuf = fs.readFileSync(path.join(ROOT, 'FACTURAS/Capasitio SAS - Proveedores.xlsx'));

const afipParser = new AfipComprobantesParser();
const erpParser = new ErpFacturasParser();
const provParser = new ProveedoresParser();

const rawProv = provParser.parseXLSX(provBuf);
const proveedores = provParser.normalize(rawProv);
console.log('Proveedores parseados:', proveedores.length);
console.log('Ejemplo:', proveedores[0]);

const lookup = buildProveedorLookup(proveedores);

const rawAfip = afipParser.parseXLSX(afipBuf);
console.log('\nAFIP filas crudas:', rawAfip.length);
const { comprobantes: afipComps, omitidos: afipOmitidos } = afipParser.normalize(rawAfip);
console.log('AFIP normalizados (en alcance):', afipComps.length, '| omitidos:', afipOmitidos);
console.log('Tipos en alcance:', [...new Set(afipComps.map(c => c.tipoComprobante))]);
console.log('Ejemplo AFIP:', JSON.stringify(afipComps[0], null, 2));

const rawErp = erpParser.parseXLSX(erpBuf);
console.log('\nERP filas crudas:', rawErp.length);
const { comprobantes: erpComps, omitidos: erpOmitidos } = erpParser.normalize(rawErp, lookup);
console.log('ERP normalizados (en alcance):', erpComps.length, '| omitidos:', erpOmitidos);
console.log('Tipos en alcance:', [...new Set(erpComps.map(c => c.tipoComprobante))]);
console.log('Con CUIT resuelto:', erpComps.filter(c => c.cuitEmisor).length, '/', erpComps.length);
console.log('Ejemplo ERP:', JSON.stringify(erpComps[0], null, 2));
console.log('Ejemplo ERP (NC):', JSON.stringify(erpComps.find(c => c.tipoComprobante === 'NOTA_CREDITO'), null, 2));

// Cruce por clave exacta CUIT+Letra+PtoVta+Numero
const key = (c: any) => `${c.cuitEmisor}|${c.letra}|${c.puntoVenta}|${c.numero}`;
const afipByKey = new Map(afipComps.map(c => [key(c), c]));
let matched = 0;
for (const e of erpComps) {
  if (afipByKey.has(key(e))) matched++;
}
console.log(`\nMatch exacto CUIT+Letra+PtoVta+Numero: ${matched} / ${erpComps.length} facturas ERP`);

const sinCuit = erpComps.filter(c => !c.cuitEmisor);
console.log('ERP sin CUIT resuelto:', sinCuit.length);
if (sinCuit.length) console.log('Ejemplos:', sinCuit.slice(0, 5).map(c => c.emisor));

// Motor de matching completo (para simular una conciliación real, filtramos
// el ERP al rango de fechas del archivo AFIP, como pasaría en un caso de uso real).
const fechasAfip = afipComps.map(c => c.fecha).sort();
const [minFecha, maxFecha] = [fechasAfip[0], fechasAfip[fechasAfip.length - 1]];
const erpDelPeriodo = erpComps.filter(c => c.fecha >= minFecha && c.fecha <= maxFecha);
console.log(`\nPeriodo AFIP: ${minFecha} a ${maxFecha}`);
console.log('ERP en ese periodo:', erpDelPeriodo.length, '/', erpComps.length);

const { matches, afipComps: afipFinal, erpComps: erpFinal } = facturasMatchingEngine.execute(afipComps, erpDelPeriodo);
console.log('\nMatches totales:', matches.length);
console.log('  AUTO (paso 1, exacto):', matches.filter(m => m.confidence === 1.0).length);
console.log('  AUTO (paso 2, proveedor+importe):', matches.filter(m => m.confidence === 0.7).length);
console.log('  Con diferencia > 0:', matches.filter(m => m.difference > 0).length);
console.log('AFIP sin match:', afipFinal.filter(c => c.match_type === 'UNMATCHED').length, '/', afipFinal.length);
console.log('ERP sin match:', erpFinal.filter(c => c.match_type === 'UNMATCHED').length, '/', erpFinal.length);
console.log('\nEjemplos AFIP sin match:', afipFinal.filter(c => c.match_type === 'UNMATCHED').slice(0, 5).map(c => `${c.letra}-${c.puntoVenta}-${c.numero} ${c.emisor} $${c.importeTotalLocal}`));
console.log('Ejemplos ERP sin match:', erpFinal.filter(c => c.match_type === 'UNMATCHED').slice(0, 5).map(c => `${c.letra}-${c.puntoVenta}-${c.numero} ${c.emisor} $${c.importeTotalLocal}`));
