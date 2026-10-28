import { Link, NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV_GROUPS } from '../../app/navigation';

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onNavigate }) {
  return (
    <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`} id="app-sidebar" aria-label="Primary">
      <Link to="/" className="sidebar__brand" onClick={onNavigate} title="PARALLAX · Talent Intelligence">
        <img
          src="/assets/parallax-icon.png"
          alt="PARALLAX"
          className="brand-logo-icon"
          width="32"
          height="32"
        />
        <div className="brand-text">
          <strong>PARALLAX</strong>
          <span>TALENT INTELLIGENCE</span>
        </div>
      </Link>
      <nav className="sidebar__nav" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-group__label">{group.label}</p>
            <ul>
              {group.items.map(({ to, label, icon: Icon, end, step }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className="nav-link"
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? label : undefined}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className="nav-link__label">{label}</span>
                    {step && (
                      <span className="nav-link__step" aria-hidden="true">
                        {step}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="sidebar__footer">
        <button
          type="button"
          className="collapse-btn"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          <span className="collapse-btn__label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
