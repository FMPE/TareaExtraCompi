"""
Recursive Descent Parser with Backtracking.

Reutiliza process_grammar, get_symbols, compute_first del módulo lr1_parser.
Genera traza paso a paso y árbol de derivación.
Detecta recursión izquierda directa.
"""

from lr1_parser import (
    load_grammar_from_string,
    process_grammar,
    get_symbols,
    compute_first,
    clear_first_cache,
)


# ---------------------------------------------------------------------------
# Detección de recursión izquierda directa
# ---------------------------------------------------------------------------

def check_left_recursion(grammar):
    """
    Detecta recursión izquierda directa.
    Retorna lista de no-terminales que tienen recursión izquierda directa.
    """
    left_recursive = []
    for nt, productions in grammar.items():
        for _rule_num, rhs in productions:
            if rhs and rhs[0] == nt:
                left_recursive.append(nt)
                break
    return left_recursive


# ---------------------------------------------------------------------------
# Parser de Descenso Recursivo con Backtracking
# ---------------------------------------------------------------------------

class RecursiveDescentParser:
    """Parser de descenso recursivo con backtracking completo."""

    def __init__(self, grammar, rules, start_symbol, non_terminals, terminals):
        self.grammar = grammar
        self.rules = rules
        self.start_symbol = start_symbol
        self.non_terminals = non_terminals
        self.terminals = terminals
        self.tokens = []
        self.pos = 0
        self.trace = []
        self.step_counter = 0
        self.max_depth = 500  # protección contra recursión infinita

    def _add_trace(self, trace_type, message, depth, **extra):
        self.step_counter += 1
        entry = {
            "step": self.step_counter,
            "type": trace_type,
            "action": message,
            "position": self.pos,
            "current_token": self.tokens[self.pos] if self.pos < len(self.tokens) else "$",
            "remaining_input": self.tokens[self.pos:],
            "depth": depth,
        }
        entry.update(extra)
        self.trace.append(entry)

    def parse(self, input_tokens):
        """
        Ejecuta el parsing de descenso recursivo.
        Retorna (trace, valid, parse_tree).
        """
        self.tokens = list(input_tokens) + ["$"]
        self.pos = 0
        self.trace = []
        self.step_counter = 0

        success, tree = self._parse_symbol(self.start_symbol, 0)

        if success and self.pos < len(self.tokens) and self.tokens[self.pos] == "$":
            self._add_trace("accept", "Cadena aceptada", 0)
            return self.trace, True, tree
        elif success and self.pos < len(self.tokens) and self.tokens[self.pos] != "$":
            self._add_trace(
                "error",
                f"Cadena parcialmente consumida. Tokens restantes: {self.tokens[self.pos:]}",
                0,
            )
            return self.trace, False, None
        else:
            self._add_trace("error", "Cadena rechazada", 0)
            return self.trace, False, None

    def _parse_symbol(self, symbol, depth):
        """
        Intenta parsear un símbolo (terminal o no-terminal).
        Retorna (success, parse_tree_node).
        """
        if depth > self.max_depth:
            self._add_trace(
                "error",
                f"Profundidad máxima alcanzada al intentar expandir '{symbol}'",
                depth,
            )
            return False, None

        # Terminal
        if symbol not in self.grammar:
            return self._match_terminal(symbol, depth)

        # No-terminal: intentar cada producción
        return self._expand_nonterminal(symbol, depth)

    def _match_terminal(self, symbol, depth):
        """Intenta hacer match de un terminal con el token actual."""
        if symbol == "ε":
            self._add_trace(
                "match",
                f"Match ε (epsilon) — no se consume token",
                depth,
                symbol=symbol,
            )
            return True, {"type": "terminal", "value": "ε"}

        current = self.tokens[self.pos] if self.pos < len(self.tokens) else None
        if current == symbol:
            self._add_trace(
                "match",
                f"Match terminal '{symbol}' con token '{current}'",
                depth,
                symbol=symbol,
            )
            self.pos += 1
            return True, {"type": "terminal", "value": symbol}
        else:
            self._add_trace(
                "fail_match",
                f"Fallo match: esperaba '{symbol}', encontró '{current}'",
                depth,
                symbol=symbol,
            )
            return False, None

    def _expand_nonterminal(self, nt, depth):
        """
        Intenta expandir un no-terminal probando cada producción.
        Si una falla, hace backtracking y prueba la siguiente.
        """
        self._add_trace(
            "enter",
            f"Entrar a no-terminal '{nt}'",
            depth,
            symbol=nt,
        )

        productions = self.grammar[nt]

        for rule_num, rhs in productions:
            saved_pos = self.pos
            saved_trace_len = len(self.trace)

            rule_str = f"{nt} -> {' '.join(rhs)}"
            self._add_trace(
                "try_production",
                f"Intentar producción {rule_num}: {rule_str}",
                depth,
                rule_num=rule_num,
                production=rule_str,
            )

            success, children = self._try_production(nt, rhs, depth)

            if success:
                self._add_trace(
                    "exit_success",
                    f"Éxito con '{nt}' usando producción {rule_num}: {rule_str}",
                    depth,
                    rule_num=rule_num,
                )
                tree_node = {
                    "type": "nonterminal",
                    "symbol": nt,
                    "rule_num": rule_num,
                    "production": rule_str,
                    "children": children,
                }
                return True, tree_node
            else:
                # Backtracking
                if self.pos != saved_pos:
                    self._add_trace(
                        "backtrack",
                        f"Backtrack en '{nt}': retroceder posición {self.pos} → {saved_pos}",
                        depth,
                        from_pos=self.pos,
                        to_pos=saved_pos,
                    )
                    self.pos = saved_pos

        self._add_trace(
            "exit_fail",
            f"Fallo: ninguna producción de '{nt}' tuvo éxito",
            depth,
            symbol=nt,
        )
        return False, None

    def _try_production(self, nt, rhs, depth):
        """
        Intenta hacer match de todos los símbolos de una producción.
        Retorna (success, children_list).
        """
        children = []
        for symbol in rhs:
            success, child = self._parse_symbol(symbol, depth + 1)
            if not success:
                return False, None
            children.append(child)
        return True, children


# ---------------------------------------------------------------------------
# Función pública principal
# ---------------------------------------------------------------------------

def recursive_descent_parse_from_text(grammar_text, input_text):
    """
    Función de alto nivel que recibe texto de gramática e input,
    y retorna el resultado completo del parsing por descenso recursivo.
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
                     f"El parser de descenso recursivo no soporta recursión izquierda. "
                     f"Elimine la recursión izquierda antes de usar este parser.",
            "left_recursive_symbols": lr,
        }

    # Computar FIRST para información
    for nt in non_terminals:
        compute_first(nt, grammar)

    input_tokens = input_text.strip().split()

    parser = RecursiveDescentParser(grammar, rules, start_symbol, non_terminals, terminals)
    trace, valid, parse_tree = parser.parse(input_tokens)

    return {
        "success": True,
        "valid": valid,
        "trace": trace,
        "parse_tree": parse_tree,
        "grammar": {
            "rules": [{"rule_num": r[0], "lhs": r[1], "rhs": r[2]} for r in rules],
            "non_terminals": non_terminals,
            "terminals": terminals,
        },
        "input_tokens": input_tokens,
        "parser_type": "recursive_descent",
    }
