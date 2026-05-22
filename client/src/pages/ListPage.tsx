import React, { useEffect, useState } from 'react';
import { listConciliaciones, deleteConciliacion } from '../api';

interface Props {
  onSelect: (id: string) => void;
}

export function ListPage({ onSelect }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = () => {
    setLoading(true);
    listConciliaciones()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Estás seguro de eliminar esta conciliación? Esta acción no se puede deshacer.')) return;
    try {
      await deleteConciliacion(id);
      fetchItems();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: '#888', fontSize: 14 }}>Cargando...</div>;

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#333', marginBottom: 6 }}>No hay conciliaciones</h3>
        <p style={{ color: '#888', fontSize: 14 }}>Subí tu primer extracto y libro mayor desde <b>+ Nueva</b> en la barra lateral.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: '0 0 24px' }}>Conciliaciones</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              background: '#fff', borderRadius: 10, padding: '20px 24px',
              border: '1px solid #eee', cursor: 'pointer',
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            <button
              onClick={(e) => handleDelete(item.id, e)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 16, padding: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', transition: 'background 0.2s',
              }}
              title="Eliminar conciliación"
              onMouseOver={(e) => (e.currentTarget.style.background = '#fee2e2')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              🗑️
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingRight: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>{item.nombre}</h3>
              <span style={{
                padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                background: item.estado === 'COMPLETADA' ? '#ecfdf5' : '#fff7ed',
                color: item.estado === 'COMPLETADA' ? '#065f46' : '#c2410c',
              }}>
                {item.estado === 'COMPLETADA' ? 'Completada' : item.estado}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
              {new Date(item.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#aaa' }}>
              <span>🏦 {item.extracto_filename || '—'}</span>
              <span>📊 {item.mayor_filename || '—'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
