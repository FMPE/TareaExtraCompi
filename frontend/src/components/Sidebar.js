import React from 'react';
import { Form } from 'react-bootstrap';
import { PARSER_OPTIONS, useParserSelection } from '../context/ParserSelectionContext';
import './Sidebar.css';

const FAMILY_GROUPS = [
  { id: 'top-down', label: 'Top-Down', subtitle: 'Descenso recursivo' },
  { id: 'bottom-up', label: 'Bottom-Up', subtitle: 'Ascenso por shift-reduce' },
];

const FAMILY_ICONS = {
  'top-down': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16M5 11l7 7 7-7" />
    </svg>
  ),
  'bottom-up': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V4M5 13l7-7 7 7" />
    </svg>
  ),
};

const ParserButton = ({ option, active, secondary, onClick }) => (
  <button
    type="button"
    className={`sidebar-parser-btn ${active ? 'active' : ''} ${secondary ? 'secondary' : ''}`}
    onClick={() => onClick(option.value)}
    aria-current={active ? 'page' : undefined}
  >
    <span className="sidebar-parser-label">{option.label}</span>
    {active && <span className="sidebar-parser-dot" aria-hidden="true" />}
    {secondary && <span className="sidebar-parser-secondary-tag">B</span>}
  </button>
);

const Sidebar = ({ open, onClose }) => {
  const { parser, setParser, parserB, setParserB, compareMode, setCompareMode } =
    useParserSelection();

  const handlePick = (value) => {
    setParser(value);
    if (typeof window !== 'undefined' && window.innerWidth < 992) onClose?.();
  };

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navegación de analizadores">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark" aria-hidden="true">⟁</span>
          <div>
            <div className="sidebar-brand-title">ParserLab</div>
            <div className="sidebar-brand-subtitle">Analizadores sintácticos</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {FAMILY_GROUPS.map((group) => (
          <section key={group.id} className="sidebar-group">
            <div className="sidebar-group-header">
              <span className={`sidebar-group-icon family-${group.id}`}>
                {FAMILY_ICONS[group.id]}
              </span>
              <div>
                <div className="sidebar-group-label">{group.label}</div>
                <div className="sidebar-group-subtitle">{group.subtitle}</div>
              </div>
            </div>
            <div className="sidebar-group-items">
              {PARSER_OPTIONS.filter((o) => o.family === group.id).map((opt) => (
                <ParserButton
                  key={opt.value}
                  option={opt}
                  active={parser === opt.value}
                  secondary={compareMode && parserB === opt.value && parser !== opt.value}
                  onClick={handlePick}
                />
              ))}
            </div>
          </section>
        ))}

        <section className="sidebar-group sidebar-config">
          <div className="sidebar-group-header">
            <div className="sidebar-group-label">Modo</div>
          </div>
          <div className="sidebar-toggle-row">
            <Form.Check
              type="switch"
              id="sidebar-compare-toggle"
              label="Modo comparación"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
            />
          </div>

          {compareMode && (
            <div className="sidebar-compare-pick">
              <label className="sidebar-compare-label">Segundo algoritmo</label>
              <select
                value={parserB}
                onChange={(e) => setParserB(e.target.value)}
                className="sidebar-compare-select"
                aria-label="Segundo parser para comparar"
              >
                {PARSER_OPTIONS.filter((o) => o.value !== parser).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} · {opt.family === 'top-down' ? 'Top-Down' : 'Bottom-Up'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>
      </nav>

      <div className="sidebar-footer">
        <small className="sidebar-footer-text">
          Demo · LR(0)/SLR/LALR/LR(1) · LL(1) · RD
        </small>
      </div>
    </aside>
  );
};

export default Sidebar;
