import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'parserlab-history';
const VERSION = 1;
const MAX_ENTRIES = 20;

const readInitial = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION || !Array.isArray(parsed?.entries)) return [];
    return parsed.entries.slice(0, MAX_ENTRIES);
  } catch (_) {
    return [];
  }
};

const persist = (entries) => {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: VERSION, entries })
    );
  } catch (_) {
    /* quota exceeded → ignorar */
  }
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sameKey = (a, b) =>
  a.grammar === b.grammar && a.input === b.input && a.parser === b.parser;

export const useHistory = () => {
  const [entries, setEntries] = useState(readInitial);

  useEffect(() => {
    persist(entries);
  }, [entries]);

  const add = useCallback((entry) => {
    if (!entry?.grammar || !entry?.input || !entry?.parser) return;
    const next = {
      id: makeId(),
      grammar: entry.grammar,
      input: entry.input,
      parser: entry.parser,
      parserLabel: entry.parserLabel || entry.parser,
      valid: !!entry.valid,
      ts: Date.now(),
    };
    setEntries((prev) => {
      const filtered = prev.filter((e) => !sameKey(e, next));
      return [next, ...filtered].slice(0, MAX_ENTRIES);
    });
  }, []);

  const remove = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, add, remove, clear };
};

export default useHistory;
