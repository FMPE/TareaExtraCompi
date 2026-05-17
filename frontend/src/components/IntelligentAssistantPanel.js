import React from 'react';
import { Accordion, ListGroup, Badge } from 'react-bootstrap';
import './IntelligentAssistantPanel.css';

/**
 * Muestra el bloque `intelligent_assistant` devuelto por el backend.
 */
const IntelligentAssistantPanel = ({ assistant }) => {
  if (!assistant) {
    return null;
  }

  const {
    mode,
    mode_description,
    error_natural_language,
    error_detail_bullets,
    ambiguity_recommendations,
    ll1_transformation_suggestions,
    testing_hints,
  } = assistant;

  return (
    <Accordion className="intelligent-assistant mb-4" defaultActiveKey="ia-0">
      <Accordion.Item eventKey="ia-0">
        <Accordion.Header>
          Asistente inteligente{' '}
          <Badge bg="info" text="dark" className="ms-2">
            {mode === 'heuristic' ? 'Heurístico' : mode}
          </Badge>
        </Accordion.Header>
        <Accordion.Body>
          {mode_description && (
            <p className="small text-muted border-bottom pb-2 mb-3">{mode_description}</p>
          )}

          <h6 className="text-primary">Explicación de errores (lenguaje natural)</h6>
          <p className="assistant-nl">{error_natural_language || '—'}</p>
          {error_detail_bullets?.length > 0 && (
            <ListGroup variant="flush" className="mb-3 small">
              {error_detail_bullets.map((b, i) => (
                <ListGroup.Item key={i}>{b}</ListGroup.Item>
              ))}
            </ListGroup>
          )}

          <h6 className="text-warning mt-3">Recomendaciones ante ambigüedad / conflictos</h6>
          {ambiguity_recommendations?.length ? (
            <ListGroup variant="flush" className="mb-3 small">
              {ambiguity_recommendations.map((t, i) => (
                <ListGroup.Item key={i}>{t}</ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <p className="small text-muted">Sin recomendaciones adicionales.</p>
          )}

          <h6 className="text-success mt-3">Sugerencias de transformación hacia LL(1)</h6>
          {ll1_transformation_suggestions?.length ? (
            <ListGroup variant="flush" className="mb-3 small">
              {ll1_transformation_suggestions.map((s, i) => (
                <ListGroup.Item key={i}>
                  <Badge bg="light" text="dark" className="me-2">
                    {s.type || 'sugerencia'}
                  </Badge>
                  {s.text || JSON.stringify(s)}
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <p className="small text-muted">Sin sugerencias estructurales.</p>
          )}

          <h6 className="text-secondary mt-3">Depuración y pruebas</h6>
          {testing_hints?.length ? (
            <ListGroup variant="flush" className="small mb-3">
              {testing_hints.map((t, i) => (
                <ListGroup.Item key={i}>{t}</ListGroup.Item>
              ))}
            </ListGroup>
          ) : null}
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
};

export default IntelligentAssistantPanel;
