# Sistema de Gestión de Mantenimiento de Válvulas — Oil & Gas

Aplicación web para llevar el mantenimiento de válvulas en pozos petroleros: mapa geográfico
interactivo, visor 3D por pozo, registro de pruebas de hermeticidad y planificación semanal
de cuadrillas por cercanía.

Documentos relacionados: [SPECS.md](SPECS.md) (requerimientos del cliente),
[MVP.md](MVP.md) (plan de fases), [PENDIENTES-CLIENTE.md](PENDIENTES-CLIENTE.md) (qué falta definir).

---

## Puesta en marcha

Requisitos: Node 20+ y Docker.

```bash
docker compose up -d     # PostgreSQL 16 + PostGIS 3.4
npm install
npm run db:migrate       # crea el esquema
npm run db:seed          # datos de demostración (40 pozos sintéticos)
npm run dev              # API en :3000 · Web en :5173
```

Abrir <http://localhost:5173>.

Usuarios de prueba (contraseña `petrolero123`):

| Email | Rol |
|---|---|
| `supervisor@petrolero.test` | SUPERVISOR — planifica, notifica, importa |
| `tecnico@petrolero.test` | TECNICO — consulta y registra mantenimiento |

---

## Lo que falta definir con el cliente

El sistema está completo y funcionando, pero **9 definiciones dependen del cliente** y se
construyeron con un supuesto razonable en su lugar (coordenadas reales, estructura del Excel,
catálogo de acciones, roles, auditoría, criterio de agrupamiento, canal de aviso, modelos CAD,
proveedor de mapas).

Cada hueco está marcado en el código con una de estas dos convenciones:

```ts
// TODO[CLIENTE]:  necesito que el cliente conteste algo para destrabar esto.
// TODO[SUPUESTO]: lo decidí yo, funciona, pero revisalo cuando llegue el dato real.
```

Tres formas de verlos:

1. **Reporte** — `npm run pendientes` regenera [PENDIENTES-CLIENTE.md](PENDIENTES-CLIENTE.md)
   con todo agrupado y con `archivo:línea`. Es el documento para mandarle al cliente.
2. **En pantalla** — un banner amarillo aparece sobre cada dato asumido.
   Se apaga con `VITE_MOSTRAR_SUPUESTOS=false` en `apps/web/.env` **antes de mostrarle la app
   al cliente**, y se vuelve a prender para seguir desarrollando.
3. **Al arrancar la API** — lista los pendientes en el log.

El texto de los supuestos vive en un solo lugar
(`packages/shared/src/supuestos.ts`); el reporte y los banners lo leen de ahí, así nunca quedan
desfasados. Cuando el cliente confirme algo, se marca `resuelto: true` y el banner desaparece solo.

---

## Autenticación: apagada a propósito

`AUTH_HABILITADA=false` en `apps/api/.env`. Con ese valor los endpoints quedan abiertos y la
API lo avisa por log en cada petición protegida.

**No es un descuido**: el esquema de roles real es una de las definiciones que faltan. Dejar la
exigencia prendida con roles inventados bloquearía funciones que el cliente necesita probar.

El login, los roles y los permisos están construidos y probados. Poniendo `AUTH_HABILITADA=true`
la API pasa a exigir token (`401` sin token, `403` si el rol no tiene el permiso). Falta
conectar la pantalla de login en el frontend antes de salir a producción.

---

## Estructura

```
petrolero/
├─ docker-compose.yml        PostGIS
├─ scripts/pendientes.ts     genera PENDIENTES-CLIENTE.md
├─ packages/shared/          tipos de dominio + reglas de negocio + registro de supuestos
└─ apps/
   ├─ api/                   NestJS + Prisma + PostGIS
   └─ web/                   React + Vite + MapLibre GL + React Three Fiber
```

`packages/shared` es la razón de usar TypeScript en los dos lados: `Pozo`, `Valvula` y la regla
de la próxima revisión se definen **una sola vez**. Si cambia una regla, TypeScript rompe en
backend y frontend a la vez.

### Decisiones técnicas que conviene conocer

**PostGIS sin pelear con Prisma.** Prisma no soporta el tipo `geography`. En vez de cambiar de
ORM, `Pozo` guarda `lat`/`lng` como `Float` y una migración agrega una columna **generada** que
PostgreSQL mantiene sola:

```sql
ALTER TABLE "Pozo" ADD COLUMN geom geography(Point,4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED;
```

El CRUD queda simple y tipado; el clustering por cercanía usa `$queryRaw` sobre `geom`.
Esa columna nunca se escribe a mano.

**El historial es append-only.** `EventoMantenimiento` nunca se actualiza ni se borra: cada
inspección es una fila nueva y el estado actual de una válvula se deriva de su evento más
reciente. Se decidió así porque la prueba de hermeticidad es un dato de seguridad y su
historial tiene que ser reconstruible.

**El estado no se guarda, se calcula.** `OK / POR_VENCER / FALLA / SIN_DATOS` se deriva siempre
del último evento (`derivarEstadoValvula`), así no puede quedar desincronizado con el historial.

**Fechas en hora local, nunca `toISOString()` para "hoy".** En Argentina (UTC−3) ese método
devuelve la fecha de mañana después de las 21:00, y como la API rechaza fechas futuras, un
técnico cargando de noche recibía un error. Ver `apps/web/src/fechas.ts`.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | API y web en modo desarrollo |
| `npm run build` | Compila los tres paquetes |
| `npm test` | Tests de reglas de negocio |
| `npm run pendientes` | Regenera `PENDIENTES-CLIENTE.md` |
| `npm run db:migrate` | Aplica migraciones |
| `npm run db:seed` | Recarga los datos de demostración |
| `npm run db:up` / `db:down` | Levanta / baja PostGIS |

---

## Importar el Excel del cliente

Cuando llegue el archivo real, **el único archivo a tocar** es
`apps/api/src/importador/mapeo-columnas.ts`: ahí se declara qué columna del Excel corresponde a
cada campo. El importador no conoce ningún nombre de columna.

Admite variantes de encabezado (ignora mayúsculas, acentos y espacios de más), decimales con
coma y fechas `DD/MM/AAAA`. Desde la pantalla **Importar Excel** siempre se hace primero una
vista previa que valida sin escribir en la base, y recién al confirmar se importa.
