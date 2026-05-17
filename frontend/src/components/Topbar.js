import React from 'react';
import ThemeToggle from './ThemeToggle';
import SectionBadge from './SectionBadge';
import { findParser, useParserSelection } from '../context/ParserSelectionContext';
import './Topbar.css';

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const Topbar = ({ onToggleSidebar }) => {
  const { parser, parserB, compareMode } = useParserSelection();
  const current = findParser(parser);
  const second = compareMode ? findParser(parserB) : null;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Abrir menú lateral"
        >
          <MenuIcon />
        </button>
        <nav className="topbar-breadcrumb" aria-label="Ubicación">
          <span className="breadcrumb-home">Inicio</span>
          <span className="breadcrumb-sep" aria-hidden="true">›</span>
          <span className="breadcrumb-current">
            {current.label}
            <SectionBadge
              tone={current.family === 'top-down' ? 'top-down' : 'bottom-up'}
              className="ms-2"
            >
              {current.family === 'top-down' ? 'Top-Down' : 'Bottom-Up'}
            </SectionBadge>
          </span>
          {second && (
            <>
              <span className="breadcrumb-sep" aria-hidden="true">vs</span>
              <span className="breadcrumb-current">
                {second.label}
                <SectionBadge
                  tone={second.family === 'top-down' ? 'top-down' : 'bottom-up'}
                  className="ms-2"
                >
                  {second.family === 'top-down' ? 'Top-Down' : 'Bottom-Up'}
                </SectionBadge>
              </span>
            </>
          )}
        </nav>
      </div>

      <div className="topbar-right">
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Topbar;
