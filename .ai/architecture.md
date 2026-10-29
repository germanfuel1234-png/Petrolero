# Arquitectura — Petrolero

## Estructura del monorepo

```
petrolero/
├─ docker-compose.yml        PostgreSQL 16 + PostGIS 3.4 (único servicio: db)
├─ scripts/pendientes.ts     genera PENDIENTES-CLIENTE.md a partir de supuestos.ts
├─ packages/shared/          tipos de dominio + reglas de negocio + registro de supuestos
└─ apps/
   ├─ api/                   NestJS + Prisma + PostGIS   (puerto 3000)
   └─ web/                   React + Vite + MapLibre + R3F (puerto 5173)
```

## Módulos de `apps/api/src`

| Módulo | Responsabilidad |
|---|---|
| `auth/` | Login JWT, `roles.ts` (SUPERVISOR/TECNICO), `permisos.guard.ts`, `jwt-opcional.guard.ts`. Controlado por `AUTH_HABILITADA` (ver rules.md). |
| `pozos/` | CRUD de consulta de zonas/pozos/válvulas, detalle de pozo con estado derivado, KPIs. |
| `mantenimiento/` | Registro de `EventoMantenimiento` (engrase + prueba de hermeticidad) y de `AccionCorrectiva` cuando el resultado es NEGATIVO. |
| `planificacion/` | Agrupamiento geográfico por cercanía (DBSCAN vía `$queryRaw` sobre PostGIS, radio configurable `RADIO_AGRUPAMIENTO_KM`) y creación/notificación de `PlanSemanal`. |
| `importador/` | Parseo de Excel (`xlsx`) con mapeo de columnas configurable, para carga inicial de datos históricos. |
| `notificaciones/` | Aviso al equipo de campo al notificar un plan. Hoy: `consola.notificador.ts` (solo log + persistencia en base, sin canal externo — ver supuesto `CANAL_NOTIFICACION`). |
| `prisma/` | Módulo que expone `PrismaClient` al resto de la app (inyección de dependencias de Nest). |

## Frontend `apps/web/src`

- `vistas/`: `VistaLogin`, `VistaMapa`, `VistaAcciones`, `VistaPlanificador`, `VistaImportacion`.
- `componentes/`: `PanelPozo`, `FormularioMantenimiento`, `BannerSupuesto` (muestra en pantalla
  los supuestos sin resolver de `packages/shared/src/supuestos.ts`), `mapa/` (MapLibre),
  `visor3d/` (React Three Fiber, geometría genérica por ahora — ver supuesto
  `MODELO_3D_VALVULAS`).
- `autenticacion.ts` (`useSesion`) + `api.ts`: manejan JWT, login/logout y llamadas a la API.
  El login **ya está conectado** end-to-end (`VistaLogin` → `useSesion.ingresar` → `api.login`).
- `App.tsx`: layout raíz, navegación entre pantallas filtrada por permisos del usuario
  (`usuario.permisos`), KPIs de cabecera.

## Flujo de datos principal

1. **Carga inicial**: Excel del cliente → `importador` → crea/actualiza `Zona`, `Pozo`,
   `Valvula`, `EventoMantenimiento` históricos.
2. **Consulta**: `VistaMapa` pide `zonas`/`pozos` resumidos → al abrir un pozo, `PanelPozo` trae
   el detalle con válvulas y su **estado derivado** (`derivarEstadoValvula`, en
   `packages/shared`, nunca persistido).
3. **Registro de campo**: `FormularioMantenimiento` → `POST` a `mantenimiento` → crea un
   `EventoMantenimiento` nuevo (nunca edita uno existente). Si `resultadoPrueba = NEGATIVO`,
   exige `tipoAccionId` y crea una `AccionCorrectiva` en estado `PENDIENTE`.
4. **Planificación**: `VistaAcciones` selecciona acciones pendientes → `VistaPlanificador` pide
   a `planificacion` el agrupamiento geográfico sugerido → crea un `PlanSemanal` → al
   notificarlo, pasa las acciones a `PLANIFICADA` y dispara `notificaciones`.
5. **Supuestos en pantalla**: cualquier vista que toque un dato asumido (coordenadas, catálogo
   de acciones, etc.) renderiza `BannerSupuesto` leyendo `supuestos.ts`, controlable con
   `VITE_MOSTRAR_SUPUESTOS`.

## Esquema de base de datos (Prisma, `apps/api/prisma/schema.prisma`)

```
Zona 1───N Pozo 1───N Valvula 1───N EventoMantenimiento 1───(0..1) AccionCorrectiva N───1 TipoAccionCorrectiva
                                                                              N───(0..1) PlanSemanal
Usuario  (independiente, solo auth — no referenciado por FK desde el resto todavía)
```

- **Zona**: `id, nombre (unique), lat, lng` — centro aproximado para encuadrar el mapa.
- **Pozo**: `id, nombre (unique), zonaId→Zona, lat, lng`. Una migración SQL agrega la columna
  **generada** `geom geography(Point,4326)` a partir de `lat/lng` (Prisma no soporta `geography`
  nativamente); nunca se escribe `geom` a mano, siempre se recalcula sola.
- **Valvula**: `id, pozoId→Pozo, codigo, nombre, orientacion (VERTICAL|HORIZONTAL), orden`.
  `@@unique([pozoId, codigo])`. Cantidad de válvulas por pozo es libre (sin límite en schema).
- **EventoMantenimiento** (**append-only**): `id, valvulaId→Valvula, fecha, engraseRealizado,
  resultadoPrueba (OK|NEGATIVO), proximaRevision (null si NEGATIVO), observaciones,
  registradoPor`. El estado de la válvula se deriva siempre del evento más reciente por
  `(valvulaId, fecha)`.
- **TipoAccionCorrectiva**: catálogo en base (no enum) — `id, nombre (unique), descripcion,
  activo`. Vive en tabla porque el listado completo lo debe confirmar el cliente.
- **AccionCorrectiva**: `id, eventoId→EventoMantenimiento (unique, 1-a-1), tipoAccionId→
  TipoAccionCorrectiva, estado (PENDIENTE|PLANIFICADA|COMPLETADA), planSemanalId→PlanSemanal?`.
- **PlanSemanal**: `id, nombre, semanaInicio (lunes de la semana), notificadoEn (null hasta
  avisar al equipo)`.
- **Usuario**: `id, email (unique), nombre, passwordHash (bcrypt), rol (SUPERVISOR|TECNICO),
  activo`.

Migraciones aplicadas: `20261023014444_inicial`, `20261023014500_postgis_geom_pozo`.

## Variables de entorno relevantes (`apps/api/.env`)

`DATABASE_URL`, `PORT=3000`, `CORS_ORIGIN`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
`RADIO_AGRUPAMIENTO_KM=15` (radio del clustering DBSCAN), `AUTH_HABILITADA=false`
(endpoints abiertos a propósito mientras el esquema de roles no está confirmado por el
cliente — ver `ROLES_Y_PERMISOS` en supuestos.ts).
