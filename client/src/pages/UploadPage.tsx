import React, { useState, useEffect } from 'react';
import { uploadConciliacion, getBanks } from '../api';
import { UploadCloud, FileSpreadsheet, Building2 } from 'lucide-react';
import { BankMetadata } from '../../../server/src/shared/types'; // Import for typing only

interface Props {
  onComplete: (id: string) => void;
}

export function UploadPage({ onComplete }: Props) {
  const [extractoFile, setExtractoFile] = useState<File | null>(null);
  const [mayorFile, setMayorFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState('');
  const [banks, setBanks] = useState<BankMetadata[]>([]);
  const [bankName, setBankName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [saldoIniExt, setSaldoIniExt] = useState('');
  const [saldoFinExt, setSaldoFinExt] = useState('');
  const [saldoIniMay, setSaldoIniMay] = useState('');
  const [saldoFinMay, setSaldoFinMay] = useState('');

  useEffect(() => {
    getBanks().then((data) => {
      setBanks(data);
      if (data.length > 0) setBankName(data[0].value);
    }).catch(e => console.error('Error fetching banks:', e));
  }, []);

  const banco = banks.find((b) => b.value === bankName) || banks[0];

  const handleBancoChange = (val: string) => {
    setBankName(val);
    // Limpiar archivos al cambiar de banco (distintos formatos)
    setExtractoFile(null);
    setMayorFile(null);
  };

  const handleUpload = async () => {
    if (!extractoFile || !mayorFile) { setError('Seleccioná ambos archivos'); return; }
    setLoading(true); setError('');
    try {
      const result = await uploadConciliacion(
        extractoFile, mayorFile,
        nombre || `${banco.label} — ${new Date().toLocaleDateString('es-AR')}`,
        bankName,
        {
          saldo_inicial_extracto: saldoIniExt,
          saldo_final_extracto: saldoFinExt,
          saldo_inicial_mayor: saldoIniMay,
          saldo_final_mayor: saldoFinMay,
        }
      );
      onComplete(result.id);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const acceptFormats = banco?.acceptFormats || '.csv,.xlsx';

  const DropZone = ({ label, file, setFile, id }: { label: string; file: File | null; setFile: (f: File | null) => void; id: string; }) => (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      <div
        onClick={() => document.getElementById(id)?.click()}
        style={{
          border: '2px dashed #e5e7eb', borderRadius: 12, padding: 32, textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.2s ease', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: file ? '#f0fdf4' : '#fff', borderColor: file ? '#86efac' : '#e5e7eb',
        }}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = file ? '#86efac' : '#e5e7eb'; e.currentTarget.style.background = file ? '#f0fdf4' : '#fff'; }}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = file ? '#86efac' : '#e5e7eb'; e.currentTarget.style.background = file ? '#f0fdf4' : '#fff'; const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
        onMouseOver={(e) => { if (!file) e.currentTarget.style.borderColor = '#9ca3af'; }}
        onMouseOut={(e) => { if (!file) e.currentTarget.style.borderColor = '#e5e7eb'; }}
      >
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'column' }}>
            <FileSpreadsheet size={32} color="#15803d" strokeWidth={1.5} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{file.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{(file.size / 1024).toFixed(0)} KB</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#9ca3af' }}>
            <UploadCloud size={36} strokeWidth={1.5} />
            <div style={{ fontSize: 14, color: '#6b7280' }}>Arrastrá el archivo o haz clic para seleccionar</div>
          </div>
        )}
        <input id={id} type="file" accept={acceptFormats} hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: 48 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 4 }}>Nueva Conciliación</h2>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>Seleccioná el banco, subí el extracto y el libro mayor para empezar</p>

      {/* Selector de banco */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <Building2 size={12} style={{ display: 'inline', marginRight: 4 }} />
          Banco / Proveedor
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {banks.map((b) => (
            <button
              key={b.value}
              onClick={() => handleBancoChange(b.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 18px', borderRadius: 10,
                border: bankName === b.value ? '2px solid #111' : '2px solid #e5e7eb',
                background: bankName === b.value ? '#111' : '#fff',
                color: bankName === b.value ? '#fff' : '#374151',
                cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 600, fontSize: 14,
                transition: 'all 0.2s ease',
                boxShadow: bankName === b.value ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              <span style={{ fontSize: 22 }}>{b.icon}</span>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre</label>
        <input
          type="text" placeholder={`${banco.label} — ${new Date().toLocaleDateString('es-AR')}`}
          value={nombre} onChange={(e) => setNombre(e.target.value)}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <DropZone label={banco.extractoLabel} file={extractoFile} setFile={setExtractoFile} id="file-extracto" />
        <DropZone label={banco.mayorLabel} file={mayorFile} setFile={setMayorFile} id="file-mayor" />
      </div>

      <div style={{ background: '#f8f9fb', border: '1px solid #eee', borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: 0 }}>Saldos para Prueba de Conciliación (Opcional)</h3>
          <span style={{ fontSize: 11, color: '#888', background: '#fff', padding: '4px 8px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            ✨ Se autodetectan si se dejan en blanco
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1565c0', marginBottom: 12 }}>{banco?.label.toUpperCase()}</div>
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
        onMouseOver={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(17,17,17,0.15)'; }}
        onMouseOut={(e) => { if (!loading) e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
        style={{
          width: '100%', padding: '14px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 15, fontWeight: 600, color: '#fff', background: loading ? '#9ca3af' : '#111',
          transition: 'all 0.2s ease',
        }}
      >
        {loading ? 'Procesando...' : 'Iniciar Conciliación'}
      </button>
    </div>
  );
}
