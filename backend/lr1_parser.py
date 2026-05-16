import json
from collections import defaultdict

def load_grammar(path):
    with open(path, "r", encoding='utf-8') as file:
        lines = [line.strip() for line in file if line.strip()]
    return lines

def load_grammar_from_string(grammar_text):
    lines = [line.strip() for line in grammar_text.split('\n') if line.strip()]
    return lines

def process_grammar(lines):
    grammar = {}
    rules = []
    for i, line in enumerate(lines):
        left, right = line.split("->")
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
        for rule_num, prod in productions:
            for symbol in prod:
                if symbol not in grammar and symbol != "ε":
                    terminals.add(symbol)
    return non_terminals, list(terminals)

FIRST = {}

def compute_first(X, grammar):
    if X in FIRST:
        return FIRST[X]
    
    FIRST[X] = set()
    
    if X not in grammar:
        FIRST[X] = {X}
        return FIRST[X]
    
    for rule_num, production in grammar[X]:
        first_prod = compute_first_sequence(production, grammar)
        FIRST[X] |= first_prod
    
    return FIRST[X]

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

def clear_first_cache():
    global FIRST
    FIRST = {}

class LRItem:
    def __init__(self, rule_num, lhs, rhs, dot_pos, lookahead):
        self.rule_num = rule_num
        self.lhs = lhs
        self.rhs = rhs
        self.dot_pos = dot_pos
        self.lookahead = lookahead
    
    def __eq__(self, other):
        return (self.rule_num == other.rule_num and 
                self.dot_pos == other.dot_pos and 
                self.lookahead == other.lookahead)
    
    def __hash__(self):
        return hash((self.rule_num, self.dot_pos, self.lookahead))
    
    def __repr__(self):
        rhs_with_dot = self.rhs[:]
        rhs_with_dot.insert(self.dot_pos, "•")
        rhs_str = ' '.join(rhs_with_dot).replace('ε', 'epsilon')
        return f"[{self.lhs} -> {rhs_str}, {self.lookahead}]"
    
    def to_dict(self):
        rhs_with_dot = self.rhs[:]
        rhs_with_dot.insert(self.dot_pos, "•")
        return {
            "rule_num": self.rule_num,
            "lhs": self.lhs,
            "rhs": self.rhs,
            "dot_pos": self.dot_pos,
            "lookahead": self.lookahead,
            "display": f"[{self.lhs} -> {' '.join(rhs_with_dot).replace('ε', 'epsilon')}, {self.lookahead}]"
        }
    
    def next_symbol(self):
        if self.dot_pos < len(self.rhs):
            return self.rhs[self.dot_pos]
        return None
    
    def is_reducible(self):
        return self.dot_pos == len(self.rhs)
    
    def advance_dot(self):
        return LRItem(self.rule_num, self.lhs, self.rhs, self.dot_pos + 1, self.lookahead)

def closure(items, grammar):
    result = set(items)
    changed = True
    while changed:
        changed = False
        new_items = set()
        for item in result:
            next_sym = item.next_symbol()
            if next_sym and next_sym in grammar:
                beta = item.rhs[item.dot_pos + 1:] + [item.lookahead]
                first_beta = compute_first_sequence(beta, grammar)
                for rule_num, production in grammar[next_sym]:
                    for lookahead in first_beta:
                        if lookahead != "ε":
                            new_item = LRItem(rule_num, next_sym, production, 0, lookahead)
                            if new_item not in result:
                                new_items.add(new_item)
                                changed = True
        result.update(new_items)
    
    epsilon_items = set()
    for item in result:
        if item.rhs == ["ε"] and item.dot_pos == 0:
            epsilon_item = LRItem(item.rule_num, item.lhs, item.rhs, 1, item.lookahead)
            epsilon_items.add(epsilon_item)
    result.update(epsilon_items)
    
    return result

def goto(items, symbol, grammar):
    new_items = set()
    for item in items:
        if item.next_symbol() == symbol:
            new_items.add(item.advance_dot())
    return closure(new_items, grammar)

def build_lr1_automaton(grammar, start_symbol):
    augmented_start = start_symbol + "'"
    start_item = LRItem(-1, augmented_start, [start_symbol], 0, "$")
    
    states = []
    state_map = {}
    transitions = {}
    
    initial_state = closure({start_item}, grammar)
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
            new_state = goto(current_state, symbol, grammar)
            if new_state:
                frozen_new_state = frozenset(new_state)
                if frozen_new_state not in state_map:
                    state_map[frozen_new_state] = len(states)
                    states.append(new_state)
                    queue.append(new_state)
                
                new_index = state_map[frozen_new_state]
                transitions[(current_index, symbol)] = new_index
    
    return states, transitions

def build_lr1_parsing_table(states, transitions, grammar, rules, terminals, non_terminals):
    action = defaultdict(dict)
    goto = defaultdict(dict)
    
    for i, state in enumerate(states):
        for item in state:
            if item.is_reducible():
                if item.lhs == non_terminals[0] + "'" and item.lookahead == "$":
                    action[i]["$"] = ("accept", None)
                elif item.rule_num >= 0:
                    if item.lookahead not in action[i]:
                        action[i][item.lookahead] = ("reduce", item.rule_num)
            else:
                next_sym = item.next_symbol()
                if next_sym and next_sym in terminals and (i, next_sym) in transitions:
                    next_state = transitions[(i, next_sym)]
                    if next_sym not in action[i]:
                        action[i][next_sym] = ("shift", next_state)
        
        for nt in non_terminals:
            if (i, nt) in transitions:
                goto[i][nt] = transitions[(i, nt)]
    
    return action, goto

def lr1_parse(input_string, action_table, goto_table, rules, start_symbol):
    stack = [0]
    input_list = list(input_string) + ["$"]
    index = 0
    trace = []
    
    while True:
        state = stack[-1]
        current_token = input_list[index]
        
        if state not in action_table or current_token not in action_table[state]:
            trace.append({
                "stack": stack[:],
                "remaining_input": input_list[index:],
                "action": f"Error: no action for state {state} with token {current_token}",
                "type": "error"
            })
            return trace, False
        
        action_type, action_value = action_table[state][current_token]
        
        if action_type == "shift":
            stack.append(action_value)
            trace.append({
                "stack": stack[:],
                "remaining_input": input_list[index:],
                "action": f"Shift {current_token}, goto state {action_value}",
                "type": "shift"
            })
            index += 1
        
        elif action_type == "reduce":
            rule_num, lhs, rhs = rules[action_value]
            
            if rhs != ["ε"]:
                for _ in range(len(rhs)):
                    stack.pop()
            
            new_state = stack[-1]
            if new_state in goto_table and lhs in goto_table[new_state]:
                stack.append(goto_table[new_state][lhs])
                trace.append({
                    "stack": stack[:],
                    "remaining_input": input_list[index:],
                    "action": f"Reduce by rule {rule_num}: {lhs} -> {' '.join(rhs).replace('ε', 'epsilon')}",
                    "type": "reduce",
                    "rule_num": rule_num,
                    "rule_lhs": lhs,
                    "rule_rhs": rhs
                })
            else:
                trace.append({
                    "stack": stack[:],
                    "remaining_input": input_list[index:],
                    "action": f"Error: no GOTO for state {new_state} with {lhs}",
                    "type": "error"
                })
                return trace, False
        
        elif action_type == "accept":
            trace.append({
                "stack": stack[:],
                "remaining_input": input_list[index:],
                "action": "Accept",
                "type": "accept"
            })
            return trace, True
        
        else:
            trace.append({
                "stack": stack[:],
                "remaining_input": input_list[index:],
                "action": f"Error: unknown action {action_type}",
                "type": "error"
            })
            return trace, False


def print_lr1_states(states):
    print("\nLR(1) STATES:\n")
    for i, state in enumerate(states):
        print(f"State {i}:")
        for item in state:
            print(f"  {item}")
        print()

def print_lr1_action_table(action_table, terminals):
    print("\nACTION TABLE:\n")
    headers = terminals + ["$"]
    print(f"{'State':<8}" + ''.join(f"{h:<15}" for h in headers))
    print("-" * (8 + 15 * len(headers)))
    
    for state in sorted(action_table.keys()):
        print(f"{state:<8}", end='')
        for terminal in headers:
            if terminal in action_table[state]:
                action_type, action_value = action_table[state][terminal]
                if action_type == "shift":
                    print(f"s{action_value:<14}", end='')
                elif action_type == "reduce":
                    print(f"r{action_value:<14}", end='')
                elif action_type == "accept":
                    print(f"acc{'':<12}", end='')
            else:
                print(f"{'-':<15}", end='')
        print()

def print_lr1_goto_table(goto_table, non_terminals):
    print("\nGOTO TABLE:\n")
    print(f"{'State':<8}" + ''.join(f"{nt:<15}" for nt in non_terminals))
    print("-" * (8 + 15 * len(non_terminals)))
    
    for state in sorted(goto_table.keys()):
        print(f"{state:<8}", end='')
        for nt in non_terminals:
            if nt in goto_table[state]:
                print(f"{goto_table[state][nt]:<15}", end='')
            else:
                print(f"{'-':<15}", end='')
        print()

def read_input(path):
    with open(path, "r", encoding='utf-8') as f:
        return f.read().strip().split()

def main():
    lines = load_grammar("grammar.txt")
    grammar, rules = process_grammar(lines)
    non_terminals, terminals = get_symbols(grammar)

    for nt in non_terminals:
        compute_first(nt, grammar)

    print("Buildeando automata LR1")
    states, transitions = build_lr1_automaton(grammar, non_terminals[0])

    action_table, goto_table = build_lr1_parsing_table(states, transitions, grammar, rules, terminals, non_terminals)

    print_lr1_states(states)
    print_lr1_action_table(action_table, terminals)
    print_lr1_goto_table(goto_table, non_terminals)

    input_string = read_input("input.txt")
    trace, valid = lr1_parse(input_string, action_table, goto_table, rules, non_terminals[0])

    with open("trace.json", "w") as f:
        json.dump(trace, f, indent=2)

    print("\nPARSER TRACE:\n")
    for step in trace:
        if isinstance(step, dict):
            stack = step.get("stack", [])
            remaining_input = step.get("remaining_input", [])
            action = step.get("action", "")
        else:
            stack, remaining_input, action = step
        print(f"Stack: {str(stack):<30} Input: {''.join(remaining_input):<20} Action: {action}")

    if valid:
        print("\nVALID STRING")
    else:
        print("\nINVALID STRING")

if __name__ == "__main__":
    main()
