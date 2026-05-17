"""Parser predictivo LL(1): tablas M[A,a], FIRST/FOLLOW y traza."""
from collections import defaultdict

from grammar_common import (
    clear_first_cache,
    compute_first,
    compute_first_sequence,
    compute_follow,
)


def build_ll1_table(grammar, rules, non_terminals, terminals, start):
    follow = compute_follow(grammar, rules, non_terminals, start)
    M = defaultdict(lambda: defaultdict(list))
    conflicts = []

    for rule_num, lhs, rhs in rules:
        first_alpha = compute_first_sequence(rhs, grammar)
        for b in first_alpha - {"ε"}:
            M[lhs][b].append((rule_num, lhs, rhs))
        if "ε" in first_alpha:
            for b in follow[lhs]:
                M[lhs][b].append((rule_num, lhs, rhs))

    for A in M:
        for a in list(M[A].keys()):
            prods = M[A][a]
            if len(prods) > 1:
                conflicts.append(
                    {
                        "non_terminal": A,
                        "symbol": a,
                        "message": f"Conflicto LL(1): {len(prods)} producciones en M[{A},{a}]",
                    }
                )
    return M, follow, conflicts


def ll1_parse_tokens(tokens, M, start):
    """Análisis LL(1) con pila; traza con tipos expand/match/accept/error."""
    inp = list(tokens) + ["$"]
    stack = ["$", start]
    pos = 0
    trace = []

    while stack:
        top = stack[-1]
        a = inp[pos] if pos < len(inp) else "$"

        if top == "$":
            if a == "$":
                trace.append(
                    {
                        "stack": stack[:],
                        "remaining_input": inp[pos:],
                        "action": "Aceptar",
                        "type": "accept",
                        "explain": "Pila y entrada reducidas a $: fin del análisis LL(1).",
                    }
                )
                return trace, True
            trace.append(
                {
                    "stack": stack[:],
                    "remaining_input": inp[pos:],
                    "action": "Error: se esperaba fin de entrada",
                    "type": "error",
                }
            )
            return trace, False

        if top not in M and top != a:
            trace.append(
                {
                    "stack": stack[:],
                    "remaining_input": inp[pos:],
                    "action": f"Error: terminal inesperado (pila={top}, entrada={a})",
                    "type": "error",
                }
            )
            return trace, False

        if top not in M:
            if top == a:
                stack.pop()
                trace.append(
                    {
                        "stack": stack[:],
                        "remaining_input": inp[pos:],
                        "action": f"Coincidir terminal '{a}'",
                        "type": "match",
                        "explain": "La cima de la pila es un terminal igual al lookahead: se consume de la entrada.",
                    }
                )
                pos += 1
            else:
                trace.append(
                    {
                        "stack": stack[:],
                        "remaining_input": inp[pos:],
                        "action": f"Error: se esperaba {top}, se obtuvo {a}",
                        "type": "error",
                    }
                )
                return trace, False
            continue

        prods = M[top].get(a, [])
        if not prods:
            trace.append(
                {
                    "stack": stack[:],
                    "remaining_input": inp[pos:],
                    "action": f"Error: M[{top},{a}] está vacío",
                    "type": "error",
                }
            )
            return trace, False

        if len(prods) > 1:
            trace.append(
                {
                    "stack": stack[:],
                    "remaining_input": inp[pos:],
                    "action": "Error: conflicto LL(1) en tabla",
                    "type": "error",
                }
            )
            return trace, False

        rule_num, lhs, rhs = prods[0]
        stack.pop()
        push_syms = [s for s in reversed(rhs) if s != "ε"]
        for s in push_syms:
            stack.append(s)
        trace.append(
            {
                "stack": stack[:],
                "remaining_input": inp[pos:],
                "action": f"Expandir {lhs} → {' '.join(rhs).replace('ε', 'ε')}",
                "type": "expand",
                "rule_num": rule_num,
                "rule_lhs": lhs,
                "rule_rhs": rhs,
                "explain": f"Sustituir «{lhs}» por la secuencia de la regla {rule_num} (apilada al revés).",
            }
        )

    trace.append(
        {
            "stack": [],
            "remaining_input": inp[pos:],
            "action": "Error: pila vacía antes de aceptar",
            "type": "error",
        }
    )
    return trace, False


def parse_table_to_json(M):
    out = {}
    for A in sorted(M.keys()):
        out[A] = {}
        for a in sorted(M[A].keys()):
            cells = M[A][a]
            out[A][a] = [
                {"rule_num": r[0], "lhs": r[1], "rhs": r[2]}
                for r in cells
            ]
    return out


def build_ll_derivation_tree(tokens, M, grammar, start):
    """Árbol de derivación (izquierda) coherente con la tabla LL(1)."""
    inp = list(tokens) + ["$"]
    pos = 0

    def parse_nt(A):
        nonlocal pos
        if pos >= len(inp):
            return None
        a = inp[pos]
        if a not in M[A]:
            return None
        prods = M[A][a]
        if len(prods) != 1:
            return None
        rule_num, lhs, rhs = prods[0]
        children = []
        for sym in rhs:
            if sym == "ε":
                children.append({"kind": "epsilon", "label": "ε"})
                continue
            if sym not in grammar:
                if pos >= len(inp) or inp[pos] != sym:
                    return None
                children.append({"kind": "terminal", "label": sym, "lexeme": sym})
                pos += 1
            else:
                sub = parse_nt(sym)
                if sub is None:
                    return None
                children.append(sub)
        return {"kind": "nonterminal", "label": lhs, "rule_num": rule_num, "children": children}

    root = parse_nt(start)
    ok = root is not None and pos == len(inp) - 1
    return ok, root if ok else None


def run_ll1(grammar_text, input_text):
    import grammar_common as gc

    from grammar_common import (
        load_grammar_from_string,
        process_grammar,
        get_symbols,
        grammar_to_json,
    )

    clear_first_cache()
    lines = load_grammar_from_string(grammar_text)
    grammar, rules = process_grammar(lines)
    non_terminals, terminals = get_symbols(grammar)
    start = non_terminals[0]
    for nt in non_terminals:
        compute_first(nt, grammar)

    M, follow, conflicts = build_ll1_table(grammar, rules, non_terminals, terminals, start)
    tokens = input_text.strip().split()
    trace, valid = ll1_parse_tokens(tokens, M, start)
    tree_ok, drv_tree = build_ll_derivation_tree(tokens, M, grammar, start)
    parse_tree = drv_tree if (valid and tree_ok) else None

    return {
        "parser": "ll1",
        "parser_family": "topdown",
        "parser_label": "LL(1)",
        "valid": valid,
        "trace": trace,
        "grammar": grammar_to_json(rules, non_terminals, terminals),
        "input_tokens": tokens,
        "parse_table": parse_table_to_json(M),
        "first_sets": {k: sorted(v) for k, v in gc.FIRST.items()},
        "follow_sets": {k: sorted(v) for k, v in follow.items()},
        "conflicts": conflicts,
        "parse_tree": parse_tree,
        "derivation_tree": parse_tree,
    }
