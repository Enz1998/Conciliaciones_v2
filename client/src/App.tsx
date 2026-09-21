import React, { useCallback, useState } from 'react';
import { UploadPage } from './pages/UploadPage';
import { ConciliacionPage } from './pages/ConciliacionPage';
import { ListPage } from './pages/ListPage';
import { FacturasListPage } from './pages/FacturasListPage';
import { FacturasUploadPage } from './pages/FacturasUploadPage';
import { FacturasConciliacionPage } from './pages/FacturasConciliacionPage';
import { FacturasProveedoresPage } from './pages/FacturasProveedoresPage';
import { PeriodSelector } from './components/PeriodSelector';
import { ToastProvider } from './components/ui/Toast';

type Page = 'list' | 'upload' | 'conciliacion' | 'facturas-list' | 'facturas-upload' | 'facturas-conciliacion' | 'facturas-proveedores';

export default function App() {
  const [page, setPage] = useState<Page>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [activeBank, setActiveBank] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<any | null>(null);

  const navigateTo = useCallback((p: Page, id?: string) => {
    setPage(p);
    setActiveId(id ?? null);
  }, []);

  const mainMargin = sidebarCollapsed ? 'ml-[68px]' : 'ml-[240px]';

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface text-slate-900 flex">

        {/* ── Sidebar: Full-Height Docked ── */}
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : 'expanded'}`}>

          {/* Brand */}
          <div
            className={`flex items-center gap-3 px-4 h-16 cursor-pointer shrink-0 border-b border-slate-100 ${sidebarCollapsed ? 'justify-center' : ''}`}
            onClick={() => navigateTo('list')}
          >
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }}>account_balance</span>
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-[13px] font-bold text-slate-950 tracking-tight whitespace-nowrap">Conciliación</p>
                <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider whitespace-nowrap">Fintech Enterprise</p>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-1 p-3 flex-grow overflow-y-auto scrollbar-hide">
            {!sidebarCollapsed && <p className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Bancos</p>}
            <NavItem icon="dashboard" label="Conciliaciones" active={page === 'list'} onClick={() => navigateTo('list')} collapsed={sidebarCollapsed} />
            <NavItem icon="upload_file" label="Nueva Conciliación" active={page === 'upload'} onClick={() => navigateTo('upload')} collapsed={sidebarCollapsed} />

            <div className="my-2 border-t border-slate-100" />

            {!sidebarCollapsed && <p className="px-2.5 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Facturación AFIP</p>}
            <NavItem icon="receipt_long" label="AFIP vs ERP" active={page === 'facturas-list'} onClick={() => navigateTo('facturas-list')} collapsed={sidebarCollapsed} />
            <NavItem icon="upload_file" label="Nueva Conciliación" active={page === 'facturas-upload'} onClick={() => navigateTo('facturas-upload')} collapsed={sidebarCollapsed} />
            <NavItem icon="groups" label="Proveedores" active={page === 'facturas-proveedores'} onClick={() => navigateTo('facturas-proveedores')} collapsed={sidebarCollapsed} />
          </nav>

          {/* Collapse toggle */}
          <div className="p-3 border-t border-slate-100 shrink-0">
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100/70 transition-all duration-150 ${sidebarCollapsed ? 'justify-center' : ''}`}
              title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
            >
              <span
                className="material-symbols-outlined text-[18px] transition-transform duration-300"
                style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                chevron_left
              </span>
              {!sidebarCollapsed && <span className="text-[12px] font-semibold whitespace-nowrap">Colapsar</span>}
            </button>
          </div>
        </aside>

        {/* ── Content Workspace ── */}
        <div className={`flex-1 ${mainMargin} transition-[margin] duration-[200ms] ease-[cubic-bezier(0.2,0,0,1)] flex flex-col min-w-0 min-h-screen`}>
          
          {/* Top Bar / Period Selector */}
          {(page === 'list' || page === 'upload' || page === 'conciliacion') && (
            <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-8 py-3 flex items-center justify-between">
              <PeriodSelector
                activePeriod={activePeriod}
                setActivePeriod={setActivePeriod}
              />
              <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span>Sistema en línea</span>
              </div>
            </header>
          )}

          {/* Main View Area */}
          <main className="p-8 max-w-[1560px] w-full mx-auto flex-1">
            <div className="animate-fade-in" key={page}>
              {page === 'list' && (
                <ListPage
                  onSelect={(id) => navigateTo('conciliacion', id)}
                  onNew={() => navigateTo('upload')}
                  activePeriod={activePeriod}
                  setActivePeriod={setActivePeriod}
                />
              )}
              {page === 'upload' && (
                <UploadPage onComplete={(id) => navigateTo('conciliacion', id)} activePeriod={activePeriod} />
              )}
              {page === 'conciliacion' && activeId && (
                <ConciliacionPage id={activeId} onBack={() => navigateTo('list')} />
              )}
              {page === 'facturas-list' && (
                <FacturasListPage
                  onSelect={(id) => navigateTo('facturas-conciliacion', id)}
                  onNew={() => navigateTo('facturas-upload')}
                />
              )}
              {page === 'facturas-upload' && (
                <FacturasUploadPage onComplete={(id) => navigateTo('facturas-conciliacion', id)} onGoToProveedores={() => navigateTo('facturas-proveedores')} />
              )}
              {page === 'facturas-conciliacion' && activeId && (
                <FacturasConciliacionPage id={activeId} onBack={() => navigateTo('facturas-list')} />
              )}
              {page === 'facturas-proveedores' && (
                <FacturasProveedoresPage />
              )}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: {
  icon: string; label: string; active: boolean; onClick: () => void; collapsed: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 text-left
        ${collapsed ? 'justify-center px-0' : ''}
        ${active
          ? 'bg-slate-900 text-white font-semibold shadow-xs'
          : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-950 font-medium'
        }
      `}
    >
      <span className="material-symbols-outlined text-[18px] shrink-0">{icon}</span>
      {!collapsed && <span className="text-[12px] whitespace-nowrap">{label}</span>}
    </button>
  );
}
