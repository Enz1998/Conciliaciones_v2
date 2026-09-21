const API_BASE = '/api';
const TOKEN = 'dev-super-secret-token';

const getHeaders = (isJson = false) => {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${TOKEN}`
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

export const getBanks = async () => {
  const res = await fetch(`${API_BASE}/conciliaciones/banks`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Error cargando los bancos disponibles');
  return res.json();
};

export interface UploadResult {
  id: string;
  estado: string;
  extractoMovs: any[];
  mayorMovs: any[];
  matches: any[];
  summary: any;
}

export async function uploadConciliacion(
  extractoFile: File,
  mayorFile: File,
  nombre: string,
  bankName: string = 'galicia',
  saldos?: {
    saldo_inicial_extracto?: string;
    saldo_final_extracto?: string;
    saldo_inicial_mayor?: string;
    saldo_final_mayor?: string;
  },
  periodo_id?: string
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('extracto', extractoFile);
  formData.append('mayor', mayorFile);
  formData.append('nombre', nombre);
  formData.append('bankName', bankName);
  if (periodo_id) formData.append('periodo_id', periodo_id);

  if (saldos?.saldo_inicial_extracto) formData.append('saldo_inicial_extracto', saldos.saldo_inicial_extracto);
  if (saldos?.saldo_final_extracto) formData.append('saldo_final_extracto', saldos.saldo_final_extracto);
  if (saldos?.saldo_inicial_mayor) formData.append('saldo_inicial_mayor', saldos.saldo_inicial_mayor);
  if (saldos?.saldo_final_mayor) formData.append('saldo_final_mayor', saldos.saldo_final_mayor);

  const res = await fetch(`${API_BASE}/conciliaciones/upload`, {
    method: 'POST',
    headers: getHeaders(), // FormData will omit content-type automatically
    body: formData,
  });

  if (!res.ok) {
    let errorMessage = 'Error al subir archivos';
    try {
      const err = await res.json();
      errorMessage = err.error || errorMessage;
    } catch {
      errorMessage = `Error del servidor de conexión: ${res.status}`;
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  const id = data.id;

  // Polling para esperar que el backend termine de procesar (API asíncrona)
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const statusRes = await fetch(`${API_BASE}/conciliaciones/${id}`, { headers: getHeaders() });
    if (!statusRes.ok) throw new Error('Error verificando estado de conciliación');
    const statusData = await statusRes.json();
    
    if (statusData.estado === 'COMPLETADA') {
      return statusData;
    } else if (statusData.estado === 'ERROR') {
      throw new Error('Error interno al procesar la conciliación en el servidor');
    }
  }
}

export async function getConciliacion(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/conciliaciones/${id}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Error al obtener conciliación');
  return res.json();
}

export async function listConciliaciones(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/conciliaciones`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Error al listar conciliaciones');
  return res.json();
}

export async function deleteConciliacion(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/conciliaciones/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Error al eliminar la conciliación');
  return res.json();
}

export async function createManualMatch(
  conciliacionId: string,
  extractoIds: string[],
  mayorIds: string[]
): Promise<any> {
  const res = await fetch(`${API_BASE}/conciliaciones/${conciliacionId}/match`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ extractoIds, mayorIds }),
  });
  if (!res.ok) throw new Error('Error al crear match manual');
  return res.json();
}

export async function deleteMatch(
  conciliacionId: string,
  matchId: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/conciliaciones/${conciliacionId}/match/${matchId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Error al deshacer match');
  return res.json();
}

export async function rematchConciliacion(
  conciliacionId: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/conciliaciones/${conciliacionId}/rematch`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Error al re-ejecutar matching');
  return res.json();
}

export async function updateConciliacionSaldos(
  conciliacionId: string,
  saldos: {
    saldo_inicial_extracto?: string;
    saldo_final_extracto?: string;
    saldo_inicial_mayor?: string;
    saldo_final_mayor?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/conciliaciones/${conciliacionId}/saldos`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify(saldos),
  });
  if (!res.ok) throw new Error('Error al actualizar saldos');
  return res.json();
}

// --- Periodos API ---

export async function getPeriodos(banco?: string): Promise<any[]> {
  const url = banco ? `${API_BASE}/periodos?banco=${banco}` : `${API_BASE}/periodos`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error('Error al obtener periodos');
  return res.json();
}

export async function createPeriodo(data: {
  banco: string; mes: number; anio: number;
  saldo_inicial_extracto?: string; saldo_inicial_mayor?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/periodos`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al crear periodo');
  }
  return res.json();
}

export async function updatePeriodoSaldos(id: string, data: {
  saldo_inicial_extracto?: string; saldo_inicial_mayor?: string;
  saldo_final_extracto?: string; saldo_final_mayor?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/periodos/${id}/saldos`, {
    method: 'PATCH',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar saldos del periodo');
  return res.json();
}

export async function cerrarPeriodo(id: string, data: {
  saldo_final_extracto: string; saldo_final_mayor: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/periodos/${id}/cerrar`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al cerrar el periodo');
  }
  return res.json();
}

export async function reabrirPeriodo(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/periodos/${id}/reabrir`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Error al reabrir el periodo');
  return res.json();
}

// --- Facturas API (AFIP vs ERP) ---

export async function syncProveedores(file: File): Promise<{ count: number }> {
  const formData = new FormData();
  formData.append('proveedores', file);
  const res = await fetch(`${API_BASE}/facturas/proveedores/sync`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al sincronizar el maestro de proveedores');
  }
  return res.json();
}

export async function getProveedoresCount(): Promise<{ count: number }> {
  const res = await fetch(`${API_BASE}/facturas/proveedores/count`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Error al consultar el maestro de proveedores');
  return res.json();
}

export async function uploadFacturas(
  afipFile: File,
  erpFile: File,
  nombre: string,
  periodo_id?: string
): Promise<any> {
  const formData = new FormData();
  formData.append('afip', afipFile);
  formData.append('erp', erpFile);
  formData.append('nombre', nombre);
  if (periodo_id) formData.append('periodo_id', periodo_id);

  const res = await fetch(`${API_BASE}/facturas/upload`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  });

  if (!res.ok) {
    let errorMessage = 'Error al subir archivos';
    try {
      const err = await res.json();
      errorMessage = err.error || errorMessage;
    } catch {
      errorMessage = `Error del servidor de conexión: ${res.status}`;
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  const id = data.id;

  while (true) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const statusRes = await fetch(`${API_BASE}/facturas/${id}`, { headers: getHeaders() });
    if (!statusRes.ok) throw new Error('Error verificando estado de la conciliación');
    const statusData = await statusRes.json();

    if (statusData.estado === 'COMPLETADA') return statusData;
    if (statusData.estado === 'ERROR') throw new Error('Error interno al procesar la conciliación en el servidor');
  }
}

export async function getFacturasConciliacion(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/facturas/${id}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Error al obtener la conciliación');
  return res.json();
}

export async function listFacturasConciliaciones(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/facturas`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Error al listar las conciliaciones');
  return res.json();
}

export async function deleteFacturasConciliacion(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/facturas/${id}`, { method: 'DELETE', headers: getHeaders() });
  if (!res.ok) throw new Error('Error al eliminar la conciliación');
  return res.json();
}

export async function createFacturaManualMatch(conciliacionId: string, afipIds: string[], erpIds: string[]): Promise<any> {
  const res = await fetch(`${API_BASE}/facturas/${conciliacionId}/match`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ afipIds, erpIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al crear match manual');
  }
  return res.json();
}

export async function deleteFacturaComprobantes(conciliacionId: string, ids: string[]): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/facturas/${conciliacionId}/comprobantes`, {
    method: 'DELETE',
    headers: getHeaders(true),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al eliminar los comprobantes');
  }
  return res.json();
}

export async function deleteFacturaMatch(conciliacionId: string, matchId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/facturas/${conciliacionId}/match/${matchId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Error al deshacer match');
  return res.json();
}

export async function setProveedorConcepto(nombre: string, concepto: string): Promise<{ nombre_normalizado: string; concepto: string }> {
  const res = await fetch(`${API_BASE}/facturas/conceptos`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify({ nombre, concepto }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al guardar el concepto');
  }
  return res.json();
}

export async function rematchFacturas(conciliacionId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/facturas/${conciliacionId}/rematch`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Error al re-ejecutar el matching');
  return res.json();
}
