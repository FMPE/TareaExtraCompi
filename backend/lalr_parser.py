"""LALR(1): fusiona estados LR(1) con el mismo núcleo y construye la tabla LR(1)."""
from collections import defaultdict

from lr1_parser import (
    build_lr1_automaton,
    build_lr1_parsing_table,
    lr1_parse,
)
from lr0_parser import action_goto_to_json


def _state_core(state):
    return frozenset((it.rule_num, it.lhs, tuple(it.rhs), it.dot_pos) for it in state)


def build_lalr_from_lr1(states_lr1, transitions_lr1):
    """Devuelve estados fusionados, transiciones LALR y lista de conflictos de fusión."""
    lr1_to_core = {}
    for i, st in enumerate(states_lr1):
        lr1_to_core[i] = _state_core(st)

    ordered_cores = []
    seen = set()
    for i in range(len(states_lr1)):
        c = lr1_to_core[i]
        if c not in seen:
            seen.add(c)
            ordered_cores.append(c)

    core_to_lalr = {c: j for j, c in enumerate(ordered_cores)}

    merged_states = []
    for c in ordered_cores:
        bag = set()
        for i, st in enumerate(states_lr1):
            if lr1_to_core[i] == c:
                bag.update(st)
        merged_states.append(bag)

    lalr_transitions = {}
    conflicts = []
    for (s, sym), t in transitions_lr1.items():
        i = core_to_lalr[lr1_to_core[s]]
        j = core_to_lalr[lr1_to_core[t]]
        key = (i, sym)
        if key in lalr_transitions and lalr_transitions[key] != j:
            conflicts.append(
                {
                    "message": f"Inconsistencia GOTO LALR: desde núcleo {i} con {sym} "
                    f"apuntaba a {lalr_transitions[key]} y también a {j}",
                }
            )
        lalr_transitions[key] = j

    return merged_states, lalr_transitions, conflicts


def states_to_json_lalr(states):
    """Serializa ítems LR(1) (con lookahead) en cada estado LALR."""
    out = []
    for i, state in enumerate(states):
        items = []
        for it in state:
            items.append(it.to_dict())
        out.append({"state_num": i, "items": items})
    return out


def run_lalr1(grammar_text, input_text):
    import grammar_common as gc

    from grammar_common import (
        clear_first_cache,
        load_grammar_from_string,
        process_grammar,
        get_symbols,
        compute_first,
        compute_follow,
        grammar_to_json,
    )

    clear_first_cache()
    lines = load_grammar_from_string(grammar_text)
    grammar, rules = process_grammar(lines)
    non_terminals, terminals = get_symbols(grammar)
    start = non_terminals[0]
    for nt in non_terminals:
        compute_first(nt, grammar)
    follow = compute_follow(grammar, rules, non_terminals, start)

    states_lr1, trans_lr1 = build_lr1_automaton(grammar, start)
    merged_states, lalr_trans, merge_conflicts = build_lalr_from_lr1(states_lr1, trans_lr1)

    action_table, goto_table = build_lr1_parsing_table(
        merged_states, lalr_trans, grammar, rules, terminals, non_terminals
    )

    table_conflicts = []
    for i, state in enumerate(merged_states):
        seen_reduce = defaultdict(list)
        for it in state:
            if it.is_reducible() and it.rule_num >= 0:
                seen_reduce[it.lookahead].append(it.rule_num)
        for la, rnums in seen_reduce.items():
            if len(set(rnums)) > 1:
                table_conflicts.append(
                    {
                        "state": i,
                        "lookahead": la,
                        "message": f"Múltiples reducciones posibles: reglas {rnums}",
                    }
                )

    tokens = input_text.strip().split()
    trace, valid, parse_tree = lr1_parse(tokens, action_table, goto_table, rules, start)
    action_json, goto_json = action_goto_to_json(action_table, goto_table)

    return {
        "parser": "lalr1",
        "parser_family": "lr",
        "parser_label": "LALR(1)",
        "valid": valid,
        "trace": trace,
        "grammar": grammar_to_json(rules, non_terminals, terminals),
        "states": states_to_json_lalr(merged_states),
        "action_table": action_json,
        "goto_table": goto_json,
        "input_tokens": tokens,
        "conflicts": merge_conflicts + table_conflicts,
        "first_sets": {k: sorted(v) for k, v in gc.FIRST.items()},
        "follow_sets": {k: sorted(v) for k, v in follow.items()},
        "parse_tree": parse_tree,
        "derivation_tree": parse_tree,
    }
