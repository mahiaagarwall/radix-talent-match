import { Link, useLocation } from 'react-router-dom';
import { Menu, ChevronRight, FlaskConical, Server, Sun, Moon } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { detailLabelForPath, sectionForPath } from '../../app/navigation';
import { initials } from '../../utils/format';
import { GlobalSearch } from './GlobalSearch';
import { IconButton } from '../ui/Button';

export function Topbar({ onOpenMenu, menuOpen }) {
  const { pathname } = useLocation();
  const { mode, activeProfile } = useAppData();
  const { toggleTheme, isDark } = useTheme();
  const section = sectionForPath(pathname);

  return (
    <header className="topbar">
      <IconButton
        icon={Menu}
        label="Open navigation"
        className="topbar__menu"
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
      />
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">PARALLAX</Link>
        <ChevronRight size={14} aria-hidden="true" />
        {section && (
          <>
            <Link to={section.to}>{section.label}</Link>
            <ChevronRight size={14} aria-hidden="true" />
          </>
        )}
        <span className="breadcrumb__current" aria-current="page">
          {detailLabelForPath(pathname)}
        </span>
      </nav>
      <div className="topbar__spacer" />
      <GlobalSearch />
      <div className="topbar__right">
        <IconButton
          icon={isDark ? Sun : Moon}
          label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        />
        <Link
          to="/settings"
          className={`badge mode-badge ${mode === 'demo' ? 'badge--demo' : 'badge--indigo'}`}
          title={mode === 'demo' ? 'Demo mode — local data and fixtures. Open settings.' : 'API mode — FastAPI backend. Open settings.'}
        >
          {mode === 'demo' ? <FlaskConical size={12} aria-hidden="true" /> : <Server size={12} aria-hidden="true" />}
          <span className="mode-badge__label">{mode === 'demo' ? 'Demo mode' : 'API mode'}</span>
        </Link>
        {activeProfile && (
          <Link
            to={`/profile-builder/${activeProfile.profile_id}`}
            className="context-chip"
            title={`Active candidate: ${activeProfile.name}`}
            aria-label={`Active candidate: ${activeProfile.name}`}
          >
            <span className="avatar" aria-hidden="true">
              {initials(activeProfile.name)}
            </span>
            <span className="context-chip__name">{activeProfile.name}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
