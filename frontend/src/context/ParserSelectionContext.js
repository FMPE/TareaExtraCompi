import React, { createContext, useContext, useMemo, useState } from 'react';

export const PARSER_OPTIONS = [
  { value: 'rd', label: 'Descenso Recursivo', short: 'RD', family: 'top-down' },
  { value: 'll1', label: 'LL(1)', short: 'LL(1)', family: 'top-down' },
  { value: 'lr0', label: 'LR(0)', short: 'LR(0)', family: 'bottom-up' },
  { value: 'slr1', label: 'SLR(1)', short: 'SLR(1)', family: 'bottom-up' },
  { value: 'lalr1', label: 'LALR(1)', short: 'LALR(1)', family: 'bottom-up' },
  { value: 'lr1', label: 'LR(1)', short: 'LR(1)', family: 'bottom-up' },
];

export const findParser = (value) =>
  PARSER_OPTIONS.find((p) => p.value === value) || PARSER_OPTIONS[5];

const ParserSelectionContext = createContext(null);

export const ParserSelectionProvider = ({ children }) => {
  const [parser, setParser] = useState('lr1');
  const [parserB, setParserB] = useState('slr1');
  const [compareMode, setCompareMode] = useState(false);
  const [grammar, setGrammar] = useState('');
  const [input, setInput] = useState('');

  const value = useMemo(
    () => ({
      parser,
      setParser,
      parserB,
      setParserB,
      compareMode,
      setCompareMode,
      grammar,
      setGrammar,
      input,
      setInput,
    }),
    [parser, parserB, compareMode, grammar, input]
  );

  return (
    <ParserSelectionContext.Provider value={value}>
      {children}
    </ParserSelectionContext.Provider>
  );
};

export const useParserSelection = () => {
  const ctx = useContext(ParserSelectionContext);
  if (!ctx) throw new Error('useParserSelection debe usarse dentro de ParserSelectionProvider');
  return ctx;
};

export default ParserSelectionContext;
