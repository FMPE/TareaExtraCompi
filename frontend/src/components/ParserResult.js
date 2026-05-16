import React from 'react';
import { Accordion, Table, Badge } from 'react-bootstrap';
import AutomatonViewer from './AutomatonViewer';
import './ParserResult.css';

const ParserResult = ({ result }) => {
  if (!result) return null;

  const parserType = result.parser_type || 'lr1';

  const parserNames = {
    recursive_descent: 'Descenso Recursivo',
    ll1: 'LL(1) Predictivo',
    lr1: 'LR(1)',
  };

  // --- Badge colors for trace types ---
  const badgeColor = {
    shift: 'primary',
    reduce: 'warning',
    accept: 'success',
    error: 'danger',
    match: 'info',
    predict: 'primary',
    enter: 'secondary',
    try_production: 'light',
    backtrack: 'danger',
    exit_success: 'success',
    exit_fail: 'danger',
    fail_match: 'warning',
  };

  // =====================================================================
  // Shared renderers
  // =====================================================================

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
                {typeof rule === 'string'
                  ? rule
                  : `${rule.lhs} → ${rule.rhs.join(' ')}`}
              </code>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );

  const renderTokens = () => (
    <ul className="list-group fade-in">
      {result.input_tokens?.map((token, i) => (
        <li key={i} className="list-group-item">
          Token: <strong>{token}</strong>
        </li>
      ))}
    </ul>
  );

  // =====================================================================
  // LR(1) specific renderers
  // =====================================================================

  const renderLR1TraceTable = () => (
    <Table striped bordered hover responsive className="fade-in">
      <thead>
        <tr>
          <th>#</th>
          <th>Tipo</th>
          <th>Acción</th>
          <th>Stack</th>
          <th>Entrada restante</th>
        </tr>
      </thead>
      <tbody>
        {result.trace?.map((step, index) => (
          <tr key={index}>
            <td>{index + 1}</td>
            <td>
              <Badge bg={badgeColor[step.type] || 'secondary'}>
                {step.type?.toUpperCase()}
              </Badge>
            </td>
            <td>{step.action}</td>
            <td>{step.stack?.join(', ')}</td>
            <td>{step.remaining_input?.join(' ')}</td>
          </tr>
        ))}
      </tbody>
    </Table>
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
              <td><code>{symbol}</code></td>
              <td>
                <Badge bg={badgeColor[action.type] || 'secondary'}>
                  {action.type}
                </Badge>
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
          <th>No Terminal</th>
          <th>Siguiente estado</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(result.goto_table || {}).map(([state, gotos]) =>
          Object.entries(gotos).map(([symbol, target], i) => (
            <tr key={`${state}-${symbol}-${i}`}>
              <td>{state}</td>
              <td><code>{symbol}</code></td>
              <td>{target}</td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );

  // =====================================================================
  // LL(1) specific renderers
  // =====================================================================

  const renderFirstFollowSets = () => (
    <div className="fade-in">
      <h6>Conjuntos FIRST</h6>
      <Table striped bordered hover responsive size="sm">
        <thead>
          <tr>
            <th>No Terminal</th>
            <th>FIRST</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(result.first_sets || {}).map(([nt, first]) => (
            <tr key={nt}>
              <td><code>{nt}</code></td>
              <td>{'{ ' + first.join(', ') + ' }'}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h6 className="mt-3">Conjuntos FOLLOW</h6>
      <Table striped bordered hover responsive size="sm">
        <thead>
          <tr>
            <th>No Terminal</th>
            <th>FOLLOW</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(result.follow_sets || {}).map(([nt, follow]) => (
            <tr key={nt}>
              <td><code>{nt}</code></td>
              <td>{'{ ' + follow.join(', ') + ' }'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );

  const renderLL1Table = () => {
    if (!result.parsing_table) return null;

    // Recoger todos los terminales usados en la tabla
    const terminalsSet = new Set();
    Object.values(result.parsing_table).forEach(row => {
      Object.keys(row).forEach(t => terminalsSet.add(t));
    });
    const terminalsList = Array.from(terminalsSet).sort();
    const nonTerminals = Object.keys(result.parsing_table);

    return (
      <div className="fade-in" style={{ overflowX: 'auto' }}>
        <Table striped bordered hover responsive size="sm">
          <thead>
            <tr>
              <th>M[A, a]</th>
              {terminalsList.map(t => (
                <th key={t}><code>{t}</code></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nonTerminals.map(nt => (
              <tr key={nt}>
                <td><strong><code>{nt}</code></strong></td>
                {terminalsList.map(t => (
                  <td key={t}>
                    {result.parsing_table[nt][t]
                      ? <code>{result.parsing_table[nt][t].production}</code>
                      : <span className="text-muted">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  };

  const renderLL1Conflicts = () => {
    if (!result.conflicts || result.conflicts.length === 0) return null;
    return (
      <div className="alert alert-warning fade-in">
        <h6>⚠️ Conflictos detectados ({result.conflicts.length})</h6>
        <ul className="mb-0">
          {result.conflicts.map((c, i) => (
            <li key={i}>{c.message}</li>
          ))}
        </ul>
        <small className="text-muted">
          La gramática no es LL(1). Los resultados del parsing pueden ser incorrectos.
        </small>
      </div>
    );
  };

  const renderLL1TraceTable = () => (
    <Table striped bordered hover responsive className="fade-in">
      <thead>
        <tr>
          <th>#</th>
          <th>Tipo</th>
          <th>Acción</th>
          <th>Pila</th>
          <th>Entrada restante</th>
        </tr>
      </thead>
      <tbody>
        {result.trace?.map((step, index) => (
          <tr key={index}>
            <td>{step.step || index + 1}</td>
            <td>
              <Badge bg={badgeColor[step.type] || 'secondary'}>
                {step.type?.toUpperCase()}
              </Badge>
            </td>
            <td>{step.action}</td>
            <td><code>{step.stack?.slice().reverse().join(' ')}</code></td>
            <td>{step.remaining_input?.join(' ')}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );

  // =====================================================================
  // Recursive Descent specific renderers
  // =====================================================================

  const renderRDTraceTable = () => (
    <Table striped bordered hover responsive className="fade-in">
      <thead>
        <tr>
          <th>#</th>
          <th>Tipo</th>
          <th>Acción</th>
          <th>Posición</th>
          <th>Token actual</th>
          <th>Prof.</th>
        </tr>
      </thead>
      <tbody>
        {result.trace?.map((step, index) => (
          <tr key={index} style={{ paddingLeft: `${(step.depth || 0) * 10}px` }}>
            <td>{step.step || index + 1}</td>
            <td>
              <Badge bg={badgeColor[step.type] || 'secondary'}>
                {step.type?.toUpperCase().replace('_', ' ')}
              </Badge>
            </td>
            <td>
              <span style={{ marginLeft: `${(step.depth || 0) * 12}px` }}>
                {step.action}
              </span>
            </td>
            <td>{step.position}</td>
            <td><code>{step.current_token}</code></td>
            <td>{step.depth}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );

  const renderParseTree = (node, key = 'root') => {
    if (!node) return <span className="text-muted">No se generó árbol de derivación</span>;

    if (node.type === 'terminal') {
      return (
        <li key={key}>
          <Badge bg="success">{node.value}</Badge>
        </li>
      );
    }

    return (
      <li key={key}>
        <strong><code>{node.symbol}</code></strong>
        {node.production && (
          <small className="text-muted ms-2">({node.production})</small>
        )}
        {node.children && node.children.length > 0 && (
          <ul className="parse-tree-children">
            {node.children.map((child, i) =>
              renderParseTree(child, `${key}-${i}`)
            )}
          </ul>
        )}
      </li>
    );
  };

  // =====================================================================
  // Main render by parser type
  // =====================================================================

  const renderLR1Result = () => (
    <Accordion defaultActiveKey="0" flush alwaysOpen className="mt-4">
      <Accordion.Item eventKey="0">
        <Accordion.Header>📄 Reglas de la gramática</Accordion.Header>
        <Accordion.Body>{renderRules()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="1">
        <Accordion.Header>📦 Tokens de entrada</Accordion.Header>
        <Accordion.Body>{renderTokens()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="2">
        <Accordion.Header>📍 Traza del análisis</Accordion.Header>
        <Accordion.Body>{renderLR1TraceTable()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="3">
        <Accordion.Header>⚙️ Tabla de Acción</Accordion.Header>
        <Accordion.Body>{renderActionTable()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="4">
        <Accordion.Header>🔁 Tabla GOTO</Accordion.Header>
        <Accordion.Body>{renderGotoTable()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="5">
        <Accordion.Header>📊 Autómata LR(1)</Accordion.Header>
        <Accordion.Body>
          <AutomatonViewer 
            states={result.states}
            transitions={result.transitions}
            actionTable={result.action_table}
            gotoTable={result.goto_table}
          />
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );

  const renderLL1Result = () => (
    <Accordion defaultActiveKey="0" flush alwaysOpen className="mt-4">
      <Accordion.Item eventKey="0">
        <Accordion.Header>📄 Reglas de la gramática</Accordion.Header>
        <Accordion.Body>{renderRules()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="1">
        <Accordion.Header>📦 Tokens de entrada</Accordion.Header>
        <Accordion.Body>{renderTokens()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="2">
        <Accordion.Header>📐 Conjuntos FIRST y FOLLOW</Accordion.Header>
        <Accordion.Body>{renderFirstFollowSets()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="3">
        <Accordion.Header>📋 Tabla de Parsing LL(1)</Accordion.Header>
        <Accordion.Body>
          {renderLL1Conflicts()}
          {renderLL1Table()}
        </Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="4">
        <Accordion.Header>📍 Traza del análisis</Accordion.Header>
        <Accordion.Body>{renderLL1TraceTable()}</Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );

  const renderRDResult = () => (
    <Accordion defaultActiveKey="0" flush alwaysOpen className="mt-4">
      <Accordion.Item eventKey="0">
        <Accordion.Header>📄 Reglas de la gramática</Accordion.Header>
        <Accordion.Body>{renderRules()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="1">
        <Accordion.Header>📦 Tokens de entrada</Accordion.Header>
        <Accordion.Body>{renderTokens()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="2">
        <Accordion.Header>📍 Traza del análisis (paso a paso)</Accordion.Header>
        <Accordion.Body>{renderRDTraceTable()}</Accordion.Body>
      </Accordion.Item>

      <Accordion.Item eventKey="3">
        <Accordion.Header>🌳 Árbol de Derivación</Accordion.Header>
        <Accordion.Body>
          <ul className="parse-tree-root">
            {renderParseTree(result.parse_tree)}
          </ul>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );

  const renderByParserType = () => {
    switch (parserType) {
      case 'll1':
        return renderLL1Result();
      case 'recursive_descent':
        return renderRDResult();
      case 'lr1':
      default:
        return renderLR1Result();
    }
  };

  return (
    <div className="container mt-5">
      <h3 className="text-center mb-4">
        📘 Resultados — {parserNames[parserType] || parserType}
      </h3>

      {result.valid ? (
        <div className="alert alert-success text-center fade-in" role="alert">
          ✅ Entrada aceptada por la gramática
        </div>
      ) : (
        <div className="alert alert-danger text-center fade-in" role="alert">
          ❌ Entrada inválida o no aceptada
        </div>
      )}

      {renderByParserType()}
    </div>
  );
};

export default ParserResult;
