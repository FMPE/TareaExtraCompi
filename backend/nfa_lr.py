"""
Construcción del AFN (NFA) de ítems LR(0) / LR(1).

A diferencia del DFA canónico (que es la subset-construction donde cada estado
es la clausura de un conjunto de ítems), aquí cada ítem es un **nodo individual**.

Aristas:
  - símbolo X  →  avanza el punto: (A → α • Xβ)  ─X→  (A → αX • β)
  - epsilon    →  closure: (A → α • Bβ) ─ε→ (B → •γ) para cada producción B → γ
                 (en LR(1), la flecha ε va a (B → •γ, b) por cada b ∈ FIRST(βa) \ {ε})

Se enumeran SÓLO los ítems alcanzables desde el aumentado [S' → •S] (BFS),
para que en LR(1) no estallemos con el cartesiano de lookaheads.
"""
from __future__ import annotations

from collections import deque

from grammar_common import compute_first_sequence


# ---------------------------------------------------------------------------
# LR(0)
# ---------------------------------------------------------------------------

def build_lr0_nfa(grammar, start_symbol):
    """Retorna (items, transitions). Items son tuplas (rule_num, lhs, rhs_tuple, dot_pos).

    transitions: lista de (from_item, label, to_item) con label = 'ε' o símbolo.
    """
    aug_lhs = start_symbol + "'"
    start_item = (-1, aug_lhs, (start_symbol,), 0)
    accept_item = (-1, aug_lhs, (start_symbol,), 1)

    items = {start_item}
    transitions = []
    queue = deque([start_item])

    while queue:
        it = queue.popleft()
        _rn, _lhs, rhs, dp = it

        if dp < len(rhs):
            sym = rhs[dp]
            advanced = (it[0], it[1], rhs, dp + 1)
            transitions.append((it, sym, advanced))
            if advanced not in items:
                items.add(advanced)
                queue.append(advanced)

            if sym in grammar:
                for prod_num, prod_rhs in grammar[sym]:
                    eps_target = (prod_num, sym, tuple(prod_rhs), 0)
                    transitions.append((it, "ε", eps_target))
                    if eps_target not in items:
                        items.add(eps_target)
                        queue.append(eps_target)

        # Manejo de producciones epsilon (rhs == ('ε',)): el ítem inicial (dp=0)
        # avanza por epsilon a dp=1 (ítem reducible). Lo modelamos como una
        # transición de símbolo 'ε' para que la subset-construction siga siendo
        # válida (mismo patrón que el código LR0 existente).
        if rhs == ("ε",) and dp == 0:
            advanced = (it[0], it[1], rhs, 1)
            transitions.append((it, "ε", advanced))
            if advanced not in items:
                items.add(advanced)
                queue.append(advanced)

    return list(items), transitions, accept_item


# ---------------------------------------------------------------------------
# LR(1)
# ---------------------------------------------------------------------------

def build_lr1_nfa(grammar, start_symbol):
    """Como LR(0) pero con lookahead. Items: (rule_num, lhs, rhs_tuple, dot_pos, lookahead)."""
    aug_lhs = start_symbol + "'"
    start_item = (-1, aug_lhs, (start_symbol,), 0, "$")
    accept_item = (-1, aug_lhs, (start_symbol,), 1, "$")

    items = {start_item}
    transitions = []
    queue = deque([start_item])

    while queue:
        it = queue.popleft()
        rn, lhs, rhs, dp, la = it

        if dp < len(rhs):
            sym = rhs[dp]
            advanced = (rn, lhs, rhs, dp + 1, la)
            transitions.append((it, sym, advanced))
            if advanced not in items:
                items.add(advanced)
                queue.append(advanced)

            if sym in grammar:
                beta = list(rhs[dp + 1:]) + [la]
                first_beta = compute_first_sequence(beta, grammar)
                for prod_num, prod_rhs in grammar[sym]:
                    for b in first_beta:
                        if b == "ε":
                            continue
                        eps_target = (prod_num, sym, tuple(prod_rhs), 0, b)
                        transitions.append((it, "ε", eps_target))
                        if eps_target not in items:
                            items.add(eps_target)
                            queue.append(eps_target)

        if rhs == ("ε",) and dp == 0:
            advanced = (rn, lhs, rhs, 1, la)
            transitions.append((it, "ε", advanced))
            if advanced not in items:
                items.add(advanced)
                queue.append(advanced)

    return list(items), transitions, accept_item


# ---------------------------------------------------------------------------
# Serialización a DOT
# ---------------------------------------------------------------------------

def _escape(s) -> str:
    return (
        str(s)
        .replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
    )


def _sanitize_id(s):
    """Mapea cualquier string a un identificador DOT seguro (alfanumérico + '_')."""
    out = []
    for ch in str(s):
        if ch.isalnum() or ch == "_":
            out.append(ch)
        else:
            out.append(f"x{ord(ch):x}")
    return "".join(out) or "_"


def _item_id(it):
    if len(it) == 5:
        rn, _lhs, _rhs, dp, la = it
        return f"i_{_sanitize_id(rn)}_{dp}_{_sanitize_id(la)}"
    rn, _lhs, _rhs, dp = it
    return f"i_{_sanitize_id(rn)}_{dp}"


def _item_label(it):
    if len(it) == 5:
        _rn, lhs, rhs, dp, la = it
    else:
        _rn, lhs, rhs, dp = it
        la = None
    parts = list(rhs)
    parts.insert(dp, "•")
    body = " ".join(parts).replace("ε", "epsilon")
    if la is not None:
        return f"[{lhs} → {body}, {la}]"
    return f"{lhs} → {body}"


def nfa_to_dot(items, transitions, accept_item):
    """Serializa el AFN a un grafo Graphviz."""
    if not items:
        return 'digraph NFA { label="(AFN vacío)"; }'

    lines = [
        "digraph NFA {",
        '  rankdir="LR";',
        '  bgcolor="transparent";',
        '  node [shape=box, style="rounded,filled", fontname="monospace", '
        'fontsize=10, fillcolor="#dbeafe", color="#3b82f6"];',
        '  edge [fontname="monospace", fontsize=9, color="#6c757d"];',
        "",
        '  _entry [shape=point, width=0.01, height=0.01, color="#28a745"];',
    ]

    accept_id = _item_id(accept_item) if accept_item else None
    # IDs únicos por ítem (puede haber colisiones si dos ítems comparten la "key")
    # — el formato del ID es estable porque incluye rule, dot y opcional lookahead.
    seen_ids = set()
    for it in items:
        nid = _item_id(it)
        if nid in seen_ids:
            continue
        seen_ids.add(nid)
        label = _item_label(it)
        extra = ""
        if accept_id and nid == accept_id:
            extra = ', peripheries=2, fillcolor="#d4edda", color="#198754"'
        lines.append(f'  {nid} [id="{nid}", label="{_escape(label)}"{extra}];')

    # Entry arrow → start (que está en items[0] por construcción del BFS)
    if items:
        start_id = _item_id(items[0])
        lines.append(f'  _entry -> {start_id} [color="#28a745", penwidth=2];')

    lines.append("")

    # Dedup de transiciones (puede haber duplicados si dos rutas BFS las generaron)
    seen_edges = set()
    for src, lbl, dst in transitions:
        key = (_item_id(src), lbl, _item_id(dst))
        if key in seen_edges:
            continue
        seen_edges.add(key)

        if lbl == "ε":
            style = 'style=dashed, color="#94a3b8", fontcolor="#94a3b8"'
        else:
            # heurística: si el label es una sola letra minúscula/mixto sin mayúscula → terminal
            is_terminal = not (lbl and lbl[0].isupper())
            color = "#0d6efd" if is_terminal else "#198754"
            style = f'color="{color}", fontcolor="{color}"'
        lines.append(
            f'  {_item_id(src)} -> {_item_id(dst)} [label="{_escape(lbl)}", {style}];'
        )

    lines.append("}")
    return "\n".join(lines)
