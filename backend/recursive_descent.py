"""
Descenso recursivo (predictivo con FIRST/FOLLOW, misma clase que LL(1)).
La traza muestra llamadas, expansiones y coincidencias con terminales.
"""
from grammar_common import clear_first_cache, compute_first

from ll1_parser import build_ll1_table, parse_table_to_json


def run_recursive_descent(grammar_text, input_text):
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

    inp = list(tokens) + ["$"]
    trace = []

    def parse_nt(A, pos, depth):
        indent = "  " * depth
        trace.append(
            {
                "stack": [f"{indent}call {A}"],
                "remaining_input": inp[pos:],
                "action": f"Llamada parse({A})",
                "type": "call",
                "explain": f"Se intenta derivar el no terminal {A} desde la posición {pos}.",
            }
        )
        a = inp[pos] if pos < len(inp) else "$"
        prods = M[A].get(a, [])
        if not prods:
            trace.append(
                {
                    "stack": [f"{indent}call {A}"],
                    "remaining_input": inp[pos:],
                    "action": f"Error: no hay producción para ({A}, {a})",
                    "type": "error",
                    "explain": "No hay fila en la tabla LL(1) para este par (no terminal, lookahead).",
                }
            )
            return pos, False, None
        if len(prods) > 1:
            trace.append(
                {
                    "stack": [f"{indent}call {A}"],
                    "remaining_input": inp[pos:],
                    "action": "Error: gramática no LL(1) (ambigüedad)",
                    "type": "error",
                    "explain": "Varias producciones compiten: la gramática no es LL(1).",
                }
            )
            return pos, False, None

        rule_num, lhs, rhs = prods[0]
        trace.append(
            {
                "stack": [f"{indent}call {A}"],
                "remaining_input": inp[pos:],
                "action": f"Elegir regla {rule_num}: {lhs} → {' '.join(rhs)}",
                "type": "expand",
                "rule_num": rule_num,
                "rule_lhs": lhs,
                "rule_rhs": rhs,
                "explain": f"Aplicar la producción {lhs} → {' '.join(rhs)} (regla {rule_num}).",
            }
        )

        cur = pos
        children = []
        for sym in rhs:
            if sym == "ε":
                children.append({"kind": "epsilon", "label": "ε"})
                continue
            if sym not in grammar:
                if cur >= len(inp) or inp[cur] != sym:
                    trace.append(
                        {
                            "stack": [f"{indent}call {A}"],
                            "remaining_input": inp[cur:],
                            "action": f"Error: se esperaba '{sym}'",
                            "type": "error",
                            "explain": "El token de entrada no coincide con el terminal de la producción.",
                        }
                    )
                    return cur, False, None
                trace.append(
                    {
                        "stack": [f"{indent}call {A}"],
                        "remaining_input": inp[cur:],
                        "action": f"Coincidir terminal '{sym}'",
                        "type": "match",
                        "explain": f"Consumir el terminal «{sym}» de la entrada.",
                    }
                )
                children.append({"kind": "terminal", "label": sym, "lexeme": sym})
                cur += 1
            else:
                cur, ok, sub = parse_nt(sym, cur, depth + 1)
                if not ok:
                    return cur, False, None
                children.append(sub)

        node = {"kind": "nonterminal", "label": lhs, "rule_num": rule_num, "children": children}
        trace.append(
            {
                "stack": [f"{indent}return {A}"],
                "remaining_input": inp[cur:],
                "action": f"Retorno de parse({A})",
                "type": "return",
                "explain": f"Se completó el análisis del subárbol con raíz {lhs}.",
            }
        )
        return cur, True, node

    ok_start = False
    root = None
    if start in non_terminals:
        end_pos, ok_start, root = parse_nt(start, 0, 0)
        if ok_start and end_pos == len(inp) - 1:
            trace.append(
                {
                    "stack": ["$"],
                    "remaining_input": ["$"],
                    "action": "Aceptar",
                    "type": "accept",
                    "explain": "Toda la entrada fue consumida correctamente.",
                }
            )
        elif ok_start:
            trace.append(
                {
                    "stack": [],
                    "remaining_input": inp[end_pos:],
                    "action": "Error: sobran tokens tras analizar el axioma",
                    "type": "error",
                    "explain": "El axioma se derivó pero quedaron símbolos sin leer.",
                }
            )
            ok_start = False
            root = None
    valid = ok_start

    return {
        "parser": "rd",
        "parser_family": "topdown",
        "parser_label": "Descenso recursivo (predictivo)",
        "valid": valid,
        "trace": trace,
        "grammar": grammar_to_json(rules, non_terminals, terminals),
        "input_tokens": tokens,
        "parse_table": parse_table_to_json(M),
        "first_sets": {k: sorted(v) for k, v in gc.FIRST.items()},
        "follow_sets": {k: sorted(v) for k, v in follow.items()},
        "conflicts": conflicts,
        "parse_tree": root if valid else None,
        "derivation_tree": root if valid else None,
    }
