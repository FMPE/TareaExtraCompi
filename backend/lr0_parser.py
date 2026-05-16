"""
Parser LR(0).

Reutiliza load_grammar_from_string, process_grammar, get_symbols del módulo lr1_parser.
Reutiliza lr1_parse para el algoritmo de parsing stack-driven (idéntico al de LR(1)
una vez construidas las tablas ACTION/GOTO).

Diferencias clave vs LR(1):
- Los items NO llevan lookahead: [A -> α • β]
- closure() no propaga lookaheads
- En la tabla ACTION, un item reducible [A -> α•] genera REDUCE para TODOS los
  terminales (no hay lookahead), lo que produce frecuentes conflictos shift-reduce.
"""

from collections import defaultdict
from lr1_parser import (
    load_grammar_from_string,
    process_grammar,
    get_symbols,
    clear_first_cache,
    lr1_parse,
)


class LR0Item:
    def __init__(self, rule_num, lhs, rhs, dot_pos):
        self.rule_num = rule_num
        self.lhs = lhs
        self.rhs = rhs
        self.dot_pos = dot_pos

    def __eq__(self, other):
        return (self.rule_num == other.rule_num and
                self.dot_pos == other.dot_pos)

    def __hash__(self):
        return hash((self.rule_num, self.dot_pos))

    def __repr__(self):
        rhs_with_dot = self.rhs[:]
        rhs_with_dot.insert(self.dot_pos, "•")
        rhs_str = ' '.join(rhs_with_dot).replace('ε', 'epsilon')
        return f"[{self.lhs} -> {rhs_str}]"

    def to_dict(self):
        rhs_with_dot = self.rhs[:]
        rhs_with_dot.insert(self.dot_pos, "•")
        return {
            "rule_num": self.rule_num,
            "lhs": self.lhs,
            "rhs": self.rhs,
            "dot_pos": self.dot_pos,
            "display": f"[{self.lhs} -> {' '.join(rhs_with_dot).replace('ε', 'epsilon')}]",
        }

    def next_symbol(self):
        if self.dot_pos < len(self.rhs):
            return self.rhs[self.dot_pos]
        return None

    def is_reducible(self):
        return self.dot_pos == len(self.rhs)

    def advance_dot(self):
        return LR0Item(self.rule_num, self.lhs, self.rhs, self.dot_pos + 1)


def closure_lr0(items, grammar):
    result = set(items)
    changed = True
    while changed:
        changed = False
        new_items = set()
        for item in result:
            next_sym = item.next_symbol()
            if next_sym and next_sym in grammar:
                for rule_num, production in grammar[next_sym]:
                    new_item = LR0Item(rule_num, next_sym, production, 0)
                    if new_item not in result:
                        new_items.add(new_item)
                        changed = True
        result.update(new_items)

    epsilon_items = set()
    for item in result:
        if item.rhs == ["ε"] and item.dot_pos == 0:
            epsilon_items.add(LR0Item(item.rule_num, item.lhs, item.rhs, 1))
    result.update(epsilon_items)

    return result


def goto_lr0(items, symbol, grammar):
    new_items = set()
    for item in items:
        if item.next_symbol() == symbol:
            new_items.add(item.advance_dot())
    return closure_lr0(new_items, grammar)


def build_lr0_automaton(grammar, start_symbol):
    augmented_start = start_symbol + "'"
    start_item = LR0Item(-1, augmented_start, [start_symbol], 0)

    states = []
    state_map = {}
    transitions = {}

    initial_state = closure_lr0({start_item}, grammar)
    states.append(initial_state)
    state_map[frozenset(initial_state)] = 0

    queue = [initial_state]
    processed = set()

    while queue:
        current_state = queue.pop(0)
        current_index = state_map[frozenset(current_state)]

        if frozenset(current_state) in processed:
            continue
        processed.add(frozenset(current_state))

        symbols = set()
        for item in current_state:
            next_sym = item.next_symbol()
            if next_sym:
                symbols.add(next_sym)

        for symbol in symbols:
            new_state = goto_lr0(current_state, symbol, grammar)
            if new_state:
                frozen_new_state = frozenset(new_state)
                if frozen_new_state not in state_map:
                    state_map[frozen_new_state] = len(states)
                    states.append(new_state)
                    queue.append(new_state)

                new_index = state_map[frozen_new_state]
                transitions[(current_index, symbol)] = new_index

    return states, transitions


def build_lr0_parsing_table(states, transitions, grammar, rules, terminals, non_terminals):
    """
    Construye las tablas ACTION y GOTO para LR(0).

    Diferencia vs LR(1): las reducciones se aplican a TODOS los terminales (incluido $),
    ya que LR(0) no usa lookahead.

    Retorna (action, goto, conflicts).
    """
    action = defaultdict(dict)
    goto = defaultdict(dict)
    conflicts = []

    augmented_start = non_terminals[0] + "'"
    all_terminals = list(terminals) + ["$"]

    def _register_conflict(state_idx, symbol, existing, new):
        existing_type, existing_value = existing
        new_type, new_value = new
        if existing_type == "shift" and new_type == "reduce":
            kind = "shift-reduce"
        elif existing_type == "reduce" and new_type == "shift":
            kind = "shift-reduce"
        elif existing_type == "reduce" and new_type == "reduce":
            kind = "reduce-reduce"
        else:
            kind = f"{existing_type}-{new_type}"
        msg = (f"Conflicto {kind} en ACTION[{state_idx}, {symbol}]: "
               f"existente={existing_type} {existing_value}, nuevo={new_type} {new_value}")
        conflicts.append({
            "state": state_idx,
            "symbol": symbol,
            "kind": kind,
            "existing": {"type": existing_type, "value": existing_value},
            "new": {"type": new_type, "value": new_value},
            "message": msg,
        })

    for i, state in enumerate(states):
        for item in state:
            if item.is_reducible():
                if item.lhs == augmented_start:
                    new_entry = ("accept", None)
                    if "$" in action[i] and action[i]["$"] != new_entry:
                        _register_conflict(i, "$", action[i]["$"], new_entry)
                    else:
                        action[i]["$"] = new_entry
                elif item.rule_num >= 0:
                    new_entry = ("reduce", item.rule_num)
                    for terminal in all_terminals:
                        if terminal in action[i] and action[i][terminal] != new_entry:
                            _register_conflict(i, terminal, action[i][terminal], new_entry)
                        else:
                            action[i][terminal] = new_entry
            else:
                next_sym = item.next_symbol()
                if next_sym and next_sym in terminals and (i, next_sym) in transitions:
                    next_state = transitions[(i, next_sym)]
                    new_entry = ("shift", next_state)
                    if next_sym in action[i] and action[i][next_sym] != new_entry:
                        _register_conflict(i, next_sym, action[i][next_sym], new_entry)
                    else:
                        action[i][next_sym] = new_entry

        for nt in non_terminals:
            if (i, nt) in transitions:
                goto[i][nt] = transitions[(i, nt)]

    return action, goto, conflicts


def lr0_parse_from_text(grammar_text, input_text):
    """
    Función de alto nivel que recibe texto de gramática e input,
    y retorna el resultado completo del parsing LR(0).
    """
    clear_first_cache()

    lines = load_grammar_from_string(grammar_text)
    grammar, rules = process_grammar(lines)
    non_terminals, terminals = get_symbols(grammar)
    start_symbol = non_terminals[0]

    states, transitions = build_lr0_automaton(grammar, start_symbol)
    action_table, goto_table, conflicts = build_lr0_parsing_table(
        states, transitions, grammar, rules, terminals, non_terminals
    )

    input_tokens = input_text.strip().split()
    trace, valid = lr1_parse(input_tokens, action_table, goto_table, rules, start_symbol)

    states_json = []
    for i, state in enumerate(states):
        states_json.append({
            "state_num": i,
            "items": [item.to_dict() for item in state],
        })

    action_json = {}
    for state in action_table:
        action_json[str(state)] = {}
        for terminal in action_table[state]:
            action_type, action_value = action_table[state][terminal]
            action_json[str(state)][terminal] = {
                "type": action_type,
                "value": action_value,
            }

    goto_json = {}
    for state in goto_table:
        goto_json[str(state)] = dict(goto_table[state])

    return {
        "success": True,
        "valid": valid,
        "trace": trace,
        "grammar": {
            "rules": [{"rule_num": r[0], "lhs": r[1], "rhs": r[2]} for r in rules],
            "non_terminals": non_terminals,
            "terminals": terminals,
        },
        "states": states_json,
        "action_table": action_json,
        "goto_table": goto_json,
        "conflicts": conflicts,
        "input_tokens": input_tokens,
        "parser_type": "lr0",
    }
