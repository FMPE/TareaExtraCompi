"""
Serializadores Python → Graphviz DOT.

- automaton_to_dot(states, action_table, goto_table): autómata LR(0..1) / LALR.
- tree_to_dot(node): árbol de derivación (parse_tree) producido por lr1_parse.

Las strings DOT resultantes son consumidas por @viz-js/viz en el frontend,
y también descargadas como .dot / .png.
"""
from __future__ import annotations

from typing import Optional


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _escape(s) -> str:
    """Escapa para usarse dentro de una etiqueta con comillas en DOT."""
    if s is None:
        return ""
    return (
        str(s)
        .replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
    )


def _state_label(state_num: int, items: list, max_items: int = 6) -> str:
    """Construye el label multilínea de un estado del autómata."""
    header = f"I{state_num}"
    shown = items[:max_items]
    body = "\\l".join(_escape(it.get("display", "?")) for it in shown)
    if len(items) > max_items:
        body += f"\\l… (+{len(items) - max_items} ítems)"
    if body:
        body += "\\l"
    return f"{header}\\n{body}"


# ---------------------------------------------------------------------------
# Autómata LR
# ---------------------------------------------------------------------------

def automaton_to_dot(
    states: list,
    action_table: dict,
    goto_table: dict,
) -> str:
    """
    Genera el DOT de un autómata LR(*) usando el shape que ya producen los runners:

      states = [{"state_num": int, "items": [{"display": str, ...}]}]
      action_table = {"<state_int>": {"<terminal>": {"type": "shift|reduce|accept", "value": int|None}}}
      goto_table   = {"<state_int>": {"<nonterminal>": int}}

    Las transiciones shift se dibujan en azul, las goto en verde.
    El estado inicial (0) lleva doble borde.
    """
    if not states:
        return 'digraph G { label="(autómata vacío)"; }'

    lines = [
        "digraph LRAutomaton {",
        '  rankdir="LR";',
        '  bgcolor="transparent";',
        '  node [shape=box, style="rounded,filled", fontname="monospace", '
        'fontsize=10, fillcolor="#f8f9fa", color="#495057"];',
        '  edge [fontname="monospace", fontsize=10, color="#6c757d"];',
        "",
    ]

    # Nodo de entrada (flecha invisible que apunta al estado 0)
    lines.append('  _entry [shape=point, width=0.01, height=0.01, color="#28a745"];')

    for st in states:
        idx = st.get("state_num", 0)
        label = _state_label(idx, st.get("items", []))
        peripheries = 2 if idx == 0 else 1
        fill = "#d1ecf1" if idx == 0 else "#f8f9fa"
        lines.append(
            f'  state_{idx} [id="state-{idx}", label="{label}", '
            f'peripheries={peripheries}, fillcolor="{fill}"];'
        )

    lines.append('  _entry -> state_0 [color="#28a745", penwidth=2];')
    lines.append("")

    # Aristas shift (desde action_table)
    for state_str, actions in (action_table or {}).items():
        try:
            src = int(state_str)
        except (TypeError, ValueError):
            continue
        for symbol, act in (actions or {}).items():
            if not isinstance(act, dict):
                continue
            if act.get("type") == "shift":
                dst = act.get("value")
                if dst is None:
                    continue
                lines.append(
                    f'  state_{src} -> state_{dst} '
                    f'[label="{_escape(symbol)}", color="#0d6efd", fontcolor="#0d6efd"];'
                )

    # Aristas goto
    for state_str, gotos in (goto_table or {}).items():
        try:
            src = int(state_str)
        except (TypeError, ValueError):
            continue
        for symbol, dst in (gotos or {}).items():
            lines.append(
                f'  state_{src} -> state_{dst} '
                f'[label="{_escape(symbol)}", color="#198754", fontcolor="#198754", style="dashed"];'
            )

    lines.append("}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Árbol de derivación
# ---------------------------------------------------------------------------

def tree_to_dot(node: Optional[dict]) -> Optional[str]:
    """
    Serializa un parse_tree (shape: {kind, label, rule_num?, children?, lexeme?})
    a DOT. Devuelve None si el árbol es vacío.
    """
    if not node:
        return None

    lines = [
        "digraph ParseTree {",
        '  bgcolor="transparent";',
        '  node [fontname="sans-serif", fontsize=11];',
        '  edge [color="#6c757d"];',
        "",
    ]

    counter = {"n": 0}

    def _emit(n: dict) -> str:
        counter["n"] += 1
        nid = f"n{counter['n']}"
        kind = n.get("kind", "nonterminal")
        label = n.get("label", "?")

        if kind == "terminal":
            lex = n.get("lexeme")
            if lex and lex != label:
                disp = f"{label}\\n«{lex}»"
            else:
                disp = label
            lines.append(
                f'  {nid} [id="{nid}", shape=box, style="rounded,filled", '
                f'fillcolor="#d4edda", color="#28a745", label="{_escape(disp)}"];'
            )
        elif kind == "epsilon":
            lines.append(
                f'  {nid} [id="{nid}", shape=plaintext, fontcolor="#6c757d", label="ε"];'
            )
        else:
            rule = n.get("rule_num")
            if rule is not None and rule >= 0:
                disp = f"{label}\\n(regla {rule})"
            else:
                disp = label
            lines.append(
                f'  {nid} [id="{nid}", shape=ellipse, style="filled", '
                f'fillcolor="#cfe2ff", color="#0d6efd", label="{_escape(disp)}"];'
            )

        for child in n.get("children") or []:
            cid = _emit(child)
            lines.append(f"  {nid} -> {cid};")

        return nid

    _emit(node)
    lines.append("}")
    return "\n".join(lines)
