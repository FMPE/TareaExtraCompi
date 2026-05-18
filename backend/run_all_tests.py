"""
Suite de pruebas para los 6 parsers (RD, LL(1), LR(0), SLR(1), LALR(1), LR(1)).

Para cada test en tests/<name>/, corre los 6 runners con la misma gramática
y entrada, y compara el `valid` reportado con el esperado.

Categorías de resultado por corrida (parser × test):
  ✓ OK              parser pertenece a la clase de la gramática Y `valid` == esperado
  ⚠ CONFLICT-OK     la gramática NO es de la clase del parser, pero la cadena
                    coincide con lo esperado (acepta/rechaza igualmente)
  ⚠ CONFLICT-WRONG  la gramática tiene conflictos Y `valid` != esperado
  ✗ WRONG           parser correcto para la clase pero da resultado equivocado (BUG real)
  ✗ ERROR           el runner lanzó excepción

Uso:
    python run_all_tests.py                # todos los tests con todos los parsers
    python run_all_tests.py --parser lr0   # solo un parser
    python run_all_tests.py --test basic_abcd  # solo un test
"""
import argparse
import os
import sys
from collections import defaultdict

# Importar los 6 runners que el endpoint /api/parse usa.
from lr1_backend import run_lr1
from lr0_parser import run_lr0, run_slr1
from lalr_parser import run_lalr1
from ll1_parser import run_ll1
from recursive_descent import run_recursive_descent
from parser_insights import enrich_parse_response


TEST_DIR = os.path.join(os.path.dirname(__file__), "tests")

# Resultado esperado de `valid` para la cadena de entrada de cada test.
# True  → la cadena pertenece al lenguaje de la gramática (parser debe aceptar)
# False → la cadena NO pertenece (parser debe rechazar)
EXPECTED_VALID = {
    "basic_abcd": True,
    "optional_chain": True,
    "epsilon_example": True,
    "left_recursion_lr1": True,
    "lr1_specific_if_else": True,
    "lr1_lookahead": True,
    "nested_epsilon": True,
    "invalid_missing_symbol": False,
    "multiple_rules": True,
    "epsilon_in_middle": True,
    "double_epsilon": True,
    "left_recursion_rewritten": True,
    "missing_terminal": False,
}

# Alias para compatibilidad con run_single_test.py (importa EXPECTED_RESULTS).
EXPECTED_RESULTS = EXPECTED_VALID

# Orden de parsers en la salida (jerarquía top-down → bottom-up).
PARSERS = [
    ("rd",    "RD",      run_recursive_descent),
    ("ll1",   "LL(1)",   run_ll1),
    ("lr0",   "LR(0)",   run_lr0),
    ("slr1",  "SLR(1)",  run_slr1),
    ("lalr1", "LALR(1)", run_lalr1),
    ("lr1",   "LR(1)",   run_lr1),
]
PARSER_BY_ID = {pid: (pid, label, runner) for pid, label, runner in PARSERS}

# Códigos de resultado.
OK = "OK"
CONFLICT_OK = "CONF-OK"
CONFLICT_WRONG = "CONF-WRONG"
WRONG = "WRONG"
ERROR = "ERROR"

ICON = {
    OK: "✓",
    CONFLICT_OK: "⚠",
    CONFLICT_WRONG: "⚠",
    WRONG: "✗",
    ERROR: "!",
}


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def run_one(parser_id, runner, grammar_text, input_text, expected_valid):
    """Corre un runner y categoriza el resultado.

    Devuelve (status, detail_str).
    """
    try:
        payload = runner(grammar_text, input_text)
        payload = enrich_parse_response(parser_id, grammar_text, input_text, payload)
    except Exception as e:
        return ERROR, f"{type(e).__name__}: {str(e)[:80]}"

    valid = bool(payload.get("valid"))
    in_class = bool(payload.get("in_class"))
    n_conf = len(payload.get("conflicts") or [])
    matches = (valid == expected_valid)

    if in_class:
        if matches:
            return OK, f"valid={valid}"
        return WRONG, f"valid={valid}, esperado={expected_valid}"
    # No está en la clase del parser (hubo conflictos de tabla).
    suffix = f"valid={valid}, conflictos={n_conf}"
    return (CONFLICT_OK if matches else CONFLICT_WRONG), suffix


def run_test(test_name, only_parser_ids=None):
    """Corre un test contra los 6 (o uno) parsers. Devuelve True si no hubo
    WRONG ni ERROR (CONFLICT-* se considera aceptable, no un bug del parser).
    """
    src = os.path.join(TEST_DIR, test_name)
    g_path = os.path.join(src, "grammar.txt")
    i_path = os.path.join(src, "input.txt")
    if not (os.path.isfile(g_path) and os.path.isfile(i_path)):
        print(f"  ! {test_name}: faltan archivos en {src}")
        return False

    grammar = _read(g_path)
    inp = _read(i_path)
    expected = EXPECTED_VALID.get(test_name)
    if expected is None:
        print(f"  ! {test_name}: sin entrada en EXPECTED_VALID")
        return False

    print(f"\n▶ {test_name}   (esperado: {'VALID' if expected else 'INVALID'})")
    parsers = (
        [PARSER_BY_ID[p] for p in only_parser_ids]
        if only_parser_ids
        else PARSERS
    )
    fail = False
    for pid, plabel, runner in parsers:
        status, detail = run_one(pid, runner, grammar, inp, expected)
        print(f"  {ICON[status]} {plabel:<8} {status:<11} {detail}")
        if status in (WRONG, ERROR):
            fail = True
    return not fail


def main():
    ap = argparse.ArgumentParser(description="Suite de pruebas multi-parser.")
    ap.add_argument(
        "--parser",
        choices=[p[0] for p in PARSERS],
        action="append",
        help="Restringir a uno o más parsers (repetible).",
    )
    ap.add_argument(
        "--test",
        action="append",
        help="Restringir a uno o más tests por nombre (repetible).",
    )
    args = ap.parse_args()

    tests = sorted(EXPECTED_VALID.keys())
    if args.test:
        unknown = [t for t in args.test if t not in EXPECTED_VALID]
        if unknown:
            print(f"Tests desconocidos: {unknown}")
            print(f"Disponibles: {tests}")
            return 1
        tests = args.test

    parsers = args.parser or [p[0] for p in PARSERS]

    print("=" * 78)
    print(f"  Pruebas: {len(tests)} casos × {len(parsers)} parser(s) = {len(tests)*len(parsers)} corridas")
    print(f"  Parsers: {', '.join(parsers)}")
    print("=" * 78)

    # Matriz parser → status → count
    stats = defaultdict(lambda: defaultdict(int))
    bug_runs = []  # (test, parser_label, status, detail)

    for test in tests:
        src = os.path.join(TEST_DIR, test)
        g_path = os.path.join(src, "grammar.txt")
        i_path = os.path.join(src, "input.txt")
        if not (os.path.isfile(g_path) and os.path.isfile(i_path)):
            print(f"\n▶ {test}   (esperado: ?)")
            print(f"  ! faltan archivos en {src}")
            continue
        grammar = _read(g_path)
        inp = _read(i_path)
        expected = EXPECTED_VALID[test]
        print(f"\n▶ {test}   (esperado: {'VALID' if expected else 'INVALID'})")
        for pid in parsers:
            _, plabel, runner = PARSER_BY_ID[pid]
            status, detail = run_one(pid, runner, grammar, inp, expected)
            stats[pid][status] += 1
            print(f"  {ICON[status]} {plabel:<8} {status:<11} {detail}")
            if status in (WRONG, ERROR):
                bug_runs.append((test, plabel, status, detail))

    # Resumen tabular por parser
    print("\n" + "=" * 78)
    print("  RESUMEN POR PARSER")
    print("=" * 78)
    header = f"  {'Parser':<8} {'OK':>4} {'CONF-OK':>8} {'CONF-WRONG':>11} {'WRONG':>6} {'ERROR':>6}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for pid in parsers:
        _, plabel, _ = PARSER_BY_ID[pid]
        s = stats[pid]
        print(
            f"  {plabel:<8} {s[OK]:>4} {s[CONFLICT_OK]:>8} "
            f"{s[CONFLICT_WRONG]:>11} {s[WRONG]:>6} {s[ERROR]:>6}"
        )

    # Bugs (WRONG/ERROR) — son los únicos que indican que un parser está roto.
    print("\n" + "=" * 78)
    if not bug_runs:
        print("  🎉 Sin WRONG ni ERROR. Todos los parsers funcionan correctamente.")
        print("     (CONF-* indica gramáticas fuera de la clase del parser, no bugs)")
        print("=" * 78)
        return 0

    print(f"  ❌ {len(bug_runs)} corrida(s) con WRONG o ERROR:")
    print("=" * 78)
    for test, plabel, status, detail in bug_runs:
        print(f"  - {test:<25} {plabel:<8} {status:<8} {detail}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
