import React, { useState, useEffect, useCallback } from 'react';
import { Accordion, Table, Badge, Row, Col } from 'react-bootstrap';
import AutomatonViewer from './AutomatonViewer';
import TraceStepper from './TraceStepper';
import LRMatrixTables from './LRMatrixTables';
import SyntaxTreeView from './SyntaxTreeView';
import IntelligentAssistantPanel from './IntelligentAssistantPanel';
import ExportPdfButton from './ExportPdfButton';
import ExportDotButton from './ExportDotButton';
import SectionBadge from './SectionBadge';
import { findParser } from '../context/ParserSelectionContext';
import './ParserResult.css';

const ParserResult = ({ result }) => {
  const [simStep, setSimStep] = useState(0);

  useEffect(() => {
    if (!result || result.compare || result.success === false) return;
    setSimStep(0);
  }, [result]);

  const onStepChange = useCallback((i) => {
    setSimStep(i);
  }, []);

  if (!result || result.success === false || result.compare) return null;

  const label = result.parser_label || result.parser || 'Parser';
  const family = result.parser_family || 'lr';

  const treeTitles =
    family === 'lr'
      ? {
          main: 'Árbol sintáctico (parse tree)',
          sub:
            'Estructura reconstruida en shift/reduce. Sirve como base de un AST; un AST “de compilador” suele simplificar operadores y tipos.',
          deriv: 'Árbol de derivación (referencia)',
          derivSub:
            'En ascenso LR la derivación es implícita (postorden de reducciones); el parse tree es la forma estándar de visualizar el análisis.',
        }
      : {
          main: 'Árbol de derivación (descenso)',
          sub: 'Derivación más a la izquierda según la tabla LL(1).',
          deriv: 'Vista AST estructural',
          derivSub:
            'Misma estructura que la derivación: un AST con semántica extra requeriría otra pasada (no implementada).',
        };

  const badgeColor = {
    shift: 'primary',
    reduce: 'warning',
    accept: 'success',
    error: 'danger',
    expand: 'info',
    match: 'primary',
    call: 'secondary',
    return: 'dark',
  };

  const fmtStack = (step) => {
    if (!step.stack) return '—';
    if (Array.isArray(step.stack)) return step.stack.join(' | ');
    return String(step.stack);
  };

  const treePrimary = result.parse_tree || result.derivation_tree;

  const simStepData = result.trace?.[simStep] || {};
  const stackTop = Array.isArray(simStepData.stack) && simStepData.stack.length
    ? simStepData.stack[simStepData.stack.length - 1]
    : null;
  const hlState =
    family === 'lr' && stackTop != null && Number.isFinite(Number(stackTop))
      ? Number(stackTop)
      : null;
  const hlSym =
    simStepData.shifted ??
    (Array.isArray(simStepData.remaining_input) && simStepData.remaining_input.length
      ? simStepData.remaining_input[0]
      : null);

  const renderTraceTable = () => (
    <Table striped bordered hover responsive className="fade-in">
      <thead>
        <tr>
          <th>#</th>
          <th>Tipo</th>
          <th>Acción</th>
          <th>Explicación</th>
          <th>Pila / contexto</th>
          <th>Entrada restante</th>
        </tr>
      </thead>
      <tbody>
        {result.trace.map((step, index) => (
          <tr key={index} className={index === simStep ? 'table-info' : ''}>
            <td>{index + 1}</td>
            <td>
              <Badge bg={badgeColor[step.type] || 'secondary'}>
                {(step.type || '?').toUpperCase()}
              </Badge>
            </td>
            <td>{step.action}</td>
            <td className="small">{step.explain || '—'}</td>
            <td>{fmtStack(step)}</td>
            <td>{(step.remaining_input || []).join(' ')}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );

  const renderTokens = () => (
    <ul className="list-group fade-in">
      {result.input_tokens.map((token, i) => (
        <li key={i} className="list-group-item">
          Token: <strong>{token}</strong>
        </li>
      ))}
    </ul>
  );

  const renderActionTable = () => (
    <Table striped bordered hover responsive size="sm" className="fade-in">
      <thead>
        <tr>
          <th>Estado</th>
          <th>Terminal</th>
          <th>Tipo</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(result.action_table || {}).map(([state, actions]) =>
          Object.entries(actions).map(([symbol, action], i) => (
            <tr key={`${state}-${symbol}-${i}`}>
              <td>{state}</td>
              <td>
                <code>{symbol}</code>
              </td>
              <td>
                <Badge bg={badgeColor[action.type] || 'secondary'}>{action.type}</Badge>
              </td>
              <td>{action.value ?? '—'}</td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );

  const renderGotoTable = () => (
    <Table striped bordered hover responsive size="sm" className="fade-in">
      <thead>
        <tr>
          <th>Estado</th>
          <th>No terminal</th>
          <th>Siguiente estado</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(result.goto_table || {}).map(([state, gotos]) =>
          Object.entries(gotos).map(([symbol, target], i) => (
            <tr key={`${state}-${symbol}-${i}`}>
              <td>{state}</td>
              <td>
                <code>{symbol}</code>
              </td>
              <td>{target}</td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );

  const renderParseTable = () => {
    const M = result.parse_table || {};
    const rows = [];
    Object.entries(M).forEach(([nt, cols]) => {
      Object.entries(cols).forEach(([term, cells]) => {
        cells.forEach((cell, i) => {
          rows.push(
            <tr key={`${nt}-${term}-${i}`}>
              <td>
                <code>{nt}</code>
              </td>
              <td>
                <code>{term}</code>
              </td>
              <td>{cell.rule_num}</td>
              <td>
                <code>
                  {cell.lhs} → {(cell.rhs || []).join(' ')}
                </code>
              </td>
            </tr>
          );
        });
      });
    });
    return (
      <Table striped bordered hover responsive size="sm" className="fade-in">
        <thead>
          <tr>
            <th>M[ no terminal ]</th>
            <th>Terminal</th>
            <th>Regla #</th>
            <th>Producción</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    );
  };

  const renderSets = (_title, data) => {
    if (!data || Object.keys(data).length === 0) {
      return <p className="text-muted small">Sin datos.</p>;
    }
    return (
      <Table striped bordered hover responsive size="sm" className="fade-in">
        <thead>
          <tr>
            <th>Símbolo</th>
            <th>Conjunto</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([sym, setv]) => (
            <tr key={sym}>
              <td>
                <code>{sym}</code>
              </td>
              <td>
                <code>{(setv || []).join(', ')}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  const renderConflicts = () => {
    const c = result.conflicts || [];
    if (!c.length) {
      return (
        <p className="text-muted small mb-0">
          Sin conflictos reportados en la construcción de tablas.
        </p>
      );
    }
    return (
      <ul className="list-group">
        {c.map((item, i) => (
          <li key={i} className="list-group-item list-group-item-warning">
            {typeof item === 'string' ? item : item.message || JSON.stringify(item)}
          </li>
        ))}
      </ul>
    );
  };

  const renderRules = () => (
    <Table striped bordered hover responsive size="sm" className="fade-in">
      <thead>
        <tr>
          <th>#</th>
          <th>Regla</th>
        </tr>
      </thead>
      <tbody>
        {result.grammar?.rules?.map((rule, i) => (
          <tr key={i}>
            <td>{rule.rule_num ?? i}</td>
            <td>
              <code>
                {typeof rule === 'string' ? rule : `${rule.lhs} → ${rule.rhs.join(' ')}`}
              </code>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );

  const parserMeta = findParser(result.parser);
  const familyTone = parserMeta.family === 'top-down' ? 'top-down' : 'bottom-up';
  const familyLabel = parserMeta.family === 'top-down' ? 'Top-Down' : 'Bottom-Up';

  return (
    <div className="parser-result fade-in">
      <div className="parser-result-header">
        <div className="parser-result-title-block">
          <SectionBadge tone="results" icon="✓">Resultados</SectionBadge>
          <h2 className="parser-result-title">
            {label}
            <SectionBadge tone={familyTone} className="ms-2">{familyLabel}</SectionBadge>
          </h2>
        </div>
        <div className="parser-result-actions">
          <ExportPdfButton result={result} />
        </div>
      </div>

      {result.valid ? (
        <div className="alert alert-success fade-in d-flex align-items-center gap-2" role="alert">
          <span aria-hidden="true">✓</span>
          <span><strong>Entrada aceptada</strong> · la cadena pertenece al lenguaje.</span>
        </div>
      ) : (
        <div className="alert alert-danger fade-in d-flex align-items-center gap-2" role="alert">
          <span aria-hidden="true">✗</span>
          <span><strong>Entrada rechazada</strong> · revisa el asistente para detalles.</span>
        </div>
      )}

      <IntelligentAssistantPanel assistant={result.intelligent_assistant} />

      <Row className="g-3 mb-4">
        <Col lg={6}>
          <SyntaxTreeView
            title={treeTitles.main}
            node={treePrimary}
            subtitle={treeTitles.sub}
            dot={result.dot_tree}
          />
        </Col>
        <Col lg={6}>
          <SyntaxTreeView
            title={treeTitles.deriv}
            node={treePrimary}
            subtitle={treeTitles.derivSub}
            dot={result.dot_tree}
          />
        </Col>
      </Row>
      {result.dot_tree && (
        <div className="d-flex justify-content-center mb-4">
          <ExportDotButton dot={result.dot_tree} filename={`arbol-${label}`} />
        </div>
      )}

      <Accordion defaultActiveKey="sim" flush alwaysOpen className="mt-4 parser-result-accordion">
        <Accordion.Item eventKey="sim">
          <Accordion.Header>📍 Simulación paso a paso y tablas dinámicas</Accordion.Header>
          <Accordion.Body>
            <TraceStepper trace={result.trace || []} onStepChange={onStepChange} />
            {family === 'lr' && result.action_table && (
              <LRMatrixTables
                actionTable={result.action_table}
                gotoTable={result.goto_table}
                highlightState={hlState}
                highlightSymbol={hlSym}
              />
            )}
            {family === 'topdown' && result.parse_table && (
              <p className="small text-muted mb-0">
                En LL(1) la tabla predictiva es la referencia principal; resalta mentalmente la fila del
                no terminal en la cima de la pila del paso actual.
              </p>
            )}
          </Accordion.Body>
        </Accordion.Item>

        <Accordion.Item eventKey="0">
          <Accordion.Header>📄 Reglas de la gramática</Accordion.Header>
          <Accordion.Body>{renderRules()}</Accordion.Body>
        </Accordion.Item>

        <Accordion.Item eventKey="1">
          <Accordion.Header>🔤 Tokens de entrada</Accordion.Header>
          <Accordion.Body>{renderTokens()}</Accordion.Body>
        </Accordion.Item>

        <Accordion.Item eventKey="2">
          <Accordion.Header>📜 Traza completa (todas las filas)</Accordion.Header>
          <Accordion.Body>{renderTraceTable()}</Accordion.Body>
        </Accordion.Item>

        {family === 'topdown' && (
          <>
            <Accordion.Item eventKey="td-sets">
              <Accordion.Header>🧮 FIRST / FOLLOW</Accordion.Header>
              <Accordion.Body>
                <h6>FIRST</h6>
                {renderSets('FIRST', result.first_sets)}
                <h6 className="mt-3">FOLLOW</h6>
                {renderSets('FOLLOW', result.follow_sets)}
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="td-table">
              <Accordion.Header>🗂️ Tabla predictiva M[A, a]</Accordion.Header>
              <Accordion.Body>{renderParseTable()}</Accordion.Body>
            </Accordion.Item>
          </>
        )}

        {family === 'lr' && (
          <>
            <Accordion.Item eventKey="3">
              <Accordion.Header>⚙️ Tabla ACTION (listado)</Accordion.Header>
              <Accordion.Body>{renderActionTable()}</Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="4">
              <Accordion.Header>🔁 Tabla GOTO (listado)</Accordion.Header>
              <Accordion.Body>{renderGotoTable()}</Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="lr-sets">
              <Accordion.Header>🧮 FIRST {result.follow_sets ? '/ FOLLOW' : ''}</Accordion.Header>
              <Accordion.Body>
                <h6>FIRST</h6>
                {renderSets('FIRST', result.first_sets)}
                {result.follow_sets && (
                  <>
                    <h6 className="mt-3">FOLLOW</h6>
                    {renderSets('FOLLOW', result.follow_sets)}
                  </>
                )}
              </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="5">
              <Accordion.Header>📊 Autómata LR (Graphviz)</Accordion.Header>
              <Accordion.Body>
                <AutomatonViewer
                  states={result.states}
                  transitions={result.transitions}
                  actionTable={result.action_table}
                  gotoTable={result.goto_table}
                  title={`Autómata ${label}`}
                  dot={result.dot_automaton}
                />
                {result.dot_automaton && (
                  <div className="d-flex justify-content-end mt-3">
                    <ExportDotButton
                      dot={result.dot_automaton}
                      filename={`automata-${label}`}
                    />
                  </div>
                )}
              </Accordion.Body>
            </Accordion.Item>
          </>
        )}

        <Accordion.Item eventKey="conf">
          <Accordion.Header>⚠️ Conflictos / advertencias de tablas</Accordion.Header>
          <Accordion.Body>{renderConflicts()}</Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </div>
  );
};

export default ParserResult;
