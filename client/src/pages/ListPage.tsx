import React, { useEffect, useState } from 'react';
import { listConciliaciones, deleteConciliacion } from '../api';
import { Trash2, Inbox, Building2, Database } from 'lucide-react';

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
      <div style={{ textAlign: 'center', padding: '120px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <Inbox size={56} strokeWidth={1} color="#9ca3af" />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 8 }}>No hay conciliaciones</h3>
        <p style={{ color: '#6b7280', fontSize: 15 }}>Crea tu primera conciliación desde <b>Nueva</b> en el menú.</p>
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
              background: '#fff', borderRadius: 12, padding: '24px',
              border: '1px solid #f0f0f0', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
            onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)'; e.currentTarget.style.transform = 'none'; }}
          >
            <button
              onClick={(e) => handleDelete(item.id, e)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#d1d5db', padding: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', transition: 'all 0.2s ease',
              }}
              title="Eliminar conciliación"
              onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#d1d5db'; }}
            >
              <Trash2 size={16} />
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingRight: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111', margin: 0, lineHeight: 1.3 }}>{item.nombre}</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                background: item.estado === 'COMPLETADA' ? '#f0fdf4' : '#fff7ed',
                color: item.estado === 'COMPLETADA' ? '#166534' : '#c2410c',
                border: `1px solid ${item.estado === 'COMPLETADA' ? '#bbf7d0' : '#ffedd5'}`
              }}>
                {item.estado === 'COMPLETADA' ? 'Completada' : item.estado}
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                {new Date(item.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#6b7280', background: '#f8f9fb', padding: 12, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={14} color="#9ca3af" /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.extracto_filename || '—'}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Database size={14} color="#9ca3af" /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.mayor_filename || '—'}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
