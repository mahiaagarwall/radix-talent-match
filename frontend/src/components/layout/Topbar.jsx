import { Link, useLocation } from 'react-router-dom';
import { Menu, ChevronRight, FlaskConical, Server } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { titleForPath, sectionForPath } from '../../app/navigation';
import { initials } from '../../utils/format';
import { GlobalSearch } from './GlobalSearch';
import { IconButton } from '../ui/Button';

export function Topbar({ onOpenMenu, menuOpen }) {
  const { pathname } = useLocation();
  const { mode, activeProfile } = useAppData();
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
        <Link to="/">RADIX</Link>
        <ChevronRight size={14} aria-hidden="true" />
        {section && (
          <>
            <Link to={section.to}>{section.label}</Link>
            <ChevronRight size={14} aria-hidden="true" />
          </>
        )}
        <span className="breadcrumb__current" aria-current="page">
          {section ? 'Details' : titleForPath(pathname)}
        </span>
      </nav>
      <div className="topbar__spacer" />
      <GlobalSearch />
      <div className="topbar__right">
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
