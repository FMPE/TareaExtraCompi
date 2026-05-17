import React, { useMemo } from 'react';
import { Table } from 'react-bootstrap';
import './LRMatrixTables.css';

function collectCols(actionTable, gotoTable) {
  const terms = new Set();
  const nts = new Set();
  Object.values(actionTable || {}).forEach((row) => {
    Object.keys(row || {}).forEach((k) => terms.add(k));
  });
  Object.values(gotoTable || {}).forEach((row) => {
    Object.keys(row || {}).forEach((k) => nts.add(k));
  });
  const tArr = [...terms].filter((x) => x !== '$').sort();
  if (terms.has('$')) tArr.push('$');
  const ntArr = [...nts].sort();
  return { terminals: tArr, nonTerminals: ntArr };
}

function fmtAction(cell) {
  if (!cell) return '';
  if (cell.type === 'shift') return `s${cell.value}`;
  if (cell.type === 'reduce') return `r${cell.value}`;
  if (cell.type === 'accept') return 'acc';
  return '';
}

const LRMatrixTables = ({ actionTable, gotoTable, highlightState, highlightSymbol }) => {
  const { terminals, nonTerminals } = useMemo(
    () => collectCols(actionTable, gotoTable),
    [actionTable, gotoTable]
  );

  const states = useMemo(() => {
    const s = new Set();
    Object.keys(actionTable || {}).forEach((k) => s.add(Number(k)));
    Object.keys(gotoTable || {}).forEach((k) => s.add(Number(k)));
    return [...s].sort((a, b) => a - b);
  }, [actionTable, gotoTable]);

  const rowClass = (st) => {
    if (highlightState == null) return '';
    return Number(st) === Number(highlightState) ? 'lr-matrix-highlight-row' : '';
  };

  const cellClass = (st, sym, cell) => {
    const rowHit = highlightState != null && Number(st) === Number(highlightState);
    const colHit = highlightSymbol && sym === highlightSymbol;
    const tone = cell?.type ? `cell-${cell.type}` : '';
    let cls = tone;
    if (rowHit && colHit) cls += ' lr-matrix-highlight-cell';
    else if (rowHit) cls += ' lr-matrix-highlight-rowcell';
    return cls.trim();
  };

  return (
    <div className="lr-matrix-wrap">
      <h6 className="mb-2">Tablas dinámicas — resaltado según el paso de la simulación</h6>
      <div className="lr-matrix-legend">
        <span className="lr-matrix-legend-item"><span className="lr-matrix-legend-swatch swatch-shift" /> shift</span>
        <span className="lr-matrix-legend-item"><span className="lr-matrix-legend-swatch swatch-reduce" /> reduce</span>
        <span className="lr-matrix-legend-item"><span className="lr-matrix-legend-swatch swatch-accept" /> accept</span>
        <span className="lr-matrix-legend-item"><span className="lr-matrix-legend-swatch swatch-goto" /> goto</span>
      </div>
      <div className="table-responsive mb-3">
        <Table bordered size="sm" className="lr-matrix-table text-center">
          <thead>
            <tr>
              <th rowSpan={2}>Estado</th>
              <th colSpan={terminals.length}>ACTION</th>
              {nonTerminals.length > 0 && <th colSpan={nonTerminals.length}>GOTO</th>}
            </tr>
            <tr>
              {terminals.map((t) => (
                <th key={`t-${t}`} className="lr-matrix-term">
                  <code>{t}</code>
                </th>
              ))}
              {nonTerminals.map((nt) => (
                <th key={`nt-${nt}`} className="lr-matrix-nt">
                  <code>{nt}</code>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {states.map((st) => (
              <tr key={st} className={rowClass(st)}>
                <th scope="row">{st}</th>
                {terminals.map((t) => {
                  const cell = actionTable?.[String(st)]?.[t] ?? actionTable?.[st]?.[t];
                  return (
                    <td key={`${st}-${t}`} className={cellClass(st, t, cell)}>
                      <code>{fmtAction(cell)}</code>
                    </td>
                  );
                })}
                {nonTerminals.map((nt) => {
                  const g = gotoTable?.[String(st)]?.[nt] ?? gotoTable?.[st]?.[nt];
                  return (
                    <td key={`${st}-g-${nt}`} className={cellClass(st, nt) + (g != null ? ' cell-goto' : '')}>
                      {g != null ? <code>{g}</code> : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default LRMatrixTables;
