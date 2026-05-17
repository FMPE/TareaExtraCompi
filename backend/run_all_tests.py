import os
import shutil
import json
import sys
from lr1_parser import (
        load_grammar,
        process_grammar,
        get_symbols,
        compute_first,
        clear_first_cache,
        build_lr1_automaton,
        build_lr1_parsing_table,
        lr1_parse
    )

TEST_DIR = "tests"  # Keeping the same directory but now testing LR1 parser
EXPECTED_RESULTS = {
    "basic_abcd": True,
    "optional_chain": True, 
    "epsilon_example": True,
    "left_recursion_lr1": True,    # LR(1) can handle left recursion
    "lr1_specific_if_else": True,  # Classic dangling else - LR(1) resolves this
    "lr1_lookahead": True,         # Requires lookahead to distinguish A vs B
    "nested_epsilon": True,
    "invalid_missing_symbol": False,
    "multiple_rules": True,
    "epsilon_in_middle": True,
    "double_epsilon": True,
    "left_recursion_rewritten": True,  # LR1 can handle this better than LL1
    "missing_terminal": False
}

def read_input(path):
    """Read input tokens from file."""
    with open(path, "r", encoding='utf-8') as f:
        return f.read().strip().split()

def run_test(test_name):
    """Run a single test case using the LR(1) parser functions."""
    src = os.path.join(TEST_DIR, test_name)
    grammar_path = os.path.join(src, "grammar.txt")
    input_path = os.path.join(src, "input.txt")

    print(f"Ejecutando test: {test_name}")
    
    try:
        # Clear FIRST cache for new grammar
        clear_first_cache()
        
        # Load and process grammar
        lines = load_grammar(grammar_path)
        grammar, rules = process_grammar(lines)
        non_terminals, terminals = get_symbols(grammar)

        # Compute FIRST sets
        for nt in non_terminals:
            compute_first(nt, grammar)

        # Build LR(1) automaton
        states, transitions = build_lr1_automaton(grammar, non_terminals[0])

        # Build LR(1) parsing tables
        action_table, goto_table = build_lr1_parsing_table(states, transitions, grammar, rules, terminals, non_terminals)

        # Parse input
        input_string = read_input(input_path)
        trace, valid, _parse_tree = lr1_parse(
            input_string, action_table, goto_table, rules, non_terminals[0]
        )

        # Save trace for debugging
        trace_file = f"trace_{test_name}.json"
        with open(trace_file, "w") as f:
            json.dump(trace, f, indent=2, default=str)

    except Exception as e:
        print(f"  Error en la ejecución: {str(e)}")
        status = "❌ ERROR EN EJECUCIÓN"
        print(f"{test_name:<30} → {status}")
        return False

    expected = EXPECTED_RESULTS[test_name]
    passed = (valid == expected)
    status = "✅ PASA EL TEST" if passed else "❌ FALLA EL TEST"

    print(f"{test_name:<30} Resultado: {'VALID' if valid else 'INVALID':<7} / Esperado: {'VALID' if expected else 'INVALID':<7} → {status}")
    return passed

def main():
    """Run all tests and display results."""
    print("EJECUTANDO TODOS LOS TESTS CON PARSER LR(1)...\n")
    passed = 0
    total = len(EXPECTED_RESULTS)
    failed_tests = []

    for test in EXPECTED_RESULTS:
        if run_test(test):
            passed += 1
        else:
            failed_tests.append(test)
        print()  # Add spacing between tests
    
    print(f"RESUMEN: {passed}/{total} tests pasaron")
    
    if failed_tests:
        print(f"\nTests que fallaron:")
        for test in failed_tests:
            expected = "VALID" if EXPECTED_RESULTS[test] else "INVALID"
            print(f"  - {test} (esperado: {expected})")
    else:
        print("\n🎉 ¡Todos los tests pasaron!")
    
    # Cleanup trace files older than current run
    try:
        for file in os.listdir('.'):
            if file.startswith('trace_') and file.endswith('.json'):
                if file.replace('trace_', '').replace('.json', '') not in EXPECTED_RESULTS:
                    os.remove(file)
    except:
        pass  # Ignore cleanup errors

if __name__ == "__main__":
    main()