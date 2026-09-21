import { NormalizedComprobante, ComprobanteMatchResult, FacturasMatchStrategy } from '../../../shared/types';
import { ComprobanteExactoStrategy } from './comprobante-exacto';
import { ProveedorImporteStrategy } from './proveedor-importe';

export const facturasMatchingPipeline: FacturasMatchStrategy[] = [
  new ComprobanteExactoStrategy(),
  new ProveedorImporteStrategy(),
];

export class FacturasMatchingEngine {
  execute(
    afipComps: NormalizedComprobante[],
    erpComps: NormalizedComprobante[],
    strategies: FacturasMatchStrategy[] = facturasMatchingPipeline
  ): { matches: ComprobanteMatchResult[]; afipComps: NormalizedComprobante[]; erpComps: NormalizedComprobante[] } {
    const afip = afipComps.map((c) => ({ ...c }));
    const erp = erpComps.map((c) => ({ ...c }));

    const allMatches: ComprobanteMatchResult[] = [];

    for (const strategy of strategies) {
      const results = strategy.execute(afip, erp);
      allMatches.push(...results);

      for (const match of results) {
        if (match.afip_id) {
          const idx = afip.findIndex((c) => c.id === match.afip_id);
          if (idx >= 0) { afip[idx].match_type = match.match_type; afip[idx].match_group_id = match.id; }
        }
        if (match.erp_id) {
          const idx = erp.findIndex((c) => c.id === match.erp_id);
          if (idx >= 0) { erp[idx].match_type = match.match_type; erp[idx].match_group_id = match.id; }
        }
      }
    }

    return { matches: allMatches, afipComps: afip, erpComps: erp };
  }
}

export const facturasMatchingEngine = new FacturasMatchingEngine();
