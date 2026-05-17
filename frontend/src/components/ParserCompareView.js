import React from 'react';
import { Card, Badge } from 'react-bootstrap';
import SyntaxTreeView from './SyntaxTreeView';
import IntelligentAssistantPanel from './IntelligentAssistantPanel';
import ExportPdfButton from './ExportPdfButton';
import SectionBadge from './SectionBadge';
import './ParserCompareView.css';

const StatBox = ({ label, value, tone = 'neutral' }) => (
  <div className={`compare-stat tone-${tone}`}>
    <div className="compare-stat-label">{label}</div>
    <div className="compare-stat-value">{value}</div>
  </div>
);

const Pane = ({ data, label }) => {
  if (!data) return null;
  const conflicts = data.conflicts?.length ?? 0;
  const traceLen = data.trace?.length ?? 0;
  return (
    <Card className="compare-pane h-100">
      <Card.Header className="compare-pane-header">
        <div className="compare-pane-title">
          <SectionBadge tone={data.parser_family === 'lr' ? 'bottom-up' : 'top-down'}>
            {data.parser_family === 'lr' ? 'Bottom-Up' : 'Top-Down'}
          </SectionBadge>
          <h3 className="compare-pane-name">{label}</h3>
        </div>
        <Badge bg={data.valid ? 'success' : 'danger'} className="compare-pane-verdict">
          {data.valid ? 'Aceptada' : 'Rechazada'}
        </Badge>
      </Card.Header>
      <Card.Body>
        <div className="compare-pane-stats">
          <StatBox label="Pasos en traza" value={traceLen} />
          <StatBox
            label="Conflictos de tabla"
            value={conflicts}
            tone={conflicts > 0 ? 'warning' : 'success'}
          />
        </div>
        <SyntaxTreeView
          title="Árbol"
          node={data.parse_tree || data.derivation_tree}
          subtitle={
            data.parser_family === 'lr' ? 'Parse tree (ascenso)' : 'Derivación (descenso)'
          }
          dot={data.dot_tree}
        />
      </Card.Body>
    </Card>
  );
};

const DiffBar = ({ left, right }) => {
  if (!left || !right) return null;
  const validMatch = left.valid === right.valid;
  const leftSteps = left.trace?.length ?? 0;
  const rightSteps = right.trace?.length ?? 0;
  const leftConflicts = left.conflicts?.length ?? 0;
  const rightConflicts = right.conflicts?.length ?? 0;
  const stepsDelta = leftSteps - rightSteps;

  return (
    <div className={`compare-diffbar ${validMatch ? 'match' : 'mismatch'}`}>
      <div className="compare-diffbar-item">
        <span className="compare-diffbar-label">Validez</span>
        <span className="compare-diffbar-value">
          {validMatch
            ? `Ambos ${left.valid ? 'aceptan' : 'rechazan'}`
            : `${left.parser_label || 'A'}: ${left.valid ? 'acepta' : 'rechaza'} · ${right.parser_label || 'B'}: ${right.valid ? 'acepta' : 'rechaza'}`}
        </span>
      </div>
      <div className="compare-diffbar-item">
        <span className="compare-diffbar-label">Pasos</span>
        <span className="compare-diffbar-value">
          {leftSteps} vs {rightSteps}
          {stepsDelta !== 0 && (
            <span className="compare-diffbar-delta">
              ({stepsDelta > 0 ? '+' : ''}{stepsDelta})
            </span>
          )}
        </span>
      </div>
      <div className="compare-diffbar-item">
        <span className="compare-diffbar-label">Conflictos</span>
        <span className="compare-diffbar-value">
          {leftConflicts} vs {rightConflicts}
        </span>
      </div>
    </div>
  );
};

const ParserCompareView = ({ left, right, leftLabel, rightLabel }) => (
  <div className="parser-compare-view fade-in">
    <div className="compare-header">
      <div>
        <SectionBadge tone="results" icon="⇄">Comparación</SectionBadge>
        <h2 className="compare-title">
          {leftLabel} <span className="compare-vs">vs</span> {rightLabel}
        </h2>
        <p className="compare-subtitle">
          Misma gramática y entrada. Las diferencias aparecen abajo.
        </p>
      </div>
      <ExportPdfButton
        compare
        left={left}
        right={right}
        leftLabel={leftLabel}
        rightLabel={rightLabel}
      />
    </div>

    <DiffBar left={left} right={right} />

    <div className="compare-split">
      <Pane data={left} label={leftLabel} />
      <Pane data={right} label={rightLabel} />
    </div>

    <div className="compare-assistants">
      <div>
        <h6 className="compare-assistant-title">Asistente — {leftLabel}</h6>
        <IntelligentAssistantPanel assistant={left?.intelligent_assistant} />
      </div>
      <div>
        <h6 className="compare-assistant-title">Asistente — {rightLabel}</h6>
        <IntelligentAssistantPanel assistant={right?.intelligent_assistant} />
      </div>
    </div>
  </div>
);

export default ParserCompareView;
