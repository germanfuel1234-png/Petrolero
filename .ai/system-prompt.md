# System Prompt — Petrolero (Gestión de Válvulas Oil & Gas)

Este archivo es el contexto raíz para cualquier asistente de IA que trabaje en este repositorio.
Léelo antes de tocar código. Para detalle de arquitectura ver [architecture.md](architecture.md);
para convenciones y restricciones ver [rules.md](rules.md).

## Propósito exacto del software

Aplicación web para gestionar el mantenimiento preventivo de **válvulas** en **pozos petroleros**
(industria Oil & Gas, Argentina). Reemplaza un proceso manual/Excel con:

1. Un **mapa geográfico** de pozos agrupados por zona/cercanía (PostGIS).
2. Un **visor 3D por pozo** que muestra cada válvula (cantidad variable por pozo) con su estado.
3. **Registro de mantenimiento**: cada válvula pasa por engrase + prueba de hermeticidad
   (resultado binario OK/NEGATIVO). OK agenda la próxima revisión a 1 año; NEGATIVO exige
   elegir una acción correctiva (lavado, bombeo de grasa, cambio de sello, etc.).
4. **Planificación semanal**: agrupa acciones pendientes por cercanía geográfica (DBSCAN sobre
   PostGIS) en planes que se notifican al equipo de campo.
5. **Importador de Excel** para la carga inicial de datos históricos del cliente.

El dominio nació de 6 notas de voz del cliente (ver [SPECS.md](../SPECS.md)) — **no es un
proyecto de ingeniería definido de arriba hacia abajo**: hay decisiones tomadas sin dato real
del cliente, registradas explícitamente en `packages/shared/src/supuestos.ts` y marcadas en
código con `TODO[CLIENTE]` / `TODO[SUPUESTO]`. Cualquier asistente debe respetar esa convención
en vez de "resolver" silenciosamente un supuesto.

## Stack tecnológico detectado

**Monorepo npm workspaces** (`apps/*`, `packages/*`), Node >= 20, TypeScript estricto en todo
el código.

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite, MapLibre GL (mapa), React Three Fiber / three.js (visor 3D) |
| Backend | NestJS 10, Prisma 6 (ORM), passport-jwt (auth), class-validator |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 (vía `postgis/postgis:16-3.4` en Docker) |
| Dominio compartido | `packages/shared` — tipos, reglas de negocio y supuestos, consumidos por API y web |
| Tests | Vitest (`apps/api`) |
| Importación | `xlsx` para parseo de Excel |

No hay frameworks de IA, RAG ni MCP en el código de producción — lo que agrega esta carpeta
`.ai/` y las herramientas de `tools/ai/` (si existen) son infraestructura de **asistencia al
desarrollo**, separada de la app que se despliega.

## Reglas estrictas de desarrollo (resumen — detalle en rules.md)

1. **`packages/shared` es la única fuente de verdad** para tipos de dominio y reglas de negocio
   (ej. `calcularProximaRevision`, `derivarEstadoValvula`). Nunca duplicar esa lógica en
   `apps/api` o `apps/web`.
2. **El estado de una válvula nunca se guarda**, siempre se deriva del último
   `EventoMantenimiento`. No agregar una columna `estado` a `Valvula`.
3. **`EventoMantenimiento` es append-only**: nunca `UPDATE` ni `DELETE` sobre esa tabla.
4. Toda decisión tomada sin confirmación del cliente va a `packages/shared/src/supuestos.ts`
   con su `TODO[CLIENTE]`/`TODO[SUPUESTO]` correspondiente en el código — no se asume en
   silencio.
5. Nunca usar `toISOString()` para obtener la fecha "de hoy" (ver `apps/web/src/fechas.ts` y
   la nota en rules.md sobre zona horaria UTC-3).
6. `AUTH_HABILITADA` y otras variables de `.env` son decisiones de producto explícitas, no
   bugs: no cambiarlas sin que el usuario lo pida.
