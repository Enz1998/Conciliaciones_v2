import React, { useState } from 'react';
import { UploadPage } from './pages/UploadPage';
import { ConciliacionPage } from './pages/ConciliacionPage';
import { ListPage } from './pages/ListPage';
import { LayoutDashboard, FilePlus, Hexagon } from 'lucide-react';

type Page = 'list' | 'upload' | 'conciliacion';

const SIDEBAR_W = 200;

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
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Outfit', sans-serif", background: '#f8f9fb' }}>
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
            fontSize: 16, fontWeight: 700, color: '#111',
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer',
            letterSpacing: '-0.3px',
          }} onClick={() => navigateTo('list')}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #111, #333)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}>
              <Hexagon size={18} strokeWidth={2.5} />
            </div>
            Conciliación
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, padding: '0 12px', marginBottom: 12 }}>
            Menú
          </div>
          <NavItem
            icon={<LayoutDashboard size={18} />}
            label="Conciliaciones"
            active={page === 'list'}
            onClick={() => navigateTo('list')}
          />
          <NavItem
            icon={<FilePlus size={18} />}
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
      <main style={{ marginLeft: SIDEBAR_W, flex: 1, padding: 24 }}>
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
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseOver={(e) => { if (!active) e.currentTarget.style.background = '#f4f5f7'; }}
      onMouseOut={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '10px 14px', marginBottom: 4,
        borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: 500,
        background: active ? '#fff' : 'transparent',
        boxShadow: active ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
        color: active ? '#111' : '#6b7280',
        transition: 'all 0.2s ease',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', color: active ? '#111' : '#9ca3af', transition: 'color 0.2s ease' }}>
        {icon}
      </div>
      {label}
    </button>
  );
}
