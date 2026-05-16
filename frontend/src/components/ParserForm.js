import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Button, Alert, Badge } from 'react-bootstrap';

const PARSER_ENDPOINTS = {
  recursive_descent: '/api/parse/recursive-descent',
  ll1: '/api/parse/ll1',
  lr1: '/api/parse/lr1',
};

const PARSER_LABELS = {
  recursive_descent: { name: 'Descenso Recursivo', type: 'Top-Down', color: 'info' },
  ll1: { name: 'LL(1) Predictivo', type: 'Top-Down', color: 'info' },
  lr1: { name: 'LR(1)', type: 'Bottom-Up', color: 'warning' },
};

const ParserForm = ({ onResult }) => {
  const [grammar, setGrammar] = useState('');
  const [input, setInput] = useState('');
  const [parserType, setParserType] = useState('lr1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [examples, setExamples] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5001/api/examples')
      .then(res => {
        if (res.data.success) {
          setExamples(res.data.examples);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = PARSER_ENDPOINTS[parserType] || PARSER_ENDPOINTS.lr1;
      const response = await axios.post(`http://localhost:5001${endpoint}`, {
        grammar,
        input,
      });
      onResult({ ...response.data, parser_type: parserType });
    } catch (err) {
      const errMsg = err.response?.data?.error
        || 'Error al procesar la entrada. Verifica la gramática o el input.';
      setError(errMsg);
      onResult(null);
    } finally {
      setLoading(false);
    }
  };

  const loadExample = (example) => {
    setGrammar(example.grammar);
    setInput(example.input);
  };

  const compatibleExamples = examples.filter(
    ex => !ex.compatible_parsers || ex.compatible_parsers.includes(parserType)
  );

  return (
    <div className="container mt-5">
      <h2 className="text-center mb-4">🔍 Analizador Sintáctico</h2>

      {/* Selector de parser */}
      <Form.Group controlId="parserType" className="mb-4">
        <Form.Label><strong>Tipo de Parser</strong></Form.Label>
        <Form.Select
          value={parserType}
          onChange={(e) => {
            setParserType(e.target.value);
            setError(null);
          }}
        >
          <optgroup label="Top-Down">
            <option value="recursive_descent">Descenso Recursivo (con backtracking)</option>
            <option value="ll1">LL(1) Predictivo</option>
          </optgroup>
          <optgroup label="Bottom-Up">
            <option value="lr1">LR(1)</option>
          </optgroup>
        </Form.Select>
        <div className="mt-2">
          <Badge bg={PARSER_LABELS[parserType]?.color || 'secondary'}>
            {PARSER_LABELS[parserType]?.type}
          </Badge>{' '}
          <small className="text-muted">{PARSER_LABELS[parserType]?.name}</small>
        </div>
      </Form.Group>

      {/* Ejemplos rápidos */}
      {compatibleExamples.length > 0 && (
        <div className="mb-3">
          <Form.Label><strong>Ejemplos rápidos</strong></Form.Label>
          <div className="d-flex flex-wrap gap-2">
            {compatibleExamples.map((ex, i) => (
              <Button
                key={i}
                variant="outline-secondary"
                size="sm"
                onClick={() => loadExample(ex)}
                title={ex.description}
              >
                {ex.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Form onSubmit={handleSubmit}>
        <Form.Group controlId="grammar">
          <Form.Label>Gramática</Form.Label>
          <Form.Control
            as="textarea"
            rows={5}
            value={grammar}
            onChange={(e) => setGrammar(e.target.value)}
            placeholder={
              parserType === 'lr1'
                ? "Ejemplo: E -> E + T\nE -> T\nT -> id"
                : "Ejemplo: E -> T EP\nEP -> + T EP\nEP -> ε\nT -> id"
            }
          />
        </Form.Group>

        <Form.Group controlId="input" className="mt-3">
          <Form.Label>Entrada</Form.Label>
          <Form.Control
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ejemplo: id + id"
          />
        </Form.Group>

        <Button type="submit" variant="primary" className="mt-4 w-100" disabled={loading}>
          {loading ? 'Procesando...' : 'Parsear'}
        </Button>
      </Form>

      {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
    </div>
  );
};

export default ParserForm;
