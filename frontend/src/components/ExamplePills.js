import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../config';
import { useParserSelection } from '../context/ParserSelectionContext';
import './ExamplePills.css';

let cachedExamples = null;
const fetchExamples = async () => {
  if (cachedExamples) return cachedExamples;
  const r = await axios.get(apiUrl('/api/examples'));
  if (r.data?.success && Array.isArray(r.data.examples)) {
    cachedExamples = r.data.examples;
    return cachedExamples;
  }
  return [];
};

const ExamplePills = () => {
  const { parser, setGrammar, setInput } = useParserSelection();
  const [examples, setExamples] = useState(cachedExamples || []);
  const [loading, setLoading] = useState(!cachedExamples);

  useEffect(() => {
    let cancel = false;
    fetchExamples()
      .then((list) => { if (!cancel) { setExamples(list); setLoading(false); } })
      .catch(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  const visible = examples.filter(
    (ex) => !ex.recommended_parsers || ex.recommended_parsers.includes(parser)
  );

  if (loading) {
    return (
      <div className="example-pills-loading text-muted small">
        Cargando ejemplos…
      </div>
    );
  }

  if (visible.length === 0) return null;

  const loadExample = (ex) => {
    setGrammar(ex.grammar);
    setInput(ex.input);
  };

  return (
    <div className="example-pills">
      <div className="example-pills-label">Ejemplos rápidos</div>
      <div className="example-pills-row">
        {visible.map((ex, i) => {
          const isConflict = Array.isArray(ex.conflict_in) && ex.conflict_in.includes(parser);
          return (
            <button
              key={`${ex.name}-${i}`}
              type="button"
              className={`example-pill ${isConflict ? 'conflict' : ''}`}
              onClick={() => loadExample(ex)}
              title={ex.description}
            >
              {isConflict && <span className="example-pill-warn" aria-hidden="true">⚠</span>}
              <span className="example-pill-name">{ex.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ExamplePills;
