import React, { useMemo } from 'react';
import { lintGrammar } from '../utils/grammarLinter';
import './GrammarLinter.css';

const SEVERITY_ICON = {
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const SEVERITY_LABEL = {
  error: 'Error',
  warning: 'Advertencia',
  info: 'Sugerencia',
};

const MAX_HINTS = 10;

const GrammarLinter = ({ grammar, family = 'lr' }) => {
  const hints = useMemo(
    () => lintGrammar(grammar, { topDown: family === 'topdown' }),
    [grammar, family]
  );

  if (!hints || hints.length === 0) return null;

  const counts = hints.reduce(
    (acc, h) => {
      acc[h.severity] = (acc[h.severity] || 0) + 1;
      return acc;
    },
    { error: 0, warning: 0, info: 0 }
  );

  const shown = hints.slice(0, MAX_HINTS);
  const remaining = hints.length - shown.length;

  return (
    <div className="grammar-linter" role="status" aria-live="polite">
      <div className="grammar-linter-header">
        <span className="grammar-linter-title">Validación de gramática</span>
        <div className="grammar-linter-counts">
          {counts.error > 0 && (
            <span className="lint-count severity-error">
              {SEVERITY_ICON.error} {counts.error}
            </span>
          )}
          {counts.warning > 0 && (
            <span className="lint-count severity-warning">
              {SEVERITY_ICON.warning} {counts.warning}
            </span>
          )}
          {counts.info > 0 && (
            <span className="lint-count severity-info">
              {SEVERITY_ICON.info} {counts.info}
            </span>
          )}
        </div>
      </div>
      <ul className="grammar-linter-list">
        {shown.map((h, i) => (
          <li key={i} className={`lint-item severity-${h.severity}`}>
            <span
              className={`lint-icon severity-${h.severity}`}
              aria-label={SEVERITY_LABEL[h.severity]}
            >
              {SEVERITY_ICON[h.severity]}
            </span>
            <span className="lint-message">{h.message}</span>
            {h.line && <span className="lint-line-chip">L{h.line}</span>}
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <div className="grammar-linter-more">+{remaining} pista(s) más…</div>
      )}
    </div>
  );
};

export default GrammarLinter;
