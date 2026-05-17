import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function fmtActionCell(cell) {
  if (!cell) return '';
  if (cell.type === 'shift') return `s${cell.value}`;
  if (cell.type === 'reduce') return `r${cell.value}`;
  if (cell.type === 'accept') return 'acc';
  return '';
}

function collectLrMatrix(actionTable, gotoTable) {
  const terms = new Set();
  const nts = new Set();
  Object.values(actionTable || {}).forEach((row) => {
    Object.keys(row || {}).forEach((k) => terms.add(k));
  });
  Object.values(gotoTable || {}).forEach((row) => {
    Object.keys(row || {}).forEach((k) => nts.add(k));
  });
  const terminals = [...terms].filter((x) => x !== '$').sort();
  if (terms.has('$')) terminals.push('$');
  const nonTerminals = [...nts].sort();
  const states = new Set();
  Object.keys(actionTable || {}).forEach((k) => states.add(Number(k)));
  Object.keys(gotoTable || {}).forEach((k) => states.add(Number(k)));
  const stateList = [...states].sort((a, b) => a - b);
  return { stateList, terminals, nonTerminals };
}

function addSectionTitle(doc, title, y) {
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(title, 14, y);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  return y + 8;
}

/**
 * Exporta reglas, tablas LR (ACTION+GOTO matriz), LL M table, FIRST/FOLLOW, traza resumida.
 */
export function exportParserResultToPdf(result, filenameBase = 'parser-informe') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = 14;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.text('Informe de análisis sintáctico', 14, y);
  y += 10;
  doc.setFontSize(10);
  doc.text(`Algoritmo: ${result.parser_label || result.parser || '—'}`, 14, y);
  y += 5;
  doc.text(`Entrada válida: ${result.valid ? 'Sí' : 'No'}`, 14, y);
  y += 5;
  doc.text(`Tokens: ${(result.input_tokens || []).join(' ')}`, 14, y);
  y += 10;

  const rules = result.grammar?.rules || [];
  if (rules.length) {
    y = addSectionTitle(doc, 'Reglas', y);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Producción']],
      body: rules.map((r) => [
        String(r.rule_num ?? ''),
        `${r.lhs} → ${(r.rhs || []).join(' ')}`,
      ]),
      styles: { fontSize: 8 },
      margin: { left: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  const family = result.parser_family;
  if (family === 'lr' && result.action_table) {
    const { stateList, terminals, nonTerminals } = collectLrMatrix(
      result.action_table,
      result.goto_table
    );
    const head = ['Estado', ...terminals.map(String), ...nonTerminals.map((nt) => `G:${nt}`)];
    const body = stateList.map((st) => {
      const row = [String(st)];
      terminals.forEach((t) => {
        const cell =
          result.action_table[String(st)]?.[t] ?? result.action_table[st]?.[t];
        row.push(fmtActionCell(cell));
      });
      nonTerminals.forEach((nt) => {
        const g = result.goto_table?.[String(st)]?.[nt] ?? result.goto_table?.[st]?.[nt];
        row.push(g != null ? String(g) : '');
      });
      return row;
    });
    y = addSectionTitle(doc, 'Tablas ACTION / GOTO (matriz)', y);
    if (y > 180) {
      doc.addPage();
      y = 14;
    }
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [13, 110, 253] },
      margin: { left: 14 },
      tableWidth: pageWidth - 28,
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (family === 'topdown' && result.parse_table) {
    const rows = [];
    Object.entries(result.parse_table).forEach(([nt, cols]) => {
      Object.entries(cols || {}).forEach(([term, cells]) => {
        (cells || []).forEach((cell) => {
          rows.push([
            nt,
            term,
            String(cell.rule_num ?? ''),
            `${cell.lhs} → ${(cell.rhs || []).join(' ')}`,
          ]);
        });
      });
    });
    if (rows.length) {
      if (y > 150) {
        doc.addPage();
        y = 14;
      }
      y = addSectionTitle(doc, 'Tabla predictiva M[A, a]', y);
      autoTable(doc, {
        startY: y,
        head: [['No terminal', 'Terminal', 'Regla #', 'Producción']],
        body: rows,
        styles: { fontSize: 8 },
        margin: { left: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }
  }

  const first = result.first_sets;
  const follow = result.follow_sets;
  if (first && Object.keys(first).length) {
    if (y > 160) {
      doc.addPage();
      y = 14;
    }
    y = addSectionTitle(doc, 'Conjuntos FIRST', y);
    autoTable(doc, {
      startY: y,
      head: [['Símbolo', 'FIRST']],
      body: Object.entries(first).map(([k, v]) => [k, (v || []).join(', ')]),
      styles: { fontSize: 8 },
      margin: { left: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }
  if (follow && Object.keys(follow).length) {
    if (y > 160) {
      doc.addPage();
      y = 14;
    }
    y = addSectionTitle(doc, 'Conjuntos FOLLOW', y);
    autoTable(doc, {
      startY: y,
      head: [['Símbolo', 'FOLLOW']],
      body: Object.entries(follow).map(([k, v]) => [k, (v || []).join(', ')]),
      styles: { fontSize: 8 },
      margin: { left: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  const trace = result.trace || [];
  const maxRows = 80;
  if (y > 120) {
    doc.addPage();
    y = 14;
  }
  y = addSectionTitle(doc, `Traza (máx. ${maxRows} pasos)`, y);
  autoTable(doc, {
    startY: y,
    head: [['#', 'Tipo', 'Acción']],
    body: trace.slice(0, maxRows).map((step, i) => [
      String(i + 1),
      step.type || '',
      String(step.action || '').substring(0, 120),
    ]),
    styles: { fontSize: 7 },
    margin: { left: 14 },
  });

  const safeName = `${filenameBase.replace(/[^a-z0-9-_]/gi, '_')}.pdf`;
  doc.save(safeName);
}
