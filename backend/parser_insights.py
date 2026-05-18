"""
Asistente de análisis sintáctico: explicaciones en lenguaje natural,
recomendaciones ante conflictos y sugerencias hacia gramáticas LL(1).

Funciona con heurísticas deterministas (sin llamadas a modelos externos)
para que el laboratorio sea reproducible sin API keys.
"""
from __future__ import annotations

import re
from collections import defaultdict

from dot_export import automaton_to_dot, tree_to_dot
from nfa_lr import build_lr0_nfa, build_lr1_nfa, nfa_to_dot
from grammar_common import (
    load_grammar_from_string as _load_g,
    process_grammar as _proc_g,
    clear_first_cache as _clear_first,
    compute_first as _compute_first,
)


def _last_error_step(trace: list) -> dict | None:
    for step in reversed(trace or []):
        if step.get("type") == "error":
            return step
    return None


def _rules_from_payload(grammar_json: dict) -> list[tuple[int, str, list]]:
    out = []
    for r in grammar_json.get("rules") or []:
        out.append((r.get("rule_num", 0), r.get("lhs", ""), list(r.get("rhs") or [])))
    return sorted(out, key=lambda x: x[0])


def _immediate_left_recursion(rules: list[tuple[int, str, list]]) -> list[str]:
    found = []
    for _n, lhs, rhs in rules:
        if rhs and rhs[0] == lhs:
            found.append(lhs)
    return sorted(set(found))


def _common_prefix_len(a: list, b: list) -> int:
    n = min(len(a), len(b))
    i = 0
    while i < n and a[i] == b[i]:
        i += 1
    return i


def _left_factoring_candidates(rules: list[tuple[int, str, list]]) -> list[dict]:
    """Pares de producciones del mismo LHS con prefijo común no trivial."""
    by_lhs: dict[str, list] = defaultdict(list)
    for num, lhs, rhs in rules:
        by_lhs[lhs].append((num, rhs))
    suggestions = []
    for lhs, prods in by_lhs.items():
        if len(prods) < 2:
            continue
        for i, (n1, r1) in enumerate(prods):
            for n2, r2 in prods[i + 1 :]:
                k = _common_prefix_len(r1, r2)
                if k >= 1:
                    pref = " ".join(r1[:k])
                    suggestions.append(
                        {
                            "lhs": lhs,
                            "rule_nums": (n1, n2),
                            "prefix": pref,
                            "hint": (
                                f"Factoriza la izquierda en {lhs}: las reglas {n1} y {n2} "
                                f"comparten el prefijo «{pref}». Introduce un no terminal auxiliar "
                                f"(p. ej. {lhs}1) para el resto de cada producción."
                            ),
                        }
                    )
    return suggestions[:12]


def _explain_lr_error(action: str, parser_label: str) -> str:
    low = action.lower()
    if "no action for state" in low:
        m = re.search(r"state (\d+) with token (\S+)", action)
        if m:
            st, tok = m.group(1), m.group(2)
            return (
                f"El autómata {parser_label} llegó al estado {st} con el token «{tok}» en la entrada, "
                f"pero la tabla ACTION no define qué hacer: la cadena no pertenece al lenguaje descrito "
                f"o la gramática no es adecuada para este tipo de LR. Revisa que cada prefijo válido "
                f"tenga transiciones coherentes y que no falten reglas para construir «{tok}» en ese contexto."
            )
        return (
            f"No hay transición válida en la tabla ACTION para el estado y lookahead actuales. "
            f"La entrada no es reconocible con la gramática y el analizador {parser_label}."
        )
    if "no goto" in low:
        return (
            "Tras una reducción, la tabla GOTO no indica el siguiente estado para el no terminal reducido. "
            "Suele indicar incoherencia entre reglas y el autómata construido (revisa reglas duplicadas o símbolos mal escritos)."
        )
    return (
        f"El analizador {parser_label} detuvo el análisis: {action}. "
        "Compara la traza con la tabla ACTION/GOTO y las reglas para localizar el primer paso inválido."
    )


def _explain_ll_error(action: str) -> str:
    low = action.lower()
    if "m[" in low and "vacío" in low:
        return (
            "La tabla predictiva LL(1) no tiene producción para el par (no terminal en la cima, siguiente token). "
            "Eso significa que el token actual no está en FIRST del cuerpo de ninguna alternativa aplicable "
            "ni se justifica por FOLLOW con ε. Revisa FIRST/FOLLOW o cambia de parser a LR si la gramática es recursiva a izquierda."
        )
    if "ambigüedad" in low or "conflicto ll" in low:
        return (
            "La gramática no es LL(1): hay al menos una celda M[A,a] con más de una producción. "
            "Necesitas factorizar prefijos comunes o eliminar recursión a izquierda para obtener una tabla unívoca."
        )
    if "terminal inesperado" in low or "se esperaba" in low:
        return (
            "El token de la entrada no coincide con lo que la derivación predictiva exige en este punto: "
            "o sobran símbolos, o faltan, o el orden no respeta la gramática en forma LL(1)."
        )
    if "sobran tokens" in low:
        return (
            "El análisis descendente terminó antes de consumir toda la entrada: el axioma se cerró demasiado pronto. "
            "Revisa que la gramática genere exactamente el lenguaje deseado para esa cadena."
        )
    return f"Error en análisis LL(1) / descenso: {action}"


def build_intelligent_insights(
    parser_id: str,
    parser_family: str,
    parser_label: str,
    grammar_text: str,
    input_text: str,
    payload: dict,
) -> dict:
    """
    Devuelve bloques listos para mostrar en la UI (español).
    """
    trace = payload.get("trace") or []
    valid = bool(payload.get("valid"))
    conflicts = payload.get("conflicts") or []
    grammar_json = payload.get("grammar") or {}
    rules = _rules_from_payload(grammar_json)
    input_tokens = payload.get("input_tokens") or []
    parse_table = payload.get("parse_table")

    out: dict = {
        "mode": "heuristic",
        "mode_description": "Análisis local basado en trazas, tablas y patrones de gramática (sin modelo de lenguaje externo).",
        "error_natural_language": None,
        "error_detail_bullets": [],
        "ambiguity_recommendations": [],
        "ll1_transformation_suggestions": [],
        "testing_hints": [],
    }

    # --- Errores sintácticos en lenguaje natural ---
    if not valid:
        err = _last_error_step(trace)
        if err:
            action = err.get("action") or ""
            out["error_natural_language"] = (
                err.get("explain")
                if err.get("explain")
                else (
                    _explain_ll_error(action)
                    if parser_family == "topdown"
                    else _explain_lr_error(action, parser_label)
                )
            )
            out["error_detail_bullets"].append(f"Paso de fallo: «{action}».")
            if input_tokens:
                out["error_detail_bullets"].append(
                    f"Tokens de entrada: {' '.join(input_tokens)}."
                )
        else:
            out["error_natural_language"] = (
                "La cadena no fue aceptada, pero no se encontró un paso de error explícito en la traza. "
                "Revisa conflictos de tabla o una condición de aceptación no alcanzada."
            )
    else:
        out["error_natural_language"] = (
            "No se detectaron errores sintácticos: la cadena es aceptada por el algoritmo seleccionado "
            f"({parser_label})."
        )

    # --- Conflictos / ambigüedad ---
    if conflicts:
        out["ambiguity_recommendations"].append(
            f"Se reportaron {len(conflicts)} conflicto(s) o advertencia(s) al construir tablas. "
            "Los conflictos shift/reduce o reduce/reduce indican que la especificación LR es ambigua "
            "o demasiado pobre para el método (p. ej. LR(0) frente a SLR/LR(1))."
        )
        for c in conflicts[:5]:
            msg = c if isinstance(c, str) else c.get("message", str(c))
            out["ambiguity_recommendations"].append(f"• {msg}")
        if parser_id == "lr0":
            out["ambiguity_recommendations"].append(
                "Prueba SLR(1) o LR(1) con la misma gramática: suelen reducir conflictos al restringir "
                "las reducciones con FOLLOW o lookahead."
            )
        if parser_id in ("slr1", "lalr1"):
            out["ambiguity_recommendations"].append(
                "Si persisten conflictos, LR(1) puede discriminar más casos; si aún falla, la gramática "
                "puede ser inherentemente ambigua para LR."
            )
    elif parser_family == "lr":
        out["ambiguity_recommendations"].append(
            "No se registraron conflictos en la construcción de tablas para esta ejecución."
        )

    # --- Sugerencias hacia LL(1) ---
    lr_nts = _immediate_left_recursion(rules)
    if lr_nts:
        for nt in lr_nts[:8]:
            out["ll1_transformation_suggestions"].append(
                {
                    "type": "left_recursion",
                    "symbol": nt,
                    "text": (
                        f"Elimina la recursión inmediata a izquierda en «{nt}» (producción {nt} → {nt} …). "
                        "Técnica clásica: reescribir como A → A α | β con A → β A' y A' → α A' | ε."
                    ),
                }
            )

    for cand in _left_factoring_candidates(rules):
        out["ll1_transformation_suggestions"].append(
            {
                "type": "left_factor",
                "lhs": cand["lhs"],
                "text": cand["hint"],
            }
        )

    if parse_table and parser_family == "topdown":
        multi = 0
        for nt, cols in parse_table.items():
            for a, cells in (cols or {}).items():
                if isinstance(cells, list) and len(cells) > 1:
                    multi += 1
        if multi:
            out["ll1_transformation_suggestions"].append(
                {
                    "type": "table_conflict",
                    "text": (
                        f"Hay {multi} celda(s) con más de una producción en la tabla LL(1). "
                        "Factoriza prefijos o separa casos con nuevos no terminales hasta que cada M[A,a] tenga a lo sumo una regla."
                    ),
                }
            )

    if not out["ll1_transformation_suggestions"] and parser_family == "lr":
        out["ll1_transformation_suggestions"].append(
            {
                "type": "info",
                "text": (
                    "Para usar LL(1) o descenso recursivo predictivo con esta gramática, elimina recursión a izquierda "
                    "y factoriza prefijos comunes; luego vuelve a comprobar FIRST/FOLLOW y la tabla M."
                ),
            }
        )

    # --- Pistas de prueba ---
    out["testing_hints"].append(
        "Prueba la misma entrada con LR(1) y con LL(1): si LR acepta y LL rechaza, suele deberse a recursión izquierda o a falta de factorización."
    )
    out["testing_hints"].append(
        "Usa cadenas mínimas (un token, dos tokens) para aislar la primera regla que falla."
    )
    if "ε" in grammar_text or "epsilon" in grammar_text.lower():
        out["testing_hints"].append(
            "Con producciones ε, verifica que FIRST y FOLLOW propaguen correctamente los finales de frase."
        )

    return out


def enrich_parse_response(parser_id: str, grammar_text: str, input_text: str, payload: dict) -> dict:
    """Añade `intelligent_assistant` + `dot_automaton` + `dot_tree` al payload de /api/parse."""
    family = payload.get("parser_family") or "lr"
    label = payload.get("parser_label") or parser_id
    payload = dict(payload)
    payload["intelligent_assistant"] = build_intelligent_insights(
        parser_id, family, label, grammar_text, input_text, payload
    )

    # Serialización a DOT (Graphviz) para visualización en el frontend.
    states = payload.get("states")
    if states:
        payload["dot_automaton"] = automaton_to_dot(
            states,
            payload.get("action_table") or {},
            payload.get("goto_table") or {},
        )
    else:
        payload["dot_automaton"] = None

    tree = payload.get("parse_tree") or payload.get("derivation_tree")
    payload["dot_tree"] = tree_to_dot(tree)

    # AFN de ítems LR(0)/LR(1) — solo para bottom-up. Cada ítem es un nodo;
    # las ε-aristas son el closure (la subset-construction de esto = el DFA).
    payload["dot_nfa"] = None
    payload["nfa_kind"] = None
    if family == "lr" and grammar_text:
        try:
            _clear_first()
            g_lines = _load_g(grammar_text)
            g_dict, g_rules = _proc_g(g_lines)
            nts_list = list(g_dict.keys())
            if nts_list:
                start_sym = nts_list[0]
                for nt in nts_list:
                    _compute_first(nt, g_dict)
                if parser_id in ("lr1", "lalr1"):
                    nfa_items, nfa_trans, nfa_accept = build_lr1_nfa(g_dict, start_sym)
                    payload["nfa_kind"] = "LR(1)"
                else:
                    nfa_items, nfa_trans, nfa_accept = build_lr0_nfa(g_dict, start_sym)
                    payload["nfa_kind"] = "LR(0)"
                payload["dot_nfa"] = nfa_to_dot(nfa_items, nfa_trans, nfa_accept)
        except Exception:
            # No rompemos el endpoint si la gramática es malformada.
            payload["dot_nfa"] = None
            payload["nfa_kind"] = None

    # Pertenencia a la clase del parser — informa al usuario si la gramática
    # cabe limpiamente en LR(0)/SLR(1)/LALR(1)/LR(1)/LL(1) según conflictos de tabla.
    conflicts = payload.get("conflicts") or []
    n_conf = len(conflicts)
    in_class = n_conf == 0
    if in_class:
        reason = f"Sin conflictos en la construcción de tablas — la gramática es {label}."
    else:
        reason = (
            f"La gramática NO es {label}: hay {n_conf} conflicto(s) de tabla. "
            "Las acciones ambiguas se resuelven con preferencia (no garantiza corrección)."
        )
    payload["in_class"] = in_class
    payload["in_class_reason"] = reason
    payload["in_class_label"] = label

    return payload
