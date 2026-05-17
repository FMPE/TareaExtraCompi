import React, { useMemo, useState } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import GraphvizRenderer from './GraphvizRenderer';
import { buildTreeDot } from '../utils/buildDot';
import './SyntaxTreeView.css';

const kindClass = (kind) => {
  if (kind === 'terminal') return 'tree-terminal';
  if (kind === 'epsilon') return 'tree-epsilon';
  return 'tree-nonterminal';
};

const TreeNodeText = ({ node, depth = 0 }) => {
  if (!node) return null;
  const k = node.kind || 'nonterminal';
  const label = node.label ?? '?';
  const pad = { paddingLeft: `${Math.min(depth, 12) * 14}px` };

  if (k === 'terminal') {
    return (
      <div className="tree-line" style={pad}>
        <span className={kindClass(k)}>{label}</span>
        {node.lexeme && node.lexeme !== label && (
          <span className="tree-lexeme text-muted"> «{node.lexeme}»</span>
        )}
      </div>
    );
  }

  if (k === 'epsilon') {
    return (
      <div className="tree-line" style={pad}>
        <span className={kindClass(k)}>ε</span>
      </div>
    );
  }

  return (
    <div className="tree-subtree">
      <div className="tree-line tree-parent" style={pad}>
        <span className={kindClass(k)}>{label}</span>
        {node.rule_num != null && node.rule_num >= 0 && (
          <span className="tree-rule text-muted"> (regla {node.rule_num})</span>
        )}
      </div>
      {(node.children || []).map((ch, i) => (
        <TreeNodeText key={i} node={ch} depth={depth + 1} />
      ))}
    </div>
  );
};

/**
 * Renderiza el árbol como diagrama Graphviz (default) o como lista anidada (toggle).
 *
 * Props:
 *   title    - encabezado
 *   node     - raíz del árbol (objeto anidado del backend)
 *   subtitle - texto aclaratorio
 *   dot      - opcional; si viene del backend (result.dot_tree) se usa directo
 */
const SyntaxTreeView = ({ title, node, subtitle, dot }) => {
  const [mode, setMode] = useState('diagram'); // 'diagram' | 'list'

  const finalDot = useMemo(() => dot || buildTreeDot(node), [dot, node]);

  if (!node) {
    return (
      <div className="syntax-tree-view border rounded p-3 bg-light">
        <h6 className="mb-2">{title}</h6>
        <p className="text-muted small mb-0">No hay árbol disponible (análisis fallido o sin datos).</p>
      </div>
    );
  }

  return (
    <div className="syntax-tree-view border rounded p-3">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
        <div>
          <h6 className="mb-1">{title}</h6>
          {subtitle && <p className="text-muted small mb-0">{subtitle}</p>}
        </div>
        <ButtonGroup size="sm">
          <Button
            variant={mode === 'diagram' ? 'primary' : 'outline-primary'}
            onClick={() => setMode('diagram')}
          >
            Diagrama
          </Button>
          <Button
            variant={mode === 'list' ? 'primary' : 'outline-primary'}
            onClick={() => setMode('list')}
          >
            Lista
          </Button>
        </ButtonGroup>
      </div>

      {mode === 'diagram' ? (
        <div className="tree-diagram-container">
          <GraphvizRenderer dot={finalDot} minHeight={320} />
        </div>
      ) : (
        <div className="tree-root border-start border-2 border-primary ps-2">
          <TreeNodeText node={node} depth={0} />
        </div>
      )}
    </div>
  );
};

export default SyntaxTreeView;
