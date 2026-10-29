# RAG local — Petrolero

Herramienta de desarrollo (no forma parte de la app) para hacer búsqueda semántica sobre la
memoria del proyecto (`.ai/*.md`) y el código fuente clave (`packages/shared`, `apps/api/src`,
`apps/web/src`). Sirve para recuperar rápido los fragmentos relevantes antes de pedirle una
tarea a un asistente de IA, sin depender de ningún servicio externo.

## Setup

```bash
# 1. Ollama corriendo localmente, con el modelo de embeddings descargado
ollama pull nomic-embed-text

# 2. Dependencias de Python (usar un virtualenv)
cd tools/ai-rag
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Uso

```bash
# Construye (o reconstruye desde cero) el índice vectorial
python rag_engine.py index

# Consulta semántica
python rag_engine.py query "¿cómo se calcula la próxima revisión de una válvula?"
python rag_engine.py query "qué agrupa el planificador semanal" --k 8

# Borra el índice persistido
python rag_engine.py clear
```

El índice se persiste en `.ai/.chroma/` (ChromaDB, local, en disco — no se versiona).
Correr `index` de nuevo después de cambios importantes en `.ai/` o en el código fuente que
cubre `SOURCE_PATTERNS` (ver `rag_engine.py`); no hay watcher ni reindexado automático.

## Por qué así

- **Embeddings locales (Ollama)**: nada de código ni de los supuestos del cliente sale de la
  máquina del desarrollador.
- **ChromaDB embebido**: base de vectores liviana, sin servidor aparte, un directorio en disco.
- **Chunking simple por líneas**: no vale la pena un parser de Markdown/TypeScript para el
  tamaño actual del repo; si el proyecto crece mucho, migrar a chunking consciente de sintaxis
  (ej. por función/clase en TS, por heading en Markdown) es la siguiente mejora natural.
