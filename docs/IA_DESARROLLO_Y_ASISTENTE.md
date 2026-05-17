# Uso de herramientas de IA en el desarrollo y asistente en la aplicación

Este documento resume cómo encaja el **asistente inteligente integrado** en el producto y cómo encajan las **herramientas de IA** (por ejemplo Cursor) en el ciclo de desarrollo del proyecto `PextraE2_2`.

## 1. Generación y optimización de código

- **Asistente en el IDE**: generación de módulos de parsers (LR(0), SLR, LALR, LR(1), LL(1), descenso recursivo), refactor de `grammar_common`, componentes React (tablas, autómata, simulación paso a paso) y reducción de duplicación mediante funciones compartidas.
- **Optimización**: mantener la lógica pesada en el backend (Python) y respuestas JSON explícitas para que el frontend solo visualice; evitar recomputar FIRST/FOLLOW en el cliente.

## 2. Depuración y pruebas

- **Suite existente**: `backend/run_all_tests.py` valida el núcleo LR(1) sobre gramáticas de ejemplo.
- **Depuración**: trazas JSON (`trace_*.json`), endpoints `/api/health` y errores devueltos por `/api/parse`; el asistente usa la **última fila de error** de la traza para explicar fallos en lenguaje natural.
- **Pruebas manuales**: comparar dos algoritmos en la UI y revisar el panel **Depuración y pruebas** del asistente.

## 3. Diseño de interfaz

- Patrones **React Bootstrap** (acordeones, tablas, badges) para coherencia visual.
- Componentes dedicados: teclado de símbolos formales, matrices ACTION/GOTO dinámicas, simulador de pasos, árboles sintácticos y panel del asistente inteligente.

## 4. Documentación automática / generada

- Este archivo (`docs/IA_DESARROLLO_Y_ASISTENTE.md`) describe el proceso y el contrato del campo JSON `intelligent_assistant` en las respuestas de **`POST /api/parse`**.
- Las **explicaciones en tiempo de ejecución** se generan en el backend (`parser_insights.py`) y se muestran en **`IntelligentAssistantPanel`**.

---

## Asistente integrado (`intelligent_assistant`)

Cada respuesta exitosa de `POST /api/parse` incluye un objeto **`intelligent_assistant`** con:

| Campo | Contenido |
|--------|------------|
| `mode` | Siempre `heuristic` en la implementación actual: reglas deterministas sobre la traza y la gramática. |
| `mode_description` | Aclara que no se llama a modelos externos (no hace falta API key). |
| `error_natural_language` | Párrafo en español: éxito o causa probable del fallo sintáctico. |
| `error_detail_bullets` | Viñetas con detalles (p. ej. mensaje técnico del paso de error, tokens). |
| `ambiguity_recommendations` | Consejos ante **conflictos de tablas** (LR(0) vs SLR/LR(1), etc.). |
| `ll1_transformation_suggestions` | Lista de objetos `{ type, text, ... }`: recursión izquierda, factorización izquierda, conflictos en tabla LL(1). |
| `testing_hints` | Ideas para **pruebas** (misma cadena con LR vs LL, cadenas mínimas, ε). |

### Extensión futura con modelo de lenguaje

La arquitectura permite añadir una capa opcional (p. ej. OpenAI) que **reescriba o amplíe** el mismo JSON sin cambiar el contrato de la API. La versión actual prioriza **reproducibilidad en laboratorio** sin dependencias de red ni claves.

---

## Resumen

| Área | Enfoque en este proyecto |
|------|---------------------------|
| IA en desarrollo | Cursor / asistente para código, UI y depuración. |
| IA en producto | Heurísticas en `parser_insights.py` + UI `IntelligentAssistantPanel`. |
| Documentación | Este documento + comentarios en código y respuestas JSON autodocumentadas. |
