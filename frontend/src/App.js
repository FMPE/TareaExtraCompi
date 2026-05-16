import React, { useState } from 'react';
import ParserForm from './components/ParserForm';
import ParserResult from './components/ParserResult';

const App = () => {
  const [result, setResult] = useState(null);

  const handleParserResult = (data) => {
    setResult(data);
  };

  return (
    <div className="App">
      <ParserForm onResult={handleParserResult} />
      <ParserResult result={result} />
    </div>
  );
};

export default App;
