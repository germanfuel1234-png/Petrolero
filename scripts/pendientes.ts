/**
 * GENERADOR DE PENDIENTES-CLIENTE.md
 * ==================================
 *
 * Recorre el código buscando los marcadores `TODO[CLIENTE]` y `TODO[SUPUESTO]`,
 * los cruza con el registro de packages/shared/src/supuestos.ts, y regenera
 * PENDIENTES-CLIENTE.md en la raíz.
 *
 * Correr con:  npm run pendientes
 *
 * Ese archivo es el que le pasás al cliente para que conteste, y el que mirás vos
 * para saber qué quedó inventado.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUPUESTOS } from '../packages/shared/src/supuestos.js';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const DIRECTORIOS_IGNORADOS = new Set([
  'node_modules',
  'dist',
  '.git',
  'build',
  '.next',
  'coverage',
  // El export de diseño es material de referencia del cliente, no código nuestro.
  'Diseño-App-Válvulas-Oil-&-Gas',
]);

const EXTENSIONES = new Set(['.ts', '.tsx', '.js', '.jsx', '.prisma', '.sql', '.yml', '.yaml']);

interface Marcador {
  tipo: 'CLIENTE' | 'SUPUESTO';
  texto: string;
  archivo: string;
  linea: number;
}

function listarArchivos(dir: string, acumulado: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (DIRECTORIOS_IGNORADOS.has(entrada)) continue;

    const rutaCompleta = join(dir, entrada);
    const info = statSync(rutaCompleta);

    if (info.isDirectory()) {
      listarArchivos(rutaCompleta, acumulado);
    } else if (EXTENSIONES.has(entrada.slice(entrada.lastIndexOf('.')))) {
      acumulado.push(rutaCompleta);
    }
  }
  return acumulado;
}

function buscarMarcadores(archivos: string[]): Marcador[] {
  // Captura: TODO[CLIENTE]: texto   /   TODO[SUPUESTO]: texto
  const patron = /TODO\[(CLIENTE|SUPUESTO)\]:\s*(.+)/;
  const marcadores: Marcador[] = [];

  for (const archivo of archivos) {
    const lineas = readFileSync(archivo, 'utf8').split('\n');

    lineas.forEach((linea, indice) => {
      const coincidencia = linea.match(patron);
      if (!coincidencia) return;

      // Evita que el propio patrón de este script se cuente como marcador.
      if (archivo.endsWith('pendientes.ts')) return;

      marcadores.push({
        tipo: coincidencia[1] as 'CLIENTE' | 'SUPUESTO',
        texto: coincidencia[2].trim().replace(/\*\/$/, '').trim(),
        archivo: relative(RAIZ, archivo),
        linea: indice + 1,
      });
    });
  }

  return marcadores;
}

function generarReporte(marcadores: Marcador[]): string {
  const sinResolver = SUPUESTOS.filter((s) => !s.resuelto);
  const resueltos = SUPUESTOS.filter((s) => s.resuelto);
  const delCliente = marcadores.filter((m) => m.tipo === 'CLIENTE');
  const supuestosEnCodigo = marcadores.filter((m) => m.tipo === 'SUPUESTO');

  const fecha = new Date().toISOString().slice(0, 10);

  const lineas: string[] = [
    '# Pendientes del cliente',
    '',
    '> **Archivo autogenerado — no editar a mano.**',
    '> Se regenera con `npm run pendientes`.',
    `> Última actualización: ${fecha}`,
    '',
    'Este documento lista todo lo que se construyó con un dato asumido porque todavía no',
    'tenemos la definición del cliente. El sistema funciona igual: cada punto está aislado',
    'para poder reemplazarlo sin reescribir el módulo que lo usa.',
    '',
    '## Resumen',
    '',
    `- **${sinResolver.length}** definiciones pendientes de confirmar.`,
    `- **${resueltos.length}** ya confirmadas y aplicadas.`,
    `- **${delCliente.length}** marcadores \`TODO[CLIENTE]\` en el código.`,
    `- **${supuestosEnCodigo.length}** marcadores \`TODO[SUPUESTO]\` en el código.`,
    '',
    '---',
    '',
    '## Definiciones pendientes',
    '',
  ];

  if (sinResolver.length === 0) {
    lineas.push('No queda ninguna definición pendiente. ', '');
  }

  for (const supuesto of sinResolver) {
    lineas.push(
      `### ${supuesto.id}`,
      '',
      `**Categoría:** ${supuesto.categoria}`,
      '',
      `**Qué se asumió:** ${supuesto.asumido}`,
      '',
      `**Qué necesito del cliente:** ${supuesto.necesitoDelCliente}`,
      '',
      `**Dónde impacta:** ${supuesto.archivos.map((a) => `\`${a}\``).join(', ')}`,
      '',
      '---',
      '',
    );
  }

  if (resueltos.length > 0) {
    lineas.push('## Ya confirmadas', '');
    for (const supuesto of resueltos) {
      lineas.push(`- **${supuesto.id}** — ${supuesto.asumido}`);
    }
    lineas.push('', '---', '');
  }

  lineas.push('## Marcadores en el código', '');

  if (delCliente.length > 0) {
    lineas.push('### Bloqueados esperando al cliente (`TODO[CLIENTE]`)', '');
    for (const m of delCliente) {
      lineas.push(`- \`${m.archivo}:${m.linea}\` — ${m.texto}`);
    }
    lineas.push('');
  }

  if (supuestosEnCodigo.length > 0) {
    lineas.push('### Decisiones tomadas por mí (`TODO[SUPUESTO]`)', '');
    for (const m of supuestosEnCodigo) {
      lineas.push(`- \`${m.archivo}:${m.linea}\` — ${m.texto}`);
    }
    lineas.push('');
  }

  if (marcadores.length === 0) {
    lineas.push('No hay marcadores en el código.', '');
  }

  return lineas.join('\n');
}

const archivos = listarArchivos(RAIZ);
const marcadores = buscarMarcadores(archivos);
const reporte = generarReporte(marcadores);
const destino = join(RAIZ, 'PENDIENTES-CLIENTE.md');

writeFileSync(destino, reporte, 'utf8');

const pendientes = SUPUESTOS.filter((s) => !s.resuelto).length;
console.log(`PENDIENTES-CLIENTE.md actualizado.`);
console.log(
  `  ${pendientes} definiciones pendientes · ${marcadores.length} marcadores encontrados en ${archivos.length} archivos.`,
);
