"""LR(0): ítems, autómata, tablas ACTION/GOTO y análisis shift-reduce."""
from collections import defaultdict

from lr1_parser import lr1_parse  # misma máquina de parsing que LR(1)


class LR0Item:
    def __init__(self, rule_num, lhs, rhs, dot_pos):
        self.rule_num = rule_num
        self.lhs = lhs
        self.rhs = rhs
        self.dot_pos = dot_pos

    def __eq__(self, other):
        return (
            self.rule_num == other.rule_num
            and self.dot_pos == other.dot_pos
            and self.lhs == other.lhs
            and self.rhs == other.rhs
        )

    def __hash__(self):
        return hash((self.rule_num, self.lhs, tuple(self.rhs), self.dot_pos))

    def next_symbol(self):
        if self.dot_pos < len(self.rhs):
            return self.rhs[self.dot_pos]
        return None

    def is_reducible(self):
        return self.dot_pos == len(self.rhs)

    def advance_dot(self):
        return LR0Item(self.rule_num, self.lhs, self.rhs, self.dot_pos + 1)

    def to_dict(self):
        rhs_with_dot = self.rhs[:]
        rhs_with_dot.insert(self.dot_pos, "•")
        return {
            "rule_num": self.rule_num,
            "lhs": self.lhs,
            "rhs": self.rhs,
            "dot_pos": self.dot_pos,
            "lookahead": None,
            "display": f"[{self.lhs} -> {' '.join(rhs_with_dot).replace('ε', 'epsilon')}]",
        }


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


def _terminals_with_dollar(terminals):
    return sorted(terminals) + ["$"]


def build_lr0_parsing_table(states, transitions, grammar, rules, terminals, non_terminals):
    """LR(0): reduce en todos los terminales + $ para ítems completos (salvo accept)."""
    action = defaultdict(dict)
    goto = defaultdict(dict)
    conflicts = []

    start = non_terminals[0]
    aug = start + "'"
    term_row = _terminals_with_dollar(terminals)

    for i, state in enumerate(states):
        for item in state:
            if not item.is_reducible():
                next_sym = item.next_symbol()
                if next_sym and next_sym not in grammar and (i, next_sym) in transitions:
                    nxt = transitions[(i, next_sym)]
                    prev = action[i].get(next_sym)
                    if prev is not None and prev != ("shift", nxt):
                        conflicts.append(
                            {
                                "state": i,
                                "symbol": next_sym,
                                "message": f"Conflicto shift/reduce o múltiple acción: {prev} vs shift {nxt}",
                            }
                        )
                    else:
                        action[i][next_sym] = ("shift", nxt)
            else:
                if item.lhs == aug:
                    prev = action[i].get("$")
                    if prev is not None and prev != ("accept", None):
                        conflicts.append(
                            {
                                "state": i,
                                "symbol": "$",
                                "message": f"Conflicto en accept: {prev}",
                            }
                        )
                    action[i]["$"] = ("accept", None)
                elif item.rule_num >= 0:
                    for a in term_row:
                        prev = action[i].get(a)
                        new_act = ("reduce", item.rule_num)
                        if prev is not None and prev != new_act:
                            conflicts.append(
                                {
                                    "state": i,
                                    "symbol": a,
                                    "message": f"Conflicto reduce: {prev} vs {new_act}",
                                }
                            )
                        action[i][a] = new_act

        for nt in non_terminals:
            if (i, nt) in transitions:
                goto[i][nt] = transitions[(i, nt)]

    return action, goto, conflicts


def build_slr_parsing_table(states, transitions, grammar, rules, terminals, non_terminals, follow):
    """SLR(1): reduce solo para símbolos en FOLLOW(A)."""
    action = defaultdict(dict)
    goto = defaultdict(dict)
    conflicts = []

    start = non_terminals[0]
    aug = start + "'"

    for i, state in enumerate(states):
        for item in state:
            if not item.is_reducible():
                next_sym = item.next_symbol()
                if next_sym and next_sym not in grammar and (i, next_sym) in transitions:
                    nxt = transitions[(i, next_sym)]
                    prev = action[i].get(next_sym)
                    if prev is not None and prev != ("shift", nxt):
                        conflicts.append(
                            {
                                "state": i,
                                "symbol": next_sym,
                                "message": f"Conflicto: {prev} vs shift {nxt}",
                            }
                        )
                    else:
                        action[i][next_sym] = ("shift", nxt)
            else:
                if item.lhs == aug:
                    prev = action[i].get("$")
                    if prev is not None and prev != ("accept", None):
                        conflicts.append(
                            {
                                "state": i,
                                "symbol": "$",
                                "message": f"Conflicto en accept: {prev}",
                            }
                        )
                    action[i]["$"] = ("accept", None)
                elif item.rule_num >= 0:
                    lhs = item.lhs
                    for a in follow.get(lhs, set()):
                        prev = action[i].get(a)
                        new_act = ("reduce", item.rule_num)
                        if prev is not None and prev != new_act:
                            conflicts.append(
                                {
                                    "state": i,
                                    "symbol": a,
                                    "message": f"Conflicto reduce/shift: {prev} vs {new_act}",
                                }
                            )
                        action[i][a] = new_act

        for nt in non_terminals:
            if (i, nt) in transitions:
                goto[i][nt] = transitions[(i, nt)]

    return action, goto, conflicts


def states_to_json(states):
    out = []
    for i, state in enumerate(states):
        out.append({"state_num": i, "items": [it.to_dict() for it in state]})
    return out


def action_goto_to_json(action_table, goto_table):
    action_json = {}
    for state in action_table:
        action_json[str(state)] = {}
        for terminal in action_table[state]:
            action_type, action_value = action_table[state][terminal]
            action_json[str(state)][terminal] = {"type": action_type, "value": action_value}
    goto_json = {}
    for state in goto_table:
        goto_json[str(state)] = dict(goto_table[state])
    return action_json, goto_json


def run_lr0(grammar_text, input_text):
    import grammar_common as gc

    from grammar_common import (
        clear_first_cache,
        load_grammar_from_string,
        process_grammar,
        get_symbols,
        compute_first,
        grammar_to_json,
    )

    clear_first_cache()
    lines = load_grammar_from_string(grammar_text)
    grammar, rules = process_grammar(lines)
    non_terminals, terminals = get_symbols(grammar)
    for nt in non_terminals:
        compute_first(nt, grammar)

    states, transitions = build_lr0_automaton(grammar, non_terminals[0])
    action_table, goto_table, conflicts = build_lr0_parsing_table(
        states, transitions, grammar, rules, terminals, non_terminals
    )
    tokens = input_text.strip().split()
    trace, valid, parse_tree = lr1_parse(
        tokens, action_table, goto_table, rules, non_terminals[0]
    )

    action_json, goto_json = action_goto_to_json(action_table, goto_table)
    return {
        "parser": "lr0",
        "parser_family": "lr",
        "parser_label": "LR(0)",
        "valid": valid,
        "trace": trace,
        "grammar": grammar_to_json(rules, non_terminals, terminals),
        "states": states_to_json(states),
        "action_table": action_json,
        "goto_table": goto_json,
        "input_tokens": tokens,
        "conflicts": conflicts,
        "first_sets": {k: sorted(v) for k, v in gc.FIRST.items()},
        "parse_tree": parse_tree,
        "derivation_tree": parse_tree,
    }


def run_slr1(grammar_text, input_text):
    from grammar_common import (
        clear_first_cache,
        load_grammar_from_string,
        process_grammar,
        get_symbols,
        compute_first,
        compute_follow,
        grammar_to_json,
    )
    import grammar_common as gc

    clear_first_cache()
    lines = load_grammar_from_string(grammar_text)
    grammar, rules = process_grammar(lines)
    non_terminals, terminals = get_symbols(grammar)
    start = non_terminals[0]
    for nt in non_terminals:
        compute_first(nt, grammar)
    follow = compute_follow(grammar, rules, non_terminals, start)

    states, transitions = build_lr0_automaton(grammar, start)
    action_table, goto_table, conflicts = build_slr_parsing_table(
        states, transitions, grammar, rules, terminals, non_terminals, follow
    )
    tokens = input_text.strip().split()
    trace, valid, parse_tree = lr1_parse(tokens, action_table, goto_table, rules, start)

    action_json, goto_json = action_goto_to_json(action_table, goto_table)
    return {
        "parser": "slr1",
        "parser_family": "lr",
        "parser_label": "SLR(1)",
        "valid": valid,
        "trace": trace,
        "grammar": grammar_to_json(rules, non_terminals, terminals),
        "states": states_to_json(states),
        "action_table": action_json,
        "goto_table": goto_json,
        "input_tokens": tokens,
        "conflicts": conflicts,
        "first_sets": {k: sorted(v) for k, v in gc.FIRST.items()},
        "follow_sets": {k: sorted(v) for k, v in follow.items()},
        "parse_tree": parse_tree,
        "derivation_tree": parse_tree,
    }
