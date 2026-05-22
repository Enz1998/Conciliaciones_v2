import React, { useState } from 'react';
import { UploadPage } from './pages/UploadPage';
import { ConciliacionPage } from './pages/ConciliacionPage';
import { ListPage } from './pages/ListPage';

type Page = 'list' | 'upload' | 'conciliacion';

const SIDEBAR_W = 240;

export default function App() {
  const [page, setPage] = useState<Page>('list');
  const [activeId, setActiveId] = useState<string | null>(null);

  const navigateTo = (p: Page, id?: string) => {
    setPage(p);
    if (id) {
      setActiveId(id);
    } else {
      setActiveId(null);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', sans-serif", background: '#f8f9fb' }}>
      {/* Sidebar */}
      <aside style={{
        width: SIDEBAR_W,
        background: '#fff',
        borderRight: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 0',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ padding: '0 24px', marginBottom: 40 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: '#111',
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer',
            letterSpacing: '-0.3px',
          }} onClick={() => navigateTo('list')}>
            <span style={{
              width: 34, height: 34, borderRadius: 10,
              background: '#111', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800,
            }}>CB</span>
            Conciliación
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 1, padding: '0 12px', marginBottom: 8 }}>
            Menú
          </div>
          <NavItem
            icon="📋"
            label="Conciliaciones"
            active={page === 'list'}
            onClick={() => navigateTo('list')}
          />
          <NavItem
            icon="＋"
            label="Nueva"
            active={page === 'upload'}
            onClick={() => navigateTo('upload')}
          />
        </nav>

        {/* Footer */}
        <div style={{ padding: '0 24px', fontSize: 11, color: '#aaa' }}>
          v1.0 — Neon + Vercel
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: SIDEBAR_W, flex: 1, padding: 32 }}>
        {page === 'list' && <ListPage onSelect={(id) => navigateTo('conciliacion', id)} />}
        {page === 'upload' && (
          <UploadPage onComplete={(id) => navigateTo('conciliacion', id)} />
        )}
        {page === 'conciliacion' && activeId && (
          <ConciliacionPage id={activeId} onBack={() => navigateTo('list')} />
        )}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: {
  icon: string; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '10px 12px', marginBottom: 2,
        borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: 500,
        background: active ? '#f0f0f5' : 'transparent',
        color: active ? '#111' : '#666',
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  );
}
