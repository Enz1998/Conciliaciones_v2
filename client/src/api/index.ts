const API_BASE = '/api';

export const getBanks = async () => {
  const res = await fetch(`${API_BASE}/conciliaciones/banks`);
  if (!res.ok) throw new Error('Error cargando los bancos disponibles');
  return res.json();
};

export interface UploadResult {
  id: string;
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
  }
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('extracto', extractoFile);
  formData.append('mayor', mayorFile);
  formData.append('nombre', nombre);
  formData.append('bankName', bankName);

  if (saldos?.saldo_inicial_extracto) formData.append('saldo_inicial_extracto', saldos.saldo_inicial_extracto);
  if (saldos?.saldo_final_extracto) formData.append('saldo_final_extracto', saldos.saldo_final_extracto);
  if (saldos?.saldo_inicial_mayor) formData.append('saldo_inicial_mayor', saldos.saldo_inicial_mayor);
  if (saldos?.saldo_final_mayor) formData.append('saldo_final_mayor', saldos.saldo_final_mayor);

  const res = await fetch(`${API_BASE}/conciliaciones/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al subir archivos');
  }

  return res.json();
}

export async function getConciliacion(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/conciliaciones/${id}`);
  if (!res.ok) throw new Error('Error al obtener conciliación');
  return res.json();
}

export async function listConciliaciones(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/conciliaciones`);
  if (!res.ok) throw new Error('Error al listar conciliaciones');
  return res.json();
}

export async function deleteConciliacion(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/conciliaciones/${id}`, {
    method: 'DELETE',
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
    headers: { 'Content-Type': 'application/json' },
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
  });
  if (!res.ok) throw new Error('Error al deshacer match');
  return res.json();
}

export async function rematchConciliacion(
  conciliacionId: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/conciliaciones/${conciliacionId}/rematch`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Error al re-ejecutar matching');
  return res.json();
}
