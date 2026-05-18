/**
 * Linter de gramática — análisis estático puro, sin red.
 *
 * lintGrammar(text, {topDown?: boolean}) → Hint[]
 *   Hint = { severity: 'error'|'warning'|'info',
 *            rule: string,
 *            message: string,
 *            line?: number,         // 1-based
 *            symbol?: string }
 *
 * Reglas (cubren los problemas más comunes antes de enviar al backend):
 *   1 missing-arrow   error    línea no vacía sin '->' ni '→'
 *   2 empty-lhs       error    LHS vacío antes del separador
 *   3 empty-rhs       warning  'A ->' sin RHS (sugerir 'A -> ε')
 *   4 undefined-nt    warning  símbolo en RHS que parece NT pero sin producción
 *   5 unused-nt       info     LHS declarado pero nunca usado (excepto símbolo inicial)
 *   6 left-recursion  info     'A -> A α …'
 *   7 common-prefix   info     dos producciones del mismo LHS con prefijo común (solo topDown)
 *   8 duplicate       info     'A -> α' repetida
 */

const ARROW_RE = /->|→/;
const EPSILON_TOKENS = new Set(['ε', 'epsilon', 'λ']);

const tokenize = (rhsStr) =>
  rhsStr.trim() === '' ? [] : rhsStr.trim().split(/\s+/);

const parseLine = (raw, idx) => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const m = trimmed.match(ARROW_RE);
  if (!m) {
    return { line: idx + 1, raw: trimmed, error: 'missing-arrow' };
  }
  const at = m.index;
  const lhs = trimmed.slice(0, at).trim();
  const rhsStr = trimmed.slice(at + m[0].length);
  return {
    line: idx + 1,
    raw: trimmed,
    lhs,
    rhs: tokenize(rhsStr),
    rhsRaw: rhsStr,
  };
};

const commonPrefixLen = (a, b) => {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
};

export function lintGrammar(text, options = {}) {
  const hints = [];
  if (!text || typeof text !== 'string') return hints;

  const lines = text.split('\n').map(parseLine).filter(Boolean);

  // Reglas 1 y 2: errores estructurales.
  const valid = [];
  for (const ln of lines) {
    if (ln.error === 'missing-arrow') {
      hints.push({
        severity: 'error',
        rule: 'missing-arrow',
        line: ln.line,
        message: `Línea ${ln.line}: falta el separador «->» o «→» entre LHS y RHS.`,
      });
      continue;
    }
    if (!ln.lhs) {
      hints.push({
        severity: 'error',
        rule: 'empty-lhs',
        line: ln.line,
        message: `Línea ${ln.line}: el lado izquierdo de la producción está vacío.`,
      });
      continue;
    }
    if (ln.rhs.length === 0) {
      hints.push({
        severity: 'warning',
        rule: 'empty-rhs',
        line: ln.line,
        symbol: ln.lhs,
        message: `Línea ${ln.line}: «${ln.lhs} ->» sin cuerpo. Si querías una producción vacía, escribe «${ln.lhs} -> ε».`,
      });
      continue;
    }
    valid.push(ln);
  }

  if (valid.length === 0) return hints;

  const nonTerminals = new Set(valid.map((v) => v.lhs));
  const usedInRhs = new Set();
  for (const v of valid) {
    for (const s of v.rhs) {
      if (!EPSILON_TOKENS.has(s)) usedInRhs.add(s);
    }
  }
  const startSymbol = valid[0].lhs;

  // Regla 4: símbolo en RHS que parece NT (= existe como LHS de otra cadena pero no en este conjunto)
  // En realidad, si está en nonTerminals está definido, así que esta regla queda más útil para
  // símbolos que comparten patrón con otros NTs pero sin producción (poco frecuente).
  // Implementación práctica: marcamos un símbolo del RHS como sospechoso si:
  //   - no es terminal "obvio" (no contiene caracteres especiales típicos de terminales)
  //   - empieza por mayúscula o termina en ' (notación típica de NT)
  //   - y NO aparece en nonTerminals
  // Pero esto es heurístico: muchos terminales son `id`, `if`, etc. Para evitar ruido,
  // solo reportamos cuando el símbolo es claramente NT-like: mayúscula inicial o sufijo «'» o «_».
  const looksLikeNT = (sym) =>
    /^[A-Z]/.test(sym) || sym.endsWith("'") || /_/.test(sym);

  const seenUndefined = new Set();
  for (const v of valid) {
    for (const s of v.rhs) {
      if (EPSILON_TOKENS.has(s)) continue;
      if (nonTerminals.has(s)) continue;
      if (looksLikeNT(s) && !seenUndefined.has(s)) {
        seenUndefined.add(s);
        hints.push({
          severity: 'warning',
          rule: 'undefined-nt',
          symbol: s,
          message: `«${s}» parece un no terminal (mayúscula o sufijo), pero no tiene producción. ¿Falta la regla «${s} -> …»?`,
        });
      }
    }
  }

  // Regla 5: LHS sin uso (excepto el símbolo inicial).
  for (const nt of nonTerminals) {
    if (nt === startSymbol) continue;
    if (!usedInRhs.has(nt)) {
      hints.push({
        severity: 'info',
        rule: 'unused-nt',
        symbol: nt,
        message: `«${nt}» está declarado pero ningún otro no terminal lo usa. ¿Es alcanzable desde «${startSymbol}»?`,
      });
    }
  }

  // Regla 6: recursión izquierda directa.
  const seenLeftRec = new Set();
  for (const v of valid) {
    if (v.rhs.length > 0 && v.rhs[0] === v.lhs && !seenLeftRec.has(v.lhs)) {
      seenLeftRec.add(v.lhs);
      hints.push({
        severity: 'info',
        rule: 'left-recursion',
        line: v.line,
        symbol: v.lhs,
        message: `Recursión izquierda directa en «${v.lhs}» (regla «${v.lhs} -> ${v.lhs} …»). LR la maneja; LL(1) y descenso recursivo requieren reescribirla.`,
      });
    }
  }

  // Regla 7: prefijo común (solo Top-Down).
  if (options.topDown) {
    const byLhs = new Map();
    for (const v of valid) {
      if (!byLhs.has(v.lhs)) byLhs.set(v.lhs, []);
      byLhs.get(v.lhs).push(v);
    }
    const reportedPrefixes = new Set();
    for (const [lhs, prods] of byLhs.entries()) {
      if (prods.length < 2) continue;
      for (let i = 0; i < prods.length; i += 1) {
        for (let j = i + 1; j < prods.length; j += 1) {
          const k = commonPrefixLen(prods[i].rhs, prods[j].rhs);
          if (k >= 1) {
            const pref = prods[i].rhs.slice(0, k).join(' ');
            const key = `${lhs}|${pref}`;
            if (reportedPrefixes.has(key)) continue;
            reportedPrefixes.add(key);
            hints.push({
              severity: 'info',
              rule: 'common-prefix',
              symbol: lhs,
              line: prods[j].line,
              message: `«${lhs}» tiene producciones con prefijo común «${pref}» (líneas ${prods[i].line} y ${prods[j].line}). Factorízalas para que sea LL(1).`,
            });
          }
        }
      }
    }
  }

  // Regla 8: producciones duplicadas.
  const seenProds = new Map();
  for (const v of valid) {
    const key = `${v.lhs} -> ${v.rhs.join(' ')}`;
    if (seenProds.has(key)) {
      hints.push({
        severity: 'info',
        rule: 'duplicate',
        line: v.line,
        message: `Línea ${v.line}: producción duplicada (también está en la línea ${seenProds.get(key)}).`,
      });
    } else {
      seenProds.set(key, v.line);
    }
  }

  return hints;
}

export const hasGrammarErrors = (text) =>
  lintGrammar(text).some((h) => h.severity === 'error');
