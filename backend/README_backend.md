# LR(1) Parser Backend

Este es un backend simple para el parser LR(1) que expone una API REST para ser consumida por un frontend.

## Estructura del proyecto

- `lr1_parser.py`: Implementación core del parser LR(1) con todas las funciones de análisis
- `lr1_backend.py`: Servidor Flask que expone la API REST
- `README_backend.md`: Este archivo de documentación

## Instalación

1. Instalar las dependencias:
```bash
pip install -r requirements.txt
```

2. Ejecutar el servidor:
```bash
python lr1_backend.py
```

El servidor estará disponible en `http://localhost:5001`

## API Endpoints

### POST /api/parse
Parsea un input con una gramática dada.

**Request Body:**
```json
{
  "grammar": "E -> E + T\nE -> T\nT -> id",
  "input": "id + id"
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "trace": [...],
  "grammar": {
    "rules": [...],
    "non_terminals": [...],
    "terminals": [...]
  },
  "states": [...],
  "action_table": {...},
  "goto_table": {...},
  "input_tokens": [...]
}
```

### GET /api/health
Verifica que el servidor esté funcionando.

**Response:**
```json
{
  "status": "OK",
  "message": "LR(1) Parser Backend is running"
}
```

### GET /api/examples
Obtiene ejemplos de gramáticas predefinidas.

**Response:**
```json
{
  "success": true,
  "examples": [
    {
      "name": "Basic Expression",
      "grammar": "E -> E + T\nE -> T\nT -> T * F\nT -> F\nF -> ( E )\nF -> id",
      "input": "id + id * id",
      "description": "Left-recursive arithmetic expression grammar"
    }
  ]
}
```

## Ejemplos de uso

### Con curl:
```bash
# Parsear una expresión
curl -X POST http://localhost:5000/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "grammar": "E -> E + T\nE -> T\nT -> id",
    "input": "id + id"
  }'

# Obtener ejemplos
curl http://localhost:5000/api/examples

# Health check
curl http://localhost:5000/api/health
```

### Con JavaScript (frontend):
```javascript
// Parsear input
const response = await fetch('http://localhost:5000/api/parse', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    grammar: 'E -> E + T\nE -> T\nT -> id',
    input: 'id + id'
  })
});

const result = await response.json();
console.log(result);
```

## Estructura de respuesta

La respuesta del endpoint `/api/parse` incluye:

- **success**: `boolean` - Si la operación fue exitosa
- **valid**: `boolean` - Si el input es válido según la gramática
- **trace**: `array` - Traza paso a paso del parsing
- **grammar**: `object` - Información sobre la gramática procesada
- **states**: `array` - Estados del autómata LR(1)
- **action_table**: `object` - Tabla ACTION del parser
- **goto_table**: `object` - Tabla GOTO del parser
- **input_tokens**: `array` - Tokens del input procesado

## Funciones del Parser LR(1) (`lr1_parser.py`)

### Funciones principales:
- `load_grammar_from_string()`: Carga gramática desde texto
- `process_grammar()`: Procesa gramática a representación interna
- `get_symbols()`: Extrae terminales y no terminales
- `compute_first()`: Calcula conjuntos FIRST
- `compute_follow()`: Calcula conjuntos FOLLOW (incluido por completitud)
- `closure()`: Calcula la cerradura de items LR(1)
- `goto()`: Calcula la función GOTO
- `build_lr1_automaton()`: Construye el autómata LR(1)
- `build_lr1_parsing_table()`: Construye las tablas ACTION y GOTO
- `lr1_parse()`: Ejecuta el algoritmo de parsing LR(1)

### Clase LRItem:
Representa un item LR(1) con:
- `rule_num`: Número de regla
- `lhs`: Lado izquierdo de la producción
- `rhs`: Lado derecho de la producción
- `dot_pos`: Posición del punto
- `lookahead`: Símbolo de lookahead

## Características

- ✅ Manejo de gramáticas con recursión izquierda
- ✅ Soporte para producciones epsilon (ε)
- ✅ Resolución de ambigüedades mediante LR(1)
- ✅ CORS habilitado para consumo desde frontend
- ✅ Manejo de errores robusto
- ✅ Ejemplos predefinidos
- ✅ Formato JSON estructurado
- ✅ Código modular separado en parser y backend
