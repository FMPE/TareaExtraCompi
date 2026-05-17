import React from 'react';
import { Accordion } from 'react-bootstrap';

const HELP = [
  {
    id: 'rd',
    title: 'Descenso recursivo (predictivo)',
    body: 'Recorre el árbol de derivación en profundidad. Usa la misma tabla LL(1): en cada no terminal elige una producción según el siguiente token (FIRST/FOLLOW). La traza muestra llamadas, reglas y coincidencias con terminales.',
  },
  {
    id: 'll1',
    title: 'LL(1)',
    body: 'Tabla M[A,a] con FIRST y FOLLOW. La pila contiene símbolos gramaticales; se expande o se compara con terminales según la tabla.',
  },
  {
    id: 'lr0',
    title: 'LR(0)',
    body: 'Ítems sin lookahead; ACTION suele ser ambigua en gramáticas prácticas. Base teórica del ascenso.',
  },
  {
    id: 'slr1',
    title: 'SLR(1)',
    body: 'Estados LR(0); reducciones solo en FOLLOW del no terminal. Menos conflictos que LR(0).',
  },
  {
    id: 'lalr1',
    title: 'LALR(1)',
    body: 'Fusiona estados LR(1) con el mismo núcleo. Compromiso entre tamaño de tabla y poder expresivo.',
  },
  {
    id: 'lr1',
    title: 'LR(1)',
    body: 'Lookahead en cada ítem. Máxima precisión en la familia LR clásica.',
  },
  {
    id: 'trees',
    title: 'Árboles (parse / derivación / AST)',
    body: 'LR construye parse tree en shift/reduce. LL y descenso recursivo muestran derivación izquierda. El árbol sigue tu gramática (no es un AST optimizado de operadores).',
  },
  {
    id: 'compare',
    title: 'Comparación',
    body: 'Dos parsers sobre la misma gramática y entrada: compara validez, pasos y conflictos.',
  },
];

const ParserHelpPanel = () => (
  <Accordion className="mb-4 parser-help" flush>
    <Accordion.Item eventKey="0">
      <Accordion.Header>Explicaciones interactivas (guía rápida)</Accordion.Header>
      <Accordion.Body className="p-0">
        <Accordion alwaysOpen flush>
          {HELP.map((h, i) => (
            <Accordion.Item eventKey={`sub-${i}`} key={h.id}>
              <Accordion.Header className="small py-2">{h.title}</Accordion.Header>
              <Accordion.Body className="small">{h.body}</Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
        <p className="small text-muted px-3 py-2 mb-0 border-top">
          El teclado formal inserta Unicode; el backend acepta <code>→</code> como <code>-&gt;</code>.
          Tras cada análisis, revisa el panel <strong>Asistente inteligente</strong> (explicación de errores,
          conflictos y sugerencias LL(1)).
        </p>
      </Accordion.Body>
    </Accordion.Item>
  </Accordion>
);

export default ParserHelpPanel;
