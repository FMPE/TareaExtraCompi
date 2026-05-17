import React from 'react';
import { useHistoryContext } from '../context/HistoryContext';
import { useParserSelection } from '../context/ParserSelectionContext';
import './HistoryPanel.css';

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const formatRelative = (ts) => {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'hace segundos';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
};

const truncate = (s, n = 40) => (s.length <= n ? s : `${s.slice(0, n)}…`);

const HistoryPanel = ({ onLoad }) => {
  const { entries, remove, clear } = useHistoryContext();
  const { setParser, setGrammar, setInput } = useParserSelection();

  const handleLoad = (entry) => {
    setParser(entry.parser);
    setGrammar(entry.grammar);
    setInput(entry.input);
    onLoad?.();
  };

  return (
    <section className="sidebar-group history-panel">
      <div className="sidebar-group-header history-panel-header">
        <div className="history-panel-title">
          <span className="sidebar-group-label">Historial</span>
          {entries.length > 0 && (
            <span className="history-panel-count">{entries.length}</span>
          )}
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            className="history-panel-clear"
            onClick={clear}
            title="Limpiar historial"
            aria-label="Limpiar historial"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="history-panel-empty">Aún sin análisis previos.</p>
      ) : (
        <ul className="history-panel-list">
          {entries.map((e) => (
            <li key={e.id} className="history-panel-item">
              <button
                type="button"
                className="history-panel-item-btn"
                onClick={() => handleLoad(e)}
                title={`Recargar: ${e.parserLabel} · ${truncate(e.input, 60)}`}
              >
                <span className={`history-dot ${e.valid ? 'ok' : 'fail'}`} aria-hidden="true" />
                <span className="history-item-content">
                  <span className="history-item-row">
                    <strong className="history-item-parser">{e.parserLabel}</strong>
                    <span className="history-item-time">{formatRelative(e.ts)}</span>
                  </span>
                  <span className="history-item-input">{truncate(e.input, 28)}</span>
                </span>
              </button>
              <button
                type="button"
                className="history-panel-remove"
                onClick={() => remove(e.id)}
                title="Eliminar"
                aria-label={`Eliminar entrada ${e.parserLabel}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default HistoryPanel;
