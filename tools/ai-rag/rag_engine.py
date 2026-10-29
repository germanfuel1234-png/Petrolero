#!/usr/bin/env python3
"""
RAG local para el repo Petrolero.

Indexa la memoria del proyecto (.ai/*.md) y el código fuente clave (packages/shared,
apps/api/src, apps/web/src) en una base de vectores local (ChromaDB), usando embeddings
generados por un modelo que corre en Ollama (por defecto nomic-embed-text).

No depende de ningún servicio externo ni de API keys: todo corre en la máquina del
desarrollador. Pensado para inyectar contexto relevante a un asistente de IA antes de
una tarea, no para usarse desde la aplicación en producción.

Requisitos:
    - Ollama corriendo localmente (`ollama serve`) con el modelo de embeddings bajado:
        ollama pull nomic-embed-text
    - pip install -r requirements.txt

Uso:
    python rag_engine.py index                 # (re)construye el índice completo
    python rag_engine.py query "pregunta..."    # busca los chunks más relevantes
    python rag_engine.py query "pregunta..." --k 8
    python rag_engine.py clear                  # borra el índice
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CHROMA_DIR = PROJECT_ROOT / ".ai" / ".chroma"
COLLECTION_NAME = "petrolero"

EMBED_MODEL = "nomic-embed-text"

# Patrones relativos a PROJECT_ROOT. Cubren la memoria del proyecto (.ai/) y el código
# fuente que define dominio, reglas de negocio y endpoints — no assets, tests ni generados.
SOURCE_PATTERNS = [
    ".ai/*.md",
    "README.md",
    "SPECS.md",
    "MVP.md",
    "PENDIENTES-CLIENTE.md",
    "packages/shared/src/**/*.ts",
    "apps/api/prisma/schema.prisma",
    "apps/api/src/**/*.ts",
    "apps/web/src/**/*.ts",
    "apps/web/src/**/*.tsx",
]

EXCLUDE_DIR_NAMES = {"node_modules", "dist", "build", "coverage", ".git", ".chroma"}

CHUNK_MAX_CHARS = 1500
CHUNK_OVERLAP = 200


@dataclass
class Chunk:
    source: str  # ruta relativa al repo, ej "apps/api/src/mantenimiento/mantenimiento.service.ts"
    index: int
    text: str

    @property
    def id(self) -> str:
        return f"{self.source}::{self.index}"


def _excluido(ruta: Path) -> bool:
    return any(parte in EXCLUDE_DIR_NAMES for parte in ruta.parts)


def recolectar_archivos() -> list[Path]:
    archivos: list[Path] = []
    vistos: set[Path] = set()
    for patron in SOURCE_PATTERNS:
        for ruta in PROJECT_ROOT.glob(patron):
            if not ruta.is_file() or _excluido(ruta) or ruta in vistos:
                continue
            vistos.add(ruta)
            archivos.append(ruta)
    return sorted(archivos)


def chunkear(texto: str, max_chars: int = CHUNK_MAX_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Chunking simple por párrafos/líneas, con solapamiento para no cortar contexto a la mitad.

    No parsea sintaxis (Markdown ni TypeScript): junta líneas hasta el límite de caracteres,
    cortando preferentemente en una línea en blanco. Es deliberadamente simple — para este
    tamaño de repo alcanza y evita sumar una dependencia de parsing.
    """
    lineas = texto.split("\n")
    chunks: list[str] = []
    actual: list[str] = []
    largo_actual = 0

    for linea in lineas:
        if largo_actual + len(linea) + 1 > max_chars and actual:
            chunks.append("\n".join(actual))
            # Solapamiento: arrastra las últimas líneas del chunk anterior.
            cola: list[str] = []
            largo_cola = 0
            for l in reversed(actual):
                if largo_cola + len(l) > overlap:
                    break
                cola.insert(0, l)
                largo_cola += len(l) + 1
            actual = cola
            largo_actual = largo_cola

        actual.append(linea)
        largo_actual += len(linea) + 1

    if actual:
        chunks.append("\n".join(actual))

    return [c.strip() for c in chunks if c.strip()]


def construir_chunks() -> list[Chunk]:
    chunks: list[Chunk] = []
    for ruta in recolectar_archivos():
        try:
            texto = ruta.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError) as error:
            print(f"  aviso: no se pudo leer {ruta}: {error}", file=sys.stderr)
            continue
        if not texto.strip():
            continue
        relativo = str(ruta.relative_to(PROJECT_ROOT))
        for i, texto_chunk in enumerate(chunkear(texto)):
            chunks.append(Chunk(source=relativo, index=i, text=texto_chunk))
    return chunks


def _cliente_ollama():
    try:
        import ollama
    except ImportError:
        print(
            "Falta el paquete 'ollama'. Instalá las dependencias con:\n"
            "  pip install -r tools/ai-rag/requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)
    return ollama


def embeber(textos: list[str]) -> list[list[float]]:
    """Genera un embedding por texto llamando a Ollama. Sin API de batch: uno por uno."""
    ollama = _cliente_ollama()
    vectores: list[list[float]] = []
    try:
        for texto in textos:
            respuesta = ollama.embeddings(model=EMBED_MODEL, prompt=texto)
            vectores.append(respuesta["embedding"])
    except Exception as error:  # conexión rechazada, modelo no encontrado, etc.
        print(
            f"\nError llamando a Ollama ({error}).\n"
            "Verificá que esté corriendo (`ollama serve`) y que el modelo de embeddings "
            f"esté descargado:\n  ollama pull {EMBED_MODEL}",
            file=sys.stderr,
        )
        sys.exit(1)
    return vectores


def _coleccion():
    try:
        import chromadb
    except ImportError:
        print(
            "Falta el paquete 'chromadb'. Instalá las dependencias con:\n"
            "  pip install -r tools/ai-rag/requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    cliente = chromadb.PersistentClient(path=str(CHROMA_DIR))
    # embedding_function=None: los vectores se calculan acá con Ollama y se pasan explícitos
    # a .add()/.query(), así Chroma no intenta usar su propio modelo por defecto.
    return cliente.get_or_create_collection(name=COLLECTION_NAME)


def comando_index(_args: argparse.Namespace) -> None:
    chunks = construir_chunks()
    if not chunks:
        print("No se encontraron archivos para indexar. Revisá SOURCE_PATTERNS.")
        return

    print(f"Indexando {len(chunks)} chunks de {len({c.source for c in chunks})} archivos…")

    coleccion = _coleccion()
    # Reconstrucción completa: más simple y predecible que hacer diffing incremental.
    existentes = coleccion.get(include=[])["ids"]
    if existentes:
        coleccion.delete(ids=existentes)

    lote = 32
    for inicio in range(0, len(chunks), lote):
        grupo = chunks[inicio : inicio + lote]
        vectores = embeber([c.text for c in grupo])
        coleccion.add(
            ids=[c.id for c in grupo],
            embeddings=vectores,
            documents=[c.text for c in grupo],
            metadatas=[{"source": c.source, "chunk": c.index} for c in grupo],
        )
        print(f"  {min(inicio + lote, len(chunks))}/{len(chunks)}")

    print(f"Listo. Índice persistido en {CHROMA_DIR}")


def comando_query(args: argparse.Namespace) -> None:
    coleccion = _coleccion()
    if coleccion.count() == 0:
        print("El índice está vacío. Corré primero: python rag_engine.py index")
        return

    (vector,) = embeber([args.pregunta])
    resultados = coleccion.query(query_embeddings=[vector], n_results=args.k)

    documentos = resultados["documents"][0]
    metadatas = resultados["metadatas"][0]
    distancias = resultados["distances"][0]

    for i, (doc, meta, dist) in enumerate(zip(documentos, metadatas, distancias), start=1):
        print(f"\n[{i}] {meta['source']} (chunk {meta['chunk']}, distancia {dist:.4f})")
        print("-" * 70)
        print(doc[:800] + ("…" if len(doc) > 800 else ""))


def comando_clear(_args: argparse.Namespace) -> None:
    import shutil

    if CHROMA_DIR.exists():
        shutil.rmtree(CHROMA_DIR)
        print(f"Índice borrado ({CHROMA_DIR})")
    else:
        print("No había índice para borrar.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    subparsers = parser.add_subparsers(dest="comando", required=True)

    subparsers.add_parser("index", help="(Re)construye el índice vectorial completo").set_defaults(
        func=comando_index
    )

    parser_query = subparsers.add_parser("query", help="Busca los chunks más relevantes para una pregunta")
    parser_query.add_argument("pregunta", help="Pregunta o tema a buscar")
    parser_query.add_argument("--k", type=int, default=5, help="Cantidad de resultados (default: 5)")
    parser_query.set_defaults(func=comando_query)

    subparsers.add_parser("clear", help="Borra el índice persistido").set_defaults(func=comando_clear)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
