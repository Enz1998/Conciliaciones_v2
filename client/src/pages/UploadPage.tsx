import React, { useState } from 'react';
import { uploadConciliacion } from '../api';

interface Props {
  onComplete: (id: string) => void;
}

export function UploadPage({ onComplete }: Props) {
  const [extractoFile, setExtractoFile] = useState<File | null>(null);
  const [mayorFile, setMayorFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [saldoIniExt, setSaldoIniExt] = useState('');
  const [saldoFinExt, setSaldoFinExt] = useState('');
  const [saldoIniMay, setSaldoIniMay] = useState('');
  const [saldoFinMay, setSaldoFinMay] = useState('');

  const handleUpload = async () => {
    if (!extractoFile || !mayorFile) { setError('Seleccioná ambos archivos'); return; }
    setLoading(true); setError('');
    try {
      const result = await uploadConciliacion(
        extractoFile, mayorFile, 
        nombre || `Conciliación ${new Date().toLocaleDateString('es-AR')}`, 
        'galicia',
        {
          saldo_inicial_extracto: saldoIniExt,
          saldo_final_extracto: saldoFinExt,
          saldo_inicial_mayor: saldoIniMay,
          saldo_final_mayor: saldoFinMay
        }
      );
      onComplete(result.id);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const DropZone = ({ label, file, setFile, id }: { label: string; file: File | null; setFile: (f: File | null) => void; id: string; }) => (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      <div
        onClick={() => document.getElementById(id)?.click()}
        style={{
          border: '2px dashed #ddd', borderRadius: 10, padding: 28, textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.15s', minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: file ? '#f9fdf9' : '#fafafa', borderColor: file ? '#86efac' : '#ddd',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
      >
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📄</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>{file.name}</span>
            <span style={{ fontSize: 11, color: '#aaa' }}>{(file.size / 1024).toFixed(0)} KB</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#aaa' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📥</div>
            Arrastrá el archivo o click para seleccionar
          </div>
        )}
        <input id={id} type="file" accept=".csv,.xlsx" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: 48 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 4 }}>Nueva Conciliación</h2>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>Subí el extracto bancario y el libro mayor para empezar</p>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre</label>
        <input
          type="text" placeholder={`Conciliación ${new Date().toLocaleDateString('es-AR')}`}
          value={nombre} onChange={(e) => setNombre(e.target.value)}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <DropZone label="Extracto Bancario" file={extractoFile} setFile={setExtractoFile} id="file-extracto" />
        <DropZone label="Libro Mayor (ERP)" file={mayorFile} setFile={setMayorFile} id="file-mayor" />
      </div>

      <div style={{ background: '#f8f9fb', border: '1px solid #eee', borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>Saldos para Prueba de Conciliación (Opcional)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1565c0', marginBottom: 12 }}>BANCO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="number" placeholder="Saldo Inicial (Ej: 10000.50)" value={saldoIniExt} onChange={e => setSaldoIniExt(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, outline: 'none' }} />
              <input type="number" placeholder="Saldo Final" value={saldoFinExt} onChange={e => setSaldoFinExt(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, outline: 'none' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e65100', marginBottom: 12 }}>ERP (LIBRO MAYOR)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="number" placeholder="Saldo Inicial" value={saldoIniMay} onChange={e => setSaldoIniMay(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, outline: 'none' }} />
              <input type="number" placeholder="Saldo Final" value={saldoFinMay} onChange={e => setSaldoFinMay(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, outline: 'none' }} />
            </div>
          </div>
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13, marginBottom: 16, border: '1px solid #fecaca' }}>{error}</div>}

      <button
        onClick={handleUpload}
        disabled={loading}
        style={{
          width: '100%', padding: '13px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 15, fontWeight: 600, color: '#fff', background: loading ? '#999' : '#111',
          transition: 'all 0.15s',
        }}
      >
        {loading ? 'Procesando...' : 'Iniciar Conciliación'}
      </button>
    </div>
  );
}
