# Pendientes del cliente

> **Archivo autogenerado — no editar a mano.**
> Se regenera con `npm run pendientes`.
> Última actualización: 2026-10-23

Este documento lista todo lo que se construyó con un dato asumido porque todavía no
tenemos la definición del cliente. El sistema funciona igual: cada punto está aislado
para poder reemplazarlo sin reescribir el módulo que lo usa.

## Resumen

- **9** definiciones pendientes de confirmar.
- **0** ya confirmadas y aplicadas.
- **16** marcadores `TODO[CLIENTE]` en el código.
- **3** marcadores `TODO[SUPUESTO]` en el código.

---

## Definiciones pendientes

### COORDENADAS_POZOS

**Categoría:** DATOS

**Qué se asumió:** Las coordenadas de los pozos son sintéticas, generadas sobre cuencas petroleras reales de Argentina (Vaca Muerta, Golfo San Jorge, Austral, Cuyana). No son las ubicaciones reales de los pozos del cliente.

**Qué necesito del cliente:** Listado de pozos con su latitud/longitud real, o el sistema de donde se pueden exportar.

**Dónde impacta:** `apps/api/prisma/seed.ts`

---

### ESTRUCTURA_EXCEL

**Categoría:** DATOS

**Qué se asumió:** El Excel de carga tiene las columnas: zona, pozo, latitud, longitud, valvula, orientacion, fecha_mantenimiento, resultado_prueba. El importador lee esta estructura desde un mapeo configurable.

**Qué necesito del cliente:** El archivo Excel maestro real que usan hoy, para ajustar el mapeo de columnas.

**Dónde impacta:** `apps/api/src/importador/mapeo-columnas.ts`

---

### CATALOGO_ACCIONES

**Categoría:** REGLA_DE_NEGOCIO

**Qué se asumió:** Las acciones correctivas disponibles son: Lavado, Bombeo de grasa y Cambio de sello. En los audios el cliente mencionó "lavado", "bomba" y "etcétera".

**Qué necesito del cliente:** El listado completo de acciones correctivas posibles cuando una prueba de hermeticidad da negativa.

**Dónde impacta:** `apps/api/prisma/seed.ts`

---

### ROLES_Y_PERMISOS

**Categoría:** SEGURIDAD

**Qué se asumió:** Existen 2 roles: SUPERVISOR (ve todo, planifica y notifica) y TECNICO (consulta y registra mantenimiento, no planifica).

**Qué necesito del cliente:** ¿Hay más roles (gerencia, HSE, auditoría)? ¿Qué puede ver y editar exactamente cada uno?

**Dónde impacta:** `apps/api/src/auth/roles.ts`

---

### AUDITORIA_TRAZABILIDAD

**Categoría:** SEGURIDAD

**Qué se asumió:** El historial de mantenimiento es append-only (nunca se edita ni se borra un registro) y guarda qué usuario lo cargó. No hay firma digital ni validación de un segundo responsable.

**Qué necesito del cliente:** ¿Hay requisitos regulatorios de trazabilidad? ¿Hace falta firma del responsable o doble validación de la prueba de hermeticidad?

**Dónde impacta:** `apps/api/prisma/schema.prisma`

---

### CRITERIO_AGRUPAMIENTO

**Categoría:** REGLA_DE_NEGOCIO

**Qué se asumió:** Los pozos se agrupan por cercanía usando un radio configurable de 15 km (variable de entorno RADIO_AGRUPAMIENTO_KM).

**Qué necesito del cliente:** ¿El agrupamiento debe ser por radio de distancia, por yacimiento/zona administrativa, o por cuadrante? Si es por radio, ¿cuántos km tiene sentido para sus cuadrillas?

**Dónde impacta:** `apps/api/src/planificacion/planificacion.service.ts`

---

### CANAL_NOTIFICACION

**Categoría:** INTEGRACION

**Qué se asumió:** El aviso al equipo de campo se registra en base de datos y se loguea por consola. No se envía por ningún canal externo todavía.

**Qué necesito del cliente:** ¿Por dónde se le avisa al equipo el plan semanal: notificación dentro de la app, email, WhatsApp u otro?

**Dónde impacta:** `apps/api/src/notificaciones/consola.notificador.ts`

---

### MODELO_3D_VALVULAS

**Categoría:** VISUAL

**Qué se asumió:** Las válvulas se representan con geometría genérica (cilindros y cuerpos simples) diferenciando orientación vertical y horizontal, coloreadas según estado. No son modelos CAD reales.

**Qué necesito del cliente:** ¿Tienen planos o modelos CAD de sus válvulas? ¿Hay distintos tipos que deban verse diferentes entre sí?

**Dónde impacta:** `apps/web/src/components/visor3d/ModeloValvula.tsx`

---

### TILES_MAPA

**Categoría:** INTEGRACION

**Qué se asumió:** El mapa usa tiles raster de OpenStreetMap sin API key, que no tienen garantía de servicio para uso productivo.

**Qué necesito del cliente:** Para producción conviene definir un proveedor de mapas con SLA (MapTiler, Mapbox) o un servidor de tiles propio. Definir presupuesto/preferencia.

**Dónde impacta:** `apps/web/src/components/mapa/estiloMapa.ts`

---

## Marcadores en el código

### Bloqueados esperando al cliente (`TODO[CLIENTE]`)

- `apps/api/prisma/schema.prisma:39` — estas coordenadas vienen del seed sintético. Hacen falta las ubicaciones reales
- `apps/api/prisma/schema.prisma:97` — se guarda quién cargó el registro, pero no hay firma digital ni validación
- `apps/api/prisma/schema.prisma:159` — se asumen 2 roles (SUPERVISOR, TECNICO). Falta confirmar si hay más perfiles
- `apps/api/prisma/seed.ts:48` — catálogo de acciones correctivas incompleto. En los audios se mencionó
- `apps/api/prisma/seed.ts:97` — usuarios de prueba con contraseña conocida. Hay que reemplazarlos por los
- `apps/api/src/auth/permisos.guard.ts:28` — la exigencia está APAGADA por defecto (AUTH_HABILITADA=false) porque el
- `apps/api/src/auth/roles.ts:5` — esquema de roles asumido. De los audios se deducen dos perfiles
- `apps/api/src/importador/mapeo-columnas.ts:5` — este mapeo está inventado. No tenemos el Excel maestro real del cliente.
- `apps/api/src/importador/mapeo-columnas.ts:101` — confirmar con qué palabras exactas se carga hoy el resultado en el Excel.
- `apps/api/src/mantenimiento/mantenimiento.controller.ts:18` — mientras no esté definido el esquema de usuarios real, el registro
- `apps/api/src/mantenimiento/mantenimiento.service.ts:82` — se guarda el usuario que carga, sin firma ni segunda validación.
- `apps/api/src/notificaciones/consola.notificador.ts:8` — reemplazar por el canal real una vez definido. Para hacerlo:
- `apps/api/src/notificaciones/notificador.interface.ts:5` — no está definido por qué canal se avisa al equipo de campo
- `apps/api/src/planificacion/planificacion.service.ts:109` — el criterio real de agrupamiento no está confirmado. Hoy agrupa por
- `apps/web/src/componentes/mapa/estiloMapa.ts:6` — OSM no da garantía de servicio para uso productivo. Para producción
- `apps/web/src/componentes/visor3d/ModeloValvula.tsx:14` — geometría genérica (cuerpo + vástago + volante). No son modelos CAD

### Decisiones tomadas por mí (`TODO[SUPUESTO]`)

- `apps/api/prisma/seed.ts:5` — todos los pozos, válvulas e historiales de este archivo son INVENTADOS.
- `apps/api/src/auth/roles.ts:40` — se asume que el técnico de campo no planifica ni importa datos masivos.
- `apps/api/src/importador/importador.service.ts:401` — si el Excel no indica orientación se asume VERTICAL.
