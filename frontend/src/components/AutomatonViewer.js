import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Button, Card } from 'react-bootstrap';
import GraphvizRenderer from './GraphvizRenderer';
import { buildAutomatonDot } from '../utils/buildDot';
import './AutomatonViewer.css';

/**
 * Visualizador del autómata LR usando Graphviz.
 *
 * Props (compatibles con la versión SVG previa):
 *   states, transitions, actionTable, gotoTable, title
 *   dot         - opcional; si viene del backend (result.dot_automaton) se usa directo
 */
const AutomatonViewer = ({
  states,
  transitions,                       // eslint-disable-line no-unused-vars
  actionTable,
  gotoTable,
  title = 'Autómata LR',
  dot,
  minHeight = 580,
}) => {
  const rendererRef = useRef(null);
  const [selectedIdx, setSelectedIdx] = useState(null);

  const finalDot = useMemo(() => {
    if (dot) return dot;
    if (states && states.length > 0) return buildAutomatonDot(states, actionTable, gotoTable);
    return '';
  }, [dot, states, actionTable, gotoTable]);

  // GraphvizRenderer pasa el id del <g class="node"> (p.ej. "state-3")
  const handleNodeClick = useCallback((id) => {
    if (!id || !id.startsWith('state-')) {
      setSelectedIdx(null);
      return;
    }
    const idx = parseInt(id.slice('state-'.length), 10);
    setSelectedIdx(Number.isNaN(idx) ? null : idx);
  }, []);

  const selectedState =
    selectedIdx != null && Array.isArray(states)
      ? states.find((s) => s.state_num === selectedIdx)
      : null;

  if (!finalDot) {
    return (
      <div className="alert alert-info mb-0">
        <h5>{title}</h5>
        <p className="mb-0">No hay grafo disponible para mostrar.</p>
      </div>
    );
  }

  const hasStates = Array.isArray(states) && states.length > 0;

  return (
    <div className="automaton-viewer">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 className="mb-0">{title}</h5>
            <small className="text-muted">
              Layout automático (Graphviz). Scroll: zoom · arrastrar: pan · click en nodo: detalles.
            </small>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" size="sm" onClick={() => rendererRef.current?.zoomOut()}>−</Button>
            <Button variant="outline-secondary" size="sm" onClick={() => rendererRef.current?.zoomIn()}>+</Button>
            <Button variant="outline-secondary" size="sm" onClick={() => rendererRef.current?.reset()}>
              Vista completa
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0 position-relative">
          <div className="automaton-container" style={{ position: 'relative' }}>
            <GraphvizRenderer
              ref={rendererRef}
              dot={finalDot}
              onNodeClick={hasStates ? handleNodeClick : undefined}
              minHeight={minHeight}
            />
            {hasStates && selectedState && (
              <div className="state-details">
                <h6>
                  Estado I{selectedState.state_num} — {selectedState.items?.length || 0} ítem(s)
                </h6>
                <div className="items-list">
                  {selectedState.items?.map((item, i) => (
                    <div key={i} className="item-detail">
                      <code>{item.display}</code>
                    </div>
                  ))}
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 mt-2"
                  onClick={() => setSelectedIdx(null)}
                >
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default AutomatonViewer;
