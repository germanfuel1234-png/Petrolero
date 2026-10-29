# Reglas — Petrolero

## Convenciones de código

- **Dominio en español, código en inglés técnico**: nombres de tipos/modelos/variables de
  negocio en español (`Pozo`, `Valvula`, `resultadoPrueba`, `calcularProximaRevision`) porque
  así los describió el cliente y así se mapean 1:1 con el schema de Prisma. Términos técnicos
  genéricos (props, hooks, helpers de infraestructura) sí pueden ir en inglés.
- **`packages/shared` es la única fuente de verdad** para:
  - Tipos de dominio (`dominio.ts`).
  - Reglas de negocio puras (`reglas.ts`): `calcularProximaRevision`,
    `derivarEstadoValvula`, `peorEstado`, `requiereAccionCorrectiva`.
  - Registro de supuestos (`supuestos.ts`).
  Si una regla de negocio cambia, se cambia ahí — nunca se reimplementa en `apps/api` o
  `apps/web`. La gracia de compartir TypeScript entre los dos lados es que un cambio rompe la
  compilación en ambos si quedan desincronizados.
- **El estado de una válvula/pozo nunca se persiste**, se deriva siempre con
  `derivarEstadoValvula` / `peorEstado` a partir del evento más reciente. No agregar una
  columna `estado` a ningún modelo.
- **Fechas**: nunca usar `Date.toISOString()` para obtener "hoy". En Argentina (UTC−3) devuelve
  la fecha de mañana después de las 21:00, y como la API rechaza fechas futuras, rompe la carga
  nocturna de un técnico en campo. Usar las utilidades de `apps/web/src/fechas.ts`.
- **Convención `TODO[CLIENTE]` / `TODO[SUPUESTO]`** en comentarios de código:
  - `TODO[CLIENTE]`: falta una respuesta del cliente para resolverlo bien.
  - `TODO[SUPUESTO]`: se decidió unilateralmente, funciona, pero hay que revisarlo con el dato
    real cuando llegue.
  Todo punto marcado así debe tener su entrada espejo en
  `packages/shared/src/supuestos.ts` (campo `archivos` apuntando al código). Después de
  tocar uno de esos archivos, correr `npm run pendientes` para regenerar
  `PENDIENTES-CLIENTE.md`.
- **Columna `geom` de `Pozo`**: es una columna PostgreSQL **generada** (`GENERATED ALWAYS AS`)
  a partir de `lat/lng`. Nunca se declara en `schema.prisma` ni se escribe a mano — las
  consultas espaciales la leen con `$queryRaw`.

## Restricciones de negocio

- Un pozo puede tener **cualquier cantidad de válvulas** (0 a N). Ningún componente de UI ni
  endpoint debe asumir un número fijo o un máximo.
- Prueba de hermeticidad **OK** → próxima revisión = fecha + 1 año, sin acción correctiva.
- Prueba de hermeticidad **NEGATIVO** → `proximaRevision = null` y es **obligatorio** asignar
  un `tipoAccionId` (la API debe rechazar el registro si falta). No se agenda revisión hasta
  resolver la acción correctiva y volver a probar.
- El catálogo de `TipoAccionCorrectiva` vive en base, no en un enum de código — un
  SUPERVISOR puede necesitar agregar tipos nuevos sin deploy.
- Permisos por rol (`apps/api/src/auth/roles.ts`): `TECNICO` nunca debe poder planificar
  (`crear:planes`), notificar (`notificar:planes`) ni importar datos (`importar:datos`). Si se
  agrega un permiso nuevo, decidir explícitamente a qué roles se lo da — no heredar por default.
- `AUTH_HABILITADA=false` es una decisión de producto vigente, no un bug: los endpoints están
  abiertos a propósito porque el esquema de roles real todavía no está confirmado por el
  cliente. No "arreglarlo" activándolo sin que el usuario lo pida explícitamente.

## Qué NUNCA hacer en este proyecto

1. **Nunca `UPDATE` ni `DELETE` sobre `EventoMantenimiento`.** Es append-only por diseño: la
   prueba de hermeticidad es un dato de seguridad y su historial tiene que ser reconstruible.
   Cualquier corrección se hace con un evento nuevo, nunca editando el anterior.
2. **Nunca resolver en silencio una entrada de `supuestos.ts`** (marcarla `resuelto: true`)
   sin que el cambio venga de una confirmación real del cliente.
3. **Nunca duplicar reglas de negocio** fuera de `packages/shared` "por rapidez". Rompe la
   garantía de que backend y frontend no pueden discrepar.
4. **Nunca commitear `.env`** ni secretos (`JWT_SECRET` real, credenciales de DB de producción).
   Los `.env.example` son la referencia pública.
5. **Nunca cambiar `AUTH_HABILITADA`, `RADIO_AGRUPAMIENTO_KM` u otras variables de decisión de
   producto** como efecto secundario de otra tarea. Son supuestos explícitos documentados.
6. **Nunca escribir manualmente la columna `geom`** de `Pozo` ni modelarla en `schema.prisma`
   como si fuera una columna normal — rompe la migración generada de PostGIS.
7. **Nunca hardcodear la cantidad de válvulas de un pozo** en UI, validaciones o fixtures de
   test fuera del seed.
