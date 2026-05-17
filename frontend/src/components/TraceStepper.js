import React, { useState, useEffect } from 'react';
import { Button, ButtonGroup, Card, Form, ProgressBar } from 'react-bootstrap';
import './TraceStepper.css';

const TraceStepper = ({ trace = [], onStepChange }) => {
  const [idx, setIdx] = useState(0);
  const max = Math.max(0, trace.length - 1);

  useEffect(() => {
    setIdx(0);
  }, [trace]);

  useEffect(() => {
    if (onStepChange) onStepChange(idx);
  }, [idx, onStepChange, trace]);

  const step = trace[idx] || {};
  const pct = trace.length ? ((idx + 1) / trace.length) * 100 : 0;

  return (
    <Card className="trace-stepper mb-3">
      <Card.Header className="py-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span className="fw-semibold">Simulación paso a paso</span>
        <ButtonGroup size="sm">
          <Button variant="outline-secondary" disabled={idx <= 0} onClick={() => setIdx(0)}>
            Inicio
          </Button>
          <Button variant="outline-primary" disabled={idx <= 0} onClick={() => setIdx((x) => x - 1)}>
            Anterior
          </Button>
          <Button variant="outline-primary" disabled={idx >= max} onClick={() => setIdx((x) => x + 1)}>
            Siguiente
          </Button>
          <Button variant="outline-secondary" disabled={idx >= max} onClick={() => setIdx(max)}>
            Fin
          </Button>
        </ButtonGroup>
      </Card.Header>
      <Card.Body>
        <Form.Range min={0} max={max} value={idx} onChange={(e) => setIdx(Number(e.target.value))} />
        <ProgressBar now={pct} className="mb-3" label={`Paso ${idx + 1} / ${trace.length || 1}`} />
        <div className="step-detail border rounded p-3 bg-light">
          <div className="mb-2">
            <strong>Tipo:</strong> <code>{(step.type || '—').toUpperCase()}</code>
          </div>
          <div className="mb-2">
            <strong>Acción:</strong> {step.action || '—'}
          </div>
          {step.explain && (
            <div className="mb-2 text-primary">
              <strong>Explicación:</strong> {step.explain}
            </div>
          )}
          <div className="small text-muted">
            <strong>Pila (estados o símbolos):</strong>{' '}
            {Array.isArray(step.stack) ? step.stack.join(' ') : String(step.stack ?? '—')}
          </div>
          <div className="small text-muted">
            <strong>Entrada restante:</strong> {(step.remaining_input || []).join(' ')}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default TraceStepper;
