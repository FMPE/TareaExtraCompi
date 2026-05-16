"""
Parser Predictivo LL(1).

Reutiliza process_grammar, get_symbols, compute_first, compute_first_sequence
del módulo lr1_parser.
Implementa FOLLOW, tabla de parsing LL(1) y parsing con pila explícita.
"""

from collections import defaultdict
from lr1_parser import (
    load_grammar_from_string,
    process_grammar,
    get_symbols,
    compute_first,
    compute_first_sequence,
    clear_first_cache,
    FIRST,
)


# ---------------------------------------------------------------------------
# Detección de recursión izquierda directa
# ---------------------------------------------------------------------------

def check_left_recursion(grammar):
    """Detecta recursión izquierda directa."""
    left_recursive = []
    for nt, productions in grammar.items():
        for _rule_num, rhs in productions:
            if rhs and rhs[0] == nt:
                left_recursive.append(nt)
                break
    return left_recursive


# ---------------------------------------------------------------------------
# Cálculo de FOLLOW sets
# ---------------------------------------------------------------------------

def compute_follow_sets(grammar, first_sets, start_symbol):
    """
    Calcula los conjuntos FOLLOW para todos los no-terminales.
    
    Reglas:
    1. $ ∈ FOLLOW(S) para el símbolo inicial S.
    2. Si A -> αBβ, entonces FIRST(β) - {ε} ⊆ FOLLOW(B).
    3. Si A -> αB, o A -> αBβ donde ε ∈ FIRST(β), entonces FOLLOW(A) ⊆ FOLLOW(B).
    """
    follow = {nt: set() for nt in grammar}
    follow[start_symbol].add("$")

    changed = True
    while changed:
        changed = False
        for nt, productions in grammar.items():
            for _rule_num, rhs in productions:
                for i, symbol in enumerate(rhs):
                    if symbol in grammar:  # es no-terminal
                        beta = rhs[i + 1:]

                        if beta:
                            first_beta = compute_first_sequence(beta, grammar)
                            new_symbols = (first_beta - {"ε"}) - follow[symbol]
                            if new_symbols:
                                follow[symbol] |= new_symbols
                                changed = True

                            if "ε" in first_beta:
                                new_symbols = follow[nt] - follow[symbol]
                                if new_symbols:
                                    follow[symbol] |= new_symbols
                                    changed = True
                        else:
                            # A -> αB (B es el último símbolo)
                            new_symbols = follow[nt] - follow[symbol]
                            if new_symbols:
                                follow[symbol] |= new_symbols
                                changed = True

    return follow


# ---------------------------------------------------------------------------
# Construcción de la tabla LL(1)
# ---------------------------------------------------------------------------

def build_ll1_table(grammar, rules, first_sets, follow_sets, terminals, non_terminals):
    """
    Construye la tabla de parsing LL(1): M[A, a] = producción a aplicar.
    
    Para cada producción A -> α:
    - Para cada terminal a ∈ FIRST(α), agregar A -> α a M[A, a].
    - Si ε ∈ FIRST(α), para cada terminal b ∈ FOLLOW(A), agregar A -> α a M[A, b].
    - Si ε ∈ FIRST(α) y $ ∈ FOLLOW(A), agregar A -> α a M[A, $].
    
    Retorna (table, conflicts) donde conflicts es lista de conflictos encontrados.
    """
    table = {}
    conflicts = []
    all_terminals = list(terminals) + ["$"]

    for nt in non_terminals:
        table[nt] = {}

    for rule_num, lhs, rhs in rules:
        first_alpha = compute_first_sequence(rhs, grammar)

        for terminal in first_alpha:
            if terminal != "ε":
                if terminal in table[lhs] and table[lhs][terminal] != (rule_num, lhs, rhs):
                    existing = table[lhs][terminal]
                    conflicts.append({
                        "non_terminal": lhs,
                        "terminal": terminal,
                        "existing_rule": {
                            "rule_num": existing[0],
                            "lhs": existing[1],
                            "rhs": existing[2],
                        },
                        "conflicting_rule": {
                            "rule_num": rule_num,
                            "lhs": lhs,
                            "rhs": rhs,
                        },
                        "message": f"Conflicto en M[{lhs}, {terminal}]: "
                                   f"regla {existing[0]} ({existing[1]} -> {' '.join(existing[2])}) "
                                   f"vs regla {rule_num} ({lhs} -> {' '.join(rhs)})",
                    })
                table[lhs][terminal] = (rule_num, lhs, rhs)

        if "ε" in first_alpha:
            for terminal in follow_sets.get(lhs, set()):
                if terminal in table[lhs] and table[lhs][terminal] != (rule_num, lhs, rhs):
                    existing = table[lhs][terminal]
                    conflicts.append({
                        "non_terminal": lhs,
                        "terminal": terminal,
                        "existing_rule": {
                            "rule_num": existing[0],
                            "lhs": existing[1],
                            "rhs": existing[2],
                        },
                        "conflicting_rule": {
                            "rule_num": rule_num,
                            "lhs": lhs,
                            "rhs": rhs,
                        },
                        "message": f"Conflicto en M[{lhs}, {terminal}]: "
                                   f"regla {existing[0]} ({existing[1]} -> {' '.join(existing[2])}) "
                                   f"vs regla {rule_num} ({lhs} -> {' '.join(rhs)})",
                    })
                table[lhs][terminal] = (rule_num, lhs, rhs)

    return table, conflicts


# ---------------------------------------------------------------------------
# Parser LL(1) con pila explícita
# ---------------------------------------------------------------------------

def ll1_parse(input_tokens, parsing_table, rules, start_symbol, terminals):
    """
    Ejecuta el algoritmo de parsing LL(1) con pila explícita.
    
    Retorna (trace, valid).
    """
    stack = ["$", start_symbol]
    input_list = list(input_tokens) + ["$"]
    index = 0
    trace = []
    step = 0

    while True:
        step += 1
        top = stack[-1]
        current_token = input_list[index] if index < len(input_list) else "$"

        if top == "$" and current_token == "$":
            trace.append({
                "step": step,
                "stack": stack[:],
                "remaining_input": input_list[index:],
                "action": "Accept",
                "type": "accept",
            })
            return trace, True

        if top == "$" and current_token != "$":
            trace.append({
                "step": step,
                "stack": stack[:],
                "remaining_input": input_list[index:],
                "action": f"Error: pila vacía pero quedan tokens: {current_token}",
                "type": "error",
            })
            return trace, False

        # Top es terminal
        if top not in parsing_table:
            if top == current_token:
                stack.pop()
                trace.append({
                    "step": step,
                    "stack": stack[:],
                    "remaining_input": input_list[index:],
                    "action": f"Match terminal '{top}'",
                    "type": "match",
                    "matched_token": top,
                })
                index += 1
                continue
            else:
                trace.append({
                    "step": step,
                    "stack": stack[:],
                    "remaining_input": input_list[index:],
                    "action": f"Error: esperaba '{top}', encontró '{current_token}'",
                    "type": "error",
                })
                return trace, False

        # Top es no-terminal — buscar en tabla
        if current_token not in parsing_table[top]:
            trace.append({
                "step": step,
                "stack": stack[:],
                "remaining_input": input_list[index:],
                "action": f"Error: no hay entrada en M[{top}, {current_token}]",
                "type": "error",
            })
            return trace, False

        rule_num, lhs, rhs = parsing_table[top][current_token]
        stack.pop()

        rule_str = f"{lhs} -> {' '.join(rhs)}"

        if rhs != ["ε"]:
            # Pushear los símbolos en orden inverso
            for symbol in reversed(rhs):
                stack.append(symbol)

        trace.append({
            "step": step,
            "stack": stack[:],
            "remaining_input": input_list[index:],
            "action": f"Predict regla {rule_num}: {rule_str}",
            "type": "predict",
            "rule_num": rule_num,
            "rule_lhs": lhs,
            "rule_rhs": rhs,
        })

    return trace, False


# ---------------------------------------------------------------------------
# Función pública principal
# ---------------------------------------------------------------------------

def ll1_parse_from_text(grammar_text, input_text):
    """
    Función de alto nivel que recibe texto de gramática e input,
    y retorna el resultado completo del parsing LL(1).
    """
    clear_first_cache()

    lines = load_grammar_from_string(grammar_text)
    grammar, rules = process_grammar(lines)
    non_terminals, terminals = get_symbols(grammar)
    start_symbol = non_terminals[0]

    # Detectar recursión izquierda
    lr = check_left_recursion(grammar)
    if lr:
        return {
            "success": False,
            "error": f"La gramática tiene recursión izquierda directa en: {', '.join(lr)}. "
                     f"El parser LL(1) no soporta recursión izquierda. "
                     f"Elimine la recursión izquierda antes de usar este parser.",
            "left_recursive_symbols": lr,
        }

    # Calcular FIRST
    for nt in non_terminals:
        compute_first(nt, grammar)

    first_sets = {nt: compute_first(nt, grammar) for nt in non_terminals}

    # Calcular FOLLOW
    follow_sets = compute_follow_sets(grammar, first_sets, start_symbol)

    # Construir tabla LL(1)
    parsing_table, conflicts = build_ll1_table(
        grammar, rules, first_sets, follow_sets, terminals, non_terminals
    )

    # Serializar tabla para JSON
    table_json = {}
    for nt in parsing_table:
        table_json[nt] = {}
        for terminal in parsing_table[nt]:
            rule_num, lhs, rhs = parsing_table[nt][terminal]
            table_json[nt][terminal] = {
                "rule_num": rule_num,
                "production": f"{lhs} -> {' '.join(rhs)}",
                "lhs": lhs,
                "rhs": rhs,
            }

    # Parsear
    input_tokens = input_text.strip().split()
    trace, valid = ll1_parse(input_tokens, parsing_table, rules, start_symbol, terminals)

    return {
        "success": True,
        "valid": valid,
        "trace": trace,
        "grammar": {
            "rules": [{"rule_num": r[0], "lhs": r[1], "rhs": r[2]} for r in rules],
            "non_terminals": non_terminals,
            "terminals": terminals,
        },
        "first_sets": {nt: sorted(list(s)) for nt, s in first_sets.items()},
        "follow_sets": {nt: sorted(list(s)) for nt, s in follow_sets.items()},
        "parsing_table": table_json,
        "conflicts": conflicts,
        "input_tokens": input_tokens,
        "parser_type": "ll1",
    }
