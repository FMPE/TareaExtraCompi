import React, { createContext, useContext } from 'react';
import useHistory from '../hooks/useHistory';

const HistoryContext = createContext(null);

export const HistoryProvider = ({ children }) => {
  const value = useHistory();
  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
};

export const useHistoryContext = () => {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistoryContext debe usarse dentro de HistoryProvider');
  return ctx;
};

export default HistoryContext;
