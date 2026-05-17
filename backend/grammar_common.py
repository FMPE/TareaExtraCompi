"""Utilidades compartidas: gramática, FIRST y FOLLOW."""
from collections import defaultdict

FIRST: dict = {}


def load_grammar(path):
    with open(path, "r", encoding="utf-8") as file:
        lines = [line.strip() for line in file if line.strip()]
    return lines


def load_grammar_from_string(grammar_text):
    lines = [line.strip() for line in grammar_text.split("\n") if line.strip()]
    return lines


def process_grammar(lines):
    grammar = {}
    rules = []
    for i, line in enumerate(lines):
        norm = (
            line.replace("→", "->")
            .replace("⟶", "->")
            .replace("⇒", "->")
            .replace("λ", "ε")
        )
        left, right = norm.split("->")
        left = left.strip()
        right = [sym.strip() for sym in right.strip().split()]
        rules.append((i, left, right))
        if left not in grammar:
            grammar[left] = []
        grammar[left].append((i, right))
    return grammar, rules


def get_symbols(grammar):
    non_terminals = list(grammar.keys())
    terminals = set()
    for productions in grammar.values():
        for _rule_num, prod in productions:
            for symbol in prod:
                if symbol not in grammar and symbol != "ε":
                    terminals.add(symbol)
    return non_terminals, list(terminals)


def clear_first_cache():
    global FIRST
    FIRST = {}


def compute_first_sequence(sequence, grammar):
    if not sequence:
        return {"ε"}

    result = set()
    for symbol in sequence:
        if symbol in FIRST:
            symbol_first = FIRST[symbol]
        elif symbol not in grammar:
            symbol_first = {symbol}
        else:
            symbol_first = compute_first(symbol, grammar)

        result |= (symbol_first - {"ε"})
        if "ε" not in symbol_first:
            break
    else:
        result.add("ε")
    return result


def compute_first(X, grammar):
    if X in FIRST:
        return FIRST[X]

    FIRST[X] = set()

    if X not in grammar:
        FIRST[X] = {X}
        return FIRST[X]

    for _rule_num, production in grammar[X]:
        first_prod = compute_first_sequence(production, grammar)
        FIRST[X] |= first_prod

    return FIRST[X]


def compute_follow(grammar, rules, non_terminals, start_symbol):
    """FOLLOW(A) para cada no terminal; incluye '$'."""
    follow = {nt: set() for nt in non_terminals}
    follow[start_symbol].add("$")

    changed = True
    while changed:
        changed = False
        for _rule_num, lhs, rhs in rules:
            for i, B in enumerate(rhs):
                if B not in grammar:
                    continue
                beta = rhs[i + 1 :]
                first_beta = compute_first_sequence(beta, grammar) if beta else {"ε"}
                for b in first_beta - {"ε"}:
                    if b not in follow[B]:
                        follow[B].add(b)
                        changed = True
                if "ε" in first_beta:
                    for x in follow[lhs]:
                        if x not in follow[B]:
                            follow[B].add(x)
                            changed = True
    return follow


def grammar_to_json(rules, non_terminals, terminals):
    return {
        "rules": [{"rule_num": r[0], "lhs": r[1], "rhs": r[2]} for r in rules],
        "non_terminals": non_terminals,
        "terminals": sorted(terminals),
    }
