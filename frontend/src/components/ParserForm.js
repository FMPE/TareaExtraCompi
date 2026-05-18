import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { Form, Button, Alert, Card } from 'react-bootstrap';
import FormalSymbolsKeyboard from './FormalSymbolsKeyboard';
import SectionBadge from './SectionBadge';
import ExamplePills from './ExamplePills';
import GrammarLinter from './GrammarLinter';
import { hasGrammarErrors } from '../utils/grammarLinter';
import { apiUrl } from '../config';
import { findParser, useParserSelection } from '../context/ParserSelectionContext';
import { useHistoryContext } from '../context/HistoryContext';
import './ParserForm.css';

function insertAtCursor(textareaRef, value, setValue, snippet) {
  const el = textareaRef.current;
  if (!el) {
    setValue(value + snippet);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + snippet + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    try {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
  });
}

const ParserForm = ({ onResult }) => {
  const {
    parser,
    parserB,
    compareMode,
    grammar,
    setGrammar,
    input,
    setInput,
  } = useParserSelection();
  const { add: addHistory } = useHistoryContext();
  const [activeField, setActiveField] = useState('grammar');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const grammarRef = useRef(null);
  const inputRef = useRef(null);

  const normalizeGrammar = (g) => g.replace(/\r\n/g, '\n').replace(/λ/g, 'ε');

  const insertText = useCallback(
    (snippet) => {
      if (activeField === 'input') {
        insertAtCursor(inputRef, input, setInput, snippet);
      } else {
        insertAtCursor(grammarRef, grammar, setGrammar, snippet);
      }
    },
    [activeField, grammar, input, setGrammar, setInput]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const grammarPayload = normalizeGrammar(grammar);
    const primary = findParser(parser);
    const secondary = findParser(parserB);

    try {
      if (compareMode) {
        if (parser === parserB) {
          setError('Elige dos algoritmos distintos para comparar (cámbialo en el sidebar).');
          setLoading(false);
          return;
        }
        const [a, b] = await Promise.all([
          axios.post(apiUrl('/api/parse'), { grammar: grammarPayload, input, parser }),
          axios.post(apiUrl('/api/parse'), { grammar: grammarPayload, input, parser: parserB }),
        ]);
        onResult({
          compare: true,
          left: a.data,
          right: b.data,
          leftLabel: primary.label,
          rightLabel: secondary.label,
        });
        addHistory({
          grammar,
          input,
          parser,
          parserLabel: `${primary.label} vs ${secondary.label}`,
          valid: !!(a.data?.valid && b.data?.valid),
        });
      } else {
        const response = await axios.post(apiUrl('/api/parse'), {
          grammar: grammarPayload,
          input,
          parser,
        });
        onResult(response.data);
        addHistory({
          grammar,
          input,
          parser,
          parserLabel: response.data?.parser_label || primary.label,
          valid: !!response.data?.valid,
        });
      }
    } catch (err) {
      const msg = err.response?.data?.error;
      setError(
        msg ||
          'Error al procesar. Verifica gramática, parser y que la API esté en :5001 (o REACT_APP_API_URL).'
      );
    } finally {
      setLoading(false);
    }
  };

  const current = findParser(parser);
  const secondary = compareMode ? findParser(parserB) : null;

  return (
    <Card className="parser-form-card">
      <Card.Body>
        <div className="parser-form-header">
          <div>
            <h2 className="parser-form-title">Análisis sintáctico</h2>
            <p className="parser-form-subtitle">
              {compareMode
                ? 'Comparación de algoritmos sobre la misma gramática.'
                : 'Pega tu gramática, escribe la entrada y obtén la traza completa.'}
            </p>
          </div>
        </div>

        <div className="parser-form-pills">
          <SectionBadge tone={current.family === 'top-down' ? 'top-down' : 'bottom-up'}>
            {current.label}
          </SectionBadge>
          {secondary && (
            <>
              <span className="parser-form-pill-sep">vs</span>
              <SectionBadge
                tone={secondary.family === 'top-down' ? 'top-down' : 'bottom-up'}
              >
                {secondary.label}
              </SectionBadge>
            </>
          )}
        </div>

        <Form onSubmit={handleSubmit} className="parser-form">
          <div className="parser-form-section">
            <div className="parser-form-section-head">
              <SectionBadge tone="input" icon="📝">Entrada</SectionBadge>
            </div>

            <ExamplePills />

            <Form.Group controlId="grammar" className="mt-2">
              <Form.Label>Gramática</Form.Label>
              <Form.Control
                ref={grammarRef}
                as="textarea"
                rows={6}
                value={grammar}
                onChange={(e) => setGrammar(e.target.value)}
                onFocus={() => setActiveField('grammar')}
                className="font-mono"
                placeholder={
                  'Ejemplo LR:\nE -> E + T\nE -> T\nT -> id\n\nTambién puedes usar → en lugar de ->'
                }
              />
              <GrammarLinter
                grammar={grammar}
                family={['rd', 'll1'].includes(parser) ? 'topdown' : 'lr'}
              />
            </Form.Group>

            <Form.Group controlId="input" className="mt-3">
              <Form.Label>Cadena de entrada (tokens separados por espacio)</Form.Label>
              <Form.Control
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setActiveField('input')}
                className="font-mono"
                placeholder="id + id   ·   a a b b"
              />
            </Form.Group>

            <div className="mt-3">
              <FormalSymbolsKeyboard insertText={insertText} activeTarget={activeField} />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="parser-form-submit w-100"
            disabled={loading || !grammar || !input || hasGrammarErrors(grammar)}
          >
            {loading ? 'Procesando…' : compareMode ? 'Comparar algoritmos' : 'Analizar'}
          </Button>

          {grammar && hasGrammarErrors(grammar) ? (
            <p className="parser-form-hint parser-form-hint-error">
              Hay errores estructurales en la gramática — revisa el panel de validación.
            </p>
          ) : (
            <p className="parser-form-hint">
              ¿Quieres cambiar el algoritmo? Selecciónalo en el panel lateral.
            </p>
          )}
        </Form>

        {error && (
          <Alert variant="danger" className="mt-3 mb-0">
            {error}
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default ParserForm;
