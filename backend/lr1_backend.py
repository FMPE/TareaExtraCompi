from flask import Flask, request, jsonify
from flask_cors import CORS
from lr1_parser import (
    load_grammar_from_string,
    process_grammar,
    get_symbols,
    compute_first,
    clear_first_cache,
    build_lr1_automaton,
    build_lr1_parsing_table,
    lr1_parse
)
from recursive_descent_parser import recursive_descent_parse_from_text
from ll1_parser import ll1_parse_from_text

app = Flask(__name__)
CORS(app)


# ---------------------------------------------------------------------------
# Parser LR(1) — endpoint existente
# ---------------------------------------------------------------------------

@app.route('/api/parse', methods=['POST'])
@app.route('/api/parse/lr1', methods=['POST'])
def parse_input():
    try:
        data = request.json
        grammar_text = data.get('grammar', '')
        input_text = data.get('input', '')
        
        if not grammar_text or not input_text:
            return jsonify({
                'error': 'Both grammar and input are required',
                'success': False
            }), 400
        
        clear_first_cache()
        
        lines = load_grammar_from_string(grammar_text)
        grammar, rules = process_grammar(lines)
        non_terminals, terminals = get_symbols(grammar)
        
        for nt in non_terminals:
            compute_first(nt, grammar)
        
        states, transitions = build_lr1_automaton(grammar, non_terminals[0])
        
        action_table, goto_table = build_lr1_parsing_table(states, transitions, grammar, rules, terminals, non_terminals)
        
        input_tokens = input_text.strip().split()
        trace, valid = lr1_parse(input_tokens, action_table, goto_table, rules, non_terminals[0])
        
        states_json = []
        for i, state in enumerate(states):
            states_json.append({
                "state_num": i,
                "items": [item.to_dict() for item in state]
            })
        
        action_json = {}
        for state in action_table:
            action_json[str(state)] = {}
            for terminal in action_table[state]:
                action_type, action_value = action_table[state][terminal]
                action_json[str(state)][terminal] = {
                    "type": action_type,
                    "value": action_value
                }
        
        goto_json = {}
        for state in goto_table:
            goto_json[str(state)] = goto_table[state]
        
        return jsonify({
            'success': True,
            'valid': valid,
            'trace': trace,
            'grammar': {
                'rules': [{"rule_num": r[0], "lhs": r[1], "rhs": r[2]} for r in rules],
                'non_terminals': non_terminals,
                'terminals': terminals
            },
            'states': states_json,
            'action_table': action_json,
            'goto_table': goto_json,
            'input_tokens': input_tokens,
            'parser_type': 'lr1'
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500


# ---------------------------------------------------------------------------
# Parser Descenso Recursivo
# ---------------------------------------------------------------------------

@app.route('/api/parse/recursive-descent', methods=['POST'])
def parse_recursive_descent():
    try:
        data = request.json
        grammar_text = data.get('grammar', '')
        input_text = data.get('input', '')

        if not grammar_text or not input_text:
            return jsonify({
                'error': 'Both grammar and input are required',
                'success': False
            }), 400

        result = recursive_descent_parse_from_text(grammar_text, input_text)

        if not result.get('success', False):
            return jsonify(result), 400

        return jsonify(result)

    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500


# ---------------------------------------------------------------------------
# Parser LL(1)
# ---------------------------------------------------------------------------

@app.route('/api/parse/ll1', methods=['POST'])
def parse_ll1():
    try:
        data = request.json
        grammar_text = data.get('grammar', '')
        input_text = data.get('input', '')

        if not grammar_text or not input_text:
            return jsonify({
                'error': 'Both grammar and input are required',
                'success': False
            }), 400

        result = ll1_parse_from_text(grammar_text, input_text)

        if not result.get('success', False):
            return jsonify(result), 400

        return jsonify(result)

    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500


# ---------------------------------------------------------------------------
# Listar parsers disponibles
# ---------------------------------------------------------------------------

@app.route('/api/parsers', methods=['GET'])
def list_parsers():
    parsers = [
        {
            "id": "recursive_descent",
            "name": "Descenso Recursivo",
            "type": "top-down",
            "endpoint": "/api/parse/recursive-descent",
            "description": "Parser de descenso recursivo con backtracking. Construye el árbol de derivación de arriba hacia abajo probando cada producción.",
            "supports_left_recursion": False,
        },
        {
            "id": "ll1",
            "name": "LL(1) Predictivo",
            "type": "top-down",
            "endpoint": "/api/parse/ll1",
            "description": "Parser predictivo LL(1). Construye tablas FIRST, FOLLOW y la tabla de parsing M[A,a]. Requiere gramáticas sin recursión izquierda y factorizadas.",
            "supports_left_recursion": False,
        },
        {
            "id": "lr1",
            "name": "LR(1)",
            "type": "bottom-up",
            "endpoint": "/api/parse/lr1",
            "description": "Parser LR(1) canónico. Construye el autómata LR(1) y las tablas ACTION/GOTO. Soporta recursión izquierda y es el más potente.",
            "supports_left_recursion": True,
        },
    ]
    return jsonify({
        'success': True,
        'parsers': parsers
    })


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'OK',
        'message': 'Parser Backend is running',
        'available_parsers': ['recursive_descent', 'll1', 'lr1']
    })


# ---------------------------------------------------------------------------
# Ejemplos
# ---------------------------------------------------------------------------

@app.route('/api/examples', methods=['GET'])
def get_examples():
    examples = [
        {
            "name": "Expresión Aritmética (LL(1))",
            "grammar": "E -> T EP\nEP -> + T EP\nEP -> ε\nT -> F TP\nTP -> * F TP\nTP -> ε\nF -> ( E )\nF -> id",
            "input": "id + id * id",
            "description": "Gramática de expresiones aritméticas sin recursión izquierda, apta para LL(1) y Descenso Recursivo.",
            "compatible_parsers": ["recursive_descent", "ll1", "lr1"]
        },
        {
            "name": "Expresión Simple (LL(1))",
            "grammar": "S -> a B\nS -> b A\nA -> a\nB -> b",
            "input": "a b",
            "description": "Gramática simple sin ambigüedades, apta para todos los parsers.",
            "compatible_parsers": ["recursive_descent", "ll1", "lr1"]
        },
        {
            "name": "Lista con separador (LL(1))",
            "grammar": "L -> E R\nR -> , E R\nR -> ε\nE -> id",
            "input": "id , id , id",
            "description": "Lista de identificadores separados por comas. Gramática LL(1).",
            "compatible_parsers": ["recursive_descent", "ll1", "lr1"]
        },
        {
            "name": "Expresión con Recursión Izquierda (LR(1))",
            "grammar": "E -> E + T\nE -> T\nT -> T * F\nT -> F\nF -> ( E )\nF -> id",
            "input": "id + id * id",
            "description": "Gramática con recursión izquierda. Solo compatible con parsers Bottom-Up.",
            "compatible_parsers": ["lr1"]
        },
        {
            "name": "If-Else (LR(1))",
            "grammar": "S -> if E then S else S\nS -> if E then S\nS -> other\nE -> id",
            "input": "if id then if id then other else other",
            "description": "Problema clásico del dangling else. Resuelto por LR(1).",
            "compatible_parsers": ["lr1"]
        },
        {
            "name": "Asignación Simple (LR(1))",
            "grammar": "S -> A a\nS -> B b\nA -> x\nB -> x",
            "input": "x a",
            "description": "Requiere lookahead para distinguir entre A y B.",
            "compatible_parsers": ["lr1"]
        },
        {
            "name": "Producción Epsilon (LR(1))",
            "grammar": "S -> a A\nS -> b B\nA -> C a\nA -> D b\nB -> C b\nB -> D a\nC -> E\nD -> E\nE -> ε",
            "input": "b b",
            "description": "Gramática con producciones epsilon.",
            "compatible_parsers": ["lr1"]
        }
    ]
    
    return jsonify({
        'success': True,
        'examples': examples
    })

if __name__ == '__main__':
    print("Starting Parser Backend...")
    print("API Endpoints:")
    print("  POST /api/parse                  - Parse (LR(1) default)")
    print("  POST /api/parse/lr1              - Parse with LR(1)")
    print("  POST /api/parse/ll1              - Parse with LL(1)")
    print("  POST /api/parse/recursive-descent - Parse with Recursive Descent")
    print("  GET  /api/parsers                - List available parsers")
    print("  GET  /api/health                 - Health check")
    print("  GET  /api/examples               - Get example grammars")
    print("\nServer running on http://localhost:5001")
    app.run(debug=True, host='0.0.0.0', port=5001)
