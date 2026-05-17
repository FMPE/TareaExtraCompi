// Constructores DOT en frontend (fallback cuando el backend no envía dot_automaton / dot_tree).
// Reflejan el algoritmo de backend/dot_export.py.

const escapeDot = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

const stateLabel = (stateNum, items, maxItems = 6) => {
  const header = `I${stateNum}`;
  const shown = (items || []).slice(0, maxItems);
  let body = shown.map((it) => escapeDot(it.display || '?')).join('\\l');
  if ((items || []).length > maxItems) {
    body += `\\l… (+${items.length - maxItems} ítems)`;
  }
  if (body) body += '\\l';
  return `${header}\\n${body}`;
};

export const buildAutomatonDot = (states, actionTable, gotoTable) => {
  if (!states || states.length === 0) {
    return 'digraph G { label="(autómata vacío)"; }';
  }

  const lines = [
    'digraph LRAutomaton {',
    '  rankdir="LR";',
    '  bgcolor="transparent";',
    '  node [shape=box, style="rounded,filled", fontname="monospace", fontsize=10, fillcolor="#f8f9fa", color="#495057"];',
    '  edge [fontname="monospace", fontsize=10, color="#6c757d"];',
    '',
    '  _entry [shape=point, width=0.01, height=0.01, color="#28a745"];',
  ];

  for (const st of states) {
    const idx = st.state_num ?? 0;
    const label = stateLabel(idx, st.items || []);
    const peripheries = idx === 0 ? 2 : 1;
    const fill = idx === 0 ? '#d1ecf1' : '#f8f9fa';
    lines.push(
      `  state_${idx} [id="state-${idx}", label="${label}", peripheries=${peripheries}, fillcolor="${fill}"];`
    );
  }

  lines.push('  _entry -> state_0 [color="#28a745", penwidth=2];', '');

  for (const [stateStr, actions] of Object.entries(actionTable || {})) {
    const src = parseInt(stateStr, 10);
    if (Number.isNaN(src)) continue;
    for (const [symbol, act] of Object.entries(actions || {})) {
      if (act && act.type === 'shift' && act.value != null) {
        lines.push(
          `  state_${src} -> state_${act.value} [label="${escapeDot(symbol)}", color="#0d6efd", fontcolor="#0d6efd"];`
        );
      }
    }
  }

  for (const [stateStr, gotos] of Object.entries(gotoTable || {})) {
    const src = parseInt(stateStr, 10);
    if (Number.isNaN(src)) continue;
    for (const [symbol, dst] of Object.entries(gotos || {})) {
      lines.push(
        `  state_${src} -> state_${dst} [label="${escapeDot(symbol)}", color="#198754", fontcolor="#198754", style="dashed"];`
      );
    }
  }

  lines.push('}');
  return lines.join('\n');
};

export const buildTreeDot = (root) => {
  if (!root) return null;

  const lines = [
    'digraph ParseTree {',
    '  bgcolor="transparent";',
    '  node [fontname="sans-serif", fontsize=11];',
    '  edge [color="#6c757d"];',
    '',
  ];

  let counter = 0;
  const emit = (n) => {
    counter += 1;
    const nid = `n${counter}`;
    const kind = n.kind || 'nonterminal';
    const label = n.label ?? '?';

    if (kind === 'terminal') {
      const lex = n.lexeme;
      const disp = lex && lex !== label ? `${label}\\n«${lex}»` : label;
      lines.push(
        `  ${nid} [id="${nid}", shape=box, style="rounded,filled", fillcolor="#d4edda", color="#28a745", label="${escapeDot(disp)}"];`
      );
    } else if (kind === 'epsilon') {
      lines.push(`  ${nid} [id="${nid}", shape=plaintext, fontcolor="#6c757d", label="ε"];`);
    } else {
      const rule = n.rule_num;
      const disp = rule != null && rule >= 0 ? `${label}\\n(regla ${rule})` : label;
      lines.push(
        `  ${nid} [id="${nid}", shape=ellipse, style="filled", fillcolor="#cfe2ff", color="#0d6efd", label="${escapeDot(disp)}"];`
      );
    }

    for (const child of n.children || []) {
      const cid = emit(child);
      lines.push(`  ${nid} -> ${cid};`);
    }
    return nid;
  };

  emit(root);
  lines.push('}');
  return lines.join('\n');
};
