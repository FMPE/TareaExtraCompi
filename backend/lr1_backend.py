from flask import Flask, request, jsonify
from flask_cors import CORS

import grammar_common as gc
from grammar_common import (
    clear_first_cache,
    grammar_to_json,
    load_grammar_from_string,
    process_grammar,
    get_symbols,
    compute_first,
    compute_follow,
)
from lr1_parser import (
    build_lr1_automaton,
    build_lr1_parsing_table,
    lr1_parse,
)
from lr0_parser import run_lr0, run_slr1, action_goto_to_json, states_to_json
from lalr_parser import run_lalr1
from ll1_parser import run_ll1
from recursive_descent import run_recursive_descent
from parser_insights import enrich_parse_response

app = Flask(__name__)
CORS(app)

PARSER_ALIASES = {
    "lr1": "lr1",
    "lr(1)": "lr1",
    "lr0": "lr0",
    "lr(0)": "lr0",
    "slr": "slr1",
    "slr1": "slr1",
    "slr(1)": "slr1",
    "lalr": "lalr1",
    "lalr1": "lalr1",
    "lalr(1)": "lalr1",
    "ll1": "ll1",
    "ll(1)": "ll1",
    "rd": "rd",
    "recursive_descent": "rd",
    "descenso_recursivo": "rd",
}


def run_lr1(grammar_text, input_text):
    clear_first_cache()
    lines = load_grammar_from_string(grammar_text)
    grammar, rules = process_grammar(lines)
    non_terminals, terminals = get_symbols(grammar)
    for nt in non_terminals:
        compute_first(nt, grammar)

    states, transitions = build_lr1_automaton(grammar, non_terminals[0])
    action_table, goto_table = build_lr1_parsing_table(
        states, transitions, grammar, rules, terminals, non_terminals
    )
    input_tokens = input_text.strip().split()
    trace, valid, parse_tree = lr1_parse(
        input_tokens, action_table, goto_table, rules, non_terminals[0]
    )

    states_json = []
    for i, state in enumerate(states):
        states_json.append({"state_num": i, "items": [item.to_dict() for item in state]})

    action_json, goto_json = action_goto_to_json(action_table, goto_table)
    follow = compute_follow(grammar, rules, non_terminals, non_terminals[0])

    return {
        "parser": "lr1",
        "parser_family": "lr",
        "parser_label": "LR(1)",
        "valid": valid,
        "trace": trace,
        "grammar": grammar_to_json(rules, non_terminals, terminals),
        "states": states_json,
        "action_table": action_json,
        "goto_table": goto_json,
        "input_tokens": input_tokens,
        "conflicts": [],
        "first_sets": {k: sorted(v) for k, v in gc.FIRST.items()},
        "follow_sets": {k: sorted(v) for k, v in follow.items()},
        "parse_tree": parse_tree,
        "derivation_tree": parse_tree,
    }


RUNNERS = {
    "lr1": run_lr1,
    "lr0": run_lr0,
    "slr1": run_slr1,
    "lalr1": run_lalr1,
    "ll1": run_ll1,
    "rd": run_recursive_descent,
}


@app.route("/api/parse", methods=["POST"])
def parse_input():
    try:
        data = request.json or {}
        grammar_text = data.get("grammar", "")
        input_text = data.get("input", "")
        raw_kind = (data.get("parser") or data.get("parser_type") or "lr1").strip().lower()
        kind = PARSER_ALIASES.get(raw_kind, raw_kind)

        if kind not in RUNNERS:
            return jsonify(
                {
                    "error": f"Parser desconocido: {raw_kind}. "
                    f"Usa: lr0, slr1, lalr1, lr1, ll1, rd",
                    "success": False,
                }
            ), 400

        if not grammar_text or not input_text:
            return jsonify(
                {"error": "Se requieren gramática e entrada", "success": False}
            ), 400

        payload = RUNNERS[kind](grammar_text, input_text)
        payload = enrich_parse_response(kind, grammar_text, input_text, payload)
        payload["success"] = True
        return jsonify(payload)

    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify(
        {
            "status": "OK",
            "message": "Backend de parsers (LR(0), SLR, LALR, LR(1), LL(1), descenso recursivo)",
            "parsers": list(RUNNERS.keys()),
            "intelligent_assistant": True,
        }
    )


@app.route("/api/examples", methods=["GET"])
def get_examples():
    """Ejemplos listos para copiar; `recommended_parsers` sugiere dónde probar cada uno."""
    expr_lr = "E -> E + T\nE -> T\nT -> T * F\nT -> F\nF -> ( E )\nF -> id"
    expr_ll1 = (
        "E -> T E'\n"
        "E' -> + T E'\n"
        "E' -> ε\n"
        "T -> F T'\n"
        "T' -> * F T'\n"
        "T' -> ε\n"
        "F -> ( E )\n"
        "F -> id"
    )
    examples = [
        {
            "name": "Ascenso — expresión (recursión izquierda)",
            "grammar": expr_lr,
            "input": "id + id * id",
            "description": "Clásica para LR(0), SLR(1), LALR(1), LR(1). No sirve para LL(1) tal cual.",
            "recommended_parsers": ["lr0", "slr1", "lalr1", "lr1"],
        },
        {
            "name": "Ascenso — paréntesis",
            "grammar": expr_lr,
            "input": "id * ( id + id )",
            "description": "Comprueba shift sobre '(' y cierre con ')'.",
            "recommended_parsers": ["lr0", "slr1", "lalr1", "lr1"],
        },
        {
            "name": "Ascenso — cadena inválida (operador suelto)",
            "grammar": expr_lr,
            "input": "id + + id",
            "description": "Debe fallar; útil para ver el asistente de errores.",
            "recommended_parsers": ["lr0", "slr1", "lalr1", "lr1"],
        },
        {
            "name": "Ascenso — if / else (dangling else)",
            "grammar": (
                "S -> if E then S else S\n"
                "S -> if E then S\n"
                "S -> other\n"
                "E -> id"
            ),
            "input": "if id then if id then other else other",
            "description": "LR(1) / LALR típicos; compara con SLR si hay conflictos.",
            "recommended_parsers": ["lr1", "lalr1", "slr1", "lr0"],
        },
        {
            "name": "Ascenso — lista con ';' (izquierda recursiva)",
            "grammar": "L -> L ; id\nL -> id",
            "input": "id ; id ; id",
            "description": "LR la acepta; LL(1) fallaría sin reescritura.",
            "recommended_parsers": ["lr0", "slr1", "lalr1", "lr1"],
        },
        {
            "name": "Ascenso — SLR vs LR(0) (lookahead)",
            "grammar": "S -> A a\nS -> B b\nA -> x\nB -> x",
            "input": "x a",
            "description": "LR(0) suele tener conflictos; SLR(1) y LR(1) suelen limpiar reduce con FOLLOW.",
            "recommended_parsers": ["lr0", "slr1", "lr1", "lalr1"],
        },
        {
            "name": "Descenso — aⁿbⁿ (LL(1))",
            "grammar": "S -> a S b\nS -> ε",
            "input": "a a b b",
            "description": "LL(1) y descenso recursivo predictivo.",
            "recommended_parsers": ["ll1", "rd"],
        },
        {
            "name": "Descenso — expresión factorizada (LL(1))",
            "grammar": expr_ll1,
            "input": "id + id * id",
            "description": "Misma idea que la aritmética clásica pero en forma LL(1).",
            "recommended_parsers": ["ll1", "rd"],
        },
        {
            "name": "Descenso — un par a b",
            "grammar": "S -> a S b\nS -> ε",
            "input": "a b",
            "description": "Caso mínimo n=1.",
            "recommended_parsers": ["ll1", "rd"],
        },
        {
            "name": "Comparación — LR acepta, LL no (misma gramática LR)",
            "grammar": expr_lr,
            "input": "id + id * id",
            "description": "Ejecuta LR(1) y modo comparar con LL(1): la tabla LL no aplica a recursión izquierda.",
            "recommended_parsers": ["lr1", "ll1"],
        },
        {
            "name": "Comparación — misma expresión, gramática LL(1)",
            "grammar": expr_ll1,
            "input": "id + id * id",
            "description": "LR(1) y LL(1) deberían aceptar con esta gramática factorizada.",
            "recommended_parsers": ["lr1", "ll1", "lalr1", "slr1"],
        },
    ]

    return jsonify({"success": True, "examples": examples})


if __name__ == "__main__":
    print("Backend de parsers — API en http://localhost:5001")
    print("  POST /api/parse  body: { grammar, input, parser: lr0|slr1|lalr1|lr1|ll1|rd }")
    app.run(debug=True, host="0.0.0.0", port=5001)
