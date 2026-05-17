import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import './FormalSymbolsKeyboard.css';

const CATEGORIES = [
  { id: 'gram', label: 'Gramática', keys: ['ε', '→', '|', '⟶', '⇒'] },
  { id: 'sets', label: 'Conjuntos / lógica', keys: ['∅', '∪', '∩', '⊆', '∈', '∉', '∀', '∃'] },
  { id: 'deriv', label: 'Derivación', keys: ['⊢', '⊣', '⟹', '*', '⁺'] },
  { id: 'greek', label: 'Símbolos extra', keys: ['λ', 'α', 'β', 'γ', 'Σ', 'Γ', 'Δ', '∇'] },
  { id: 'delim', label: 'Delimitadores', keys: ['(', ')', '[', ']', '{', '}', '<', '>'] },
  { id: 'op', label: 'Operadores', keys: ['+', '-', '*', '/', '^', '=', '≠'] },
];

const KeyboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <line x1="6" y1="10" x2="6.01" y2="10" />
    <line x1="10" y1="10" x2="10.01" y2="10" />
    <line x1="14" y1="10" x2="14.01" y2="10" />
    <line x1="18" y1="10" x2="18.01" y2="10" />
    <line x1="7" y1="14" x2="17" y2="14" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
       style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms ease' }}
       aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * Teclado de símbolos formales — versión colapsable + tabs por categoría.
 *
 * Props:
 *   insertText: (snippet) => void
 *   activeTarget: 'grammar' | 'input'
 */
const FormalSymbolsKeyboard = ({ insertText, activeTarget = 'grammar' }) => {
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].id);

  const targetLabel = activeTarget === 'grammar' ? 'Gramática' : 'Entrada';
  const cat = CATEGORIES.find((c) => c.id === activeCat) || CATEGORIES[0];

  return (
    <div className={`formal-keyboard ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="formal-keyboard-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="formal-keyboard-toggle-left">
          <KeyboardIcon />
          <span>Insertar símbolo formal</span>
        </span>
        <span className="formal-keyboard-toggle-right">
          <span className="formal-keyboard-target small">
            → <strong>{targetLabel}</strong>
          </span>
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div className="formal-keyboard-body fade-in">
          <div className="formal-keyboard-tabs" role="tablist">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === activeCat}
                className={`formal-keyboard-tab ${c.id === activeCat ? 'active' : ''}`}
                onClick={() => setActiveCat(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="formal-keyboard-keys" role="tabpanel" aria-label={cat.label}>
            {cat.keys.map((k) => (
              <Button
                key={k}
                variant="outline-secondary"
                size="sm"
                className="formal-key-btn"
                type="button"
                title={`Insertar «${k}»`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertText(k)}
              >
                {k}
              </Button>
            ))}
          </div>

          <p className="formal-keyboard-hint">
            El backend acepta <code>-&gt;</code> o <code>→</code>; <code>ε</code> (o <code>λ</code>) para vacío.
          </p>
        </div>
      )}
    </div>
  );
};

export default FormalSymbolsKeyboard;
