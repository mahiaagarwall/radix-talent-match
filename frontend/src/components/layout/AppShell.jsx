import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { readJson, writeJson, KEYS } from '../../services/storage';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => readJson(KEYS.sidebar, false));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    document.getElementById('main-content')?.scrollTo?.(0, 0);
    window.scrollTo?.(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        writeJson(KEYS.sidebar, !c);
      } catch {
        /* preference only */
      }
      return !c;
    });
  };

  return (
    <div className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />
      {mobileOpen && <button type="button" className="drawer-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <div className="app-main">
        <Topbar onOpenMenu={() => setMobileOpen(true)} menuOpen={mobileOpen} />
        <main id="main-content" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
