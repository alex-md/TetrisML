import React from 'react';
import { LucideIcon } from 'lucide-react';

export type NavRoute = {
  key: string;
  label: string;
  Icon: LucideIcon;
};

interface NavBarProps {
  routes: NavRoute[];
  currentRoute: string;
  onNavigate: (key: string) => void;
}

const NavBar: React.FC<NavBarProps> = ({ routes, currentRoute, onNavigate }) => {
  return (
    <nav className="glass-panel nav-shell rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="nav-logo" />
        <div>
          <div className="text-[10px] uppercase tracking-[0.45em] text-slate-500">TetrisML</div>
          <div className="text-sm font-semibold text-white">Evolution Suite</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        {routes.map(route => {
          const isActive = route.key === currentRoute;
          return (
            <button
              key={route.key}
              onClick={() => onNavigate(route.key)}
              className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
              type="button"
            >
              <route.Icon size={16} />
              <span>{route.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default NavBar;
