#!/usr/bin/env node
/**
 * Servidor MCP del proyecto Petrolero.
 *
 * Expone dos herramientas de solo lectura para asistentes de IA compatibles con MCP:
 *
 *   - buscar_memoria: búsqueda semántica sobre .ai/ y el código fuente clave,
 *     delegando en el RAG local (tools/ai-rag/rag_engine.py).
 *   - supuestos_pendientes: lista las decisiones de negocio tomadas sin confirmación
 *     del cliente (packages/shared/src/supuestos.ts).
 *
 * Deliberadamente NO expone consultas a la base de datos: eso requeriría credenciales
 * embebidas y una política explícita de solo-lectura que todavía no se definió. Ver
 * tools/mcp-server/README.md para por qué y cómo extenderlo si hace falta.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const RAG_SCRIPT = path.join(PROJECT_ROOT, 'tools', 'ai-rag', 'rag_engine.py');
const SUPUESTOS_DIST = path.join(PROJECT_ROOT, 'packages', 'shared', 'dist', 'supuestos.js');

function ejecutar(comando, args) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(comando, args, { cwd: PROJECT_ROOT });
    let stdout = '';
    let stderr = '';
    proceso.stdout.on('data', (d) => (stdout += d));
    proceso.stderr.on('data', (d) => (stderr += d));
    proceso.on('error', reject);
    proceso.on('close', (codigo) => {
      if (codigo === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `${comando} salió con código ${codigo}`));
    });
  });
}

const server = new McpServer({ name: 'petrolero', version: '0.1.0' });

server.tool(
  'buscar_memoria',
  'Busca por similitud semántica en la memoria del proyecto (.ai/) y el código fuente clave ' +
    '(packages/shared, apps/api/src, apps/web/src). Usar antes de implementar algo para ' +
    'recuperar contexto, reglas de negocio o convenciones ya documentadas.',
  {
    pregunta: z.string().describe('Pregunta o tema a buscar, en lenguaje natural'),
    k: z.number().int().min(1).max(20).optional().describe('Cantidad de resultados (default 5)'),
  },
  async ({ pregunta, k }) => {
    try {
      const salida = await ejecutar('python3', [RAG_SCRIPT, 'query', pregunta, '--k', String(k ?? 5)]);
      return { content: [{ type: 'text', text: salida || 'Sin resultados.' }] };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text:
              `No se pudo consultar el índice RAG: ${error.message}\n\n` +
              'Verificá que Ollama esté corriendo (`ollama serve`) y que el índice exista ' +
              '(`python tools/ai-rag/rag_engine.py index`).',
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  'supuestos_pendientes',
  'Lista las decisiones de negocio tomadas sin confirmación del cliente, qué falta ' +
    'preguntarle y en qué archivos impacta cada una. Consultar antes de tocar una regla de ' +
    'negocio ambigua (coordenadas, catálogo de acciones, roles, agrupamiento, etc.).',
  {},
  async () => {
    try {
      const mod = await import(pathToFileURL(SUPUESTOS_DIST).href);
      const pendientes = mod.supuestosPendientes();
      return { content: [{ type: 'text', text: JSON.stringify(pendientes, null, 2) }] };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text:
              `No se pudo leer supuestos.ts compilado: ${error.message}\n\n` +
              'Corré primero: npm run build --workspace=@petrolero/shared',
          },
        ],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
