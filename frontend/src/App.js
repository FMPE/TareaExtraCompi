import React, { useState } from 'react';
import AppShell from './components/AppShell';
import ParserForm from './components/ParserForm';
import ParserResult from './components/ParserResult';
import ParserCompareView from './components/ParserCompareView';
import ParserHelpPanel from './components/ParserHelpPanel';
import { ParserSelectionProvider } from './context/ParserSelectionContext';
import { HistoryProvider } from './context/HistoryContext';
import './App.css';

const Workspace = () => {
  const [result, setResult] = useState(null);

  return (
    <div className="workspace-grid">
      <section className="workspace-input">
        <ParserForm onResult={setResult} />
        <ParserHelpPanel />
      </section>
      <section className="workspace-output">
        {result?.compare ? (
          <ParserCompareView
            left={result.left}
            right={result.right}
            leftLabel={result.leftLabel}
            rightLabel={result.rightLabel}
          />
        ) : (
          <ParserResult result={result} />
        )}
        {!result && (
          <div className="workspace-empty">
            <div className="workspace-empty-card">
              <h3>Pega una gramática y pulsa <em>Analizar</em></h3>
              <p>
                Los resultados aparecerán aquí: traza paso a paso, tablas ACTION/GOTO con colores
                semánticos, autómata Graphviz y asistente inteligente.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

const App = () => (
  <ParserSelectionProvider>
    <HistoryProvider>
      <div className="App">
        <AppShell>
          <Workspace />
        </AppShell>
      </div>
    </HistoryProvider>
  </ParserSelectionProvider>
);

export default App;
