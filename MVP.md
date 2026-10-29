# Plan de acción — MVP

> Basado en [SPECS.md](SPECS.md). Stack confirmado con el cliente:
> - **Frontend**: React + TypeScript, React Three Fiber (Three.js) para el 3D, MapLibre GL para el mapa.
> - **Backend**: Node (NestJS) o Python (FastAPI) + PostgreSQL + PostGIS.

## 0. Decisión técnica pendiente antes de arrancar

- Elegir NestJS vs FastAPI para el backend (ambos cubren el caso; definir según preferencia/experiencia del equipo). El resto del plan es agnóstico a esa elección.

## 1. Modelo de datos (base de todo lo demás)

Diseñar el esquema en PostgreSQL + PostGIS antes de escribir código de UI.

- **Zona**: id, nombre, geometría/polígono o centro (para agrupar pozos).
- **Pozo**: id, nombre (ej. "B9"), zona_id, ubicación (`geography(Point)` en PostGIS), metadata (yacimiento, etc.).
- **Válvula**: id, pozo_id, código/nombre, posición (vertical/horizontal), orden dentro del pozo.
- **Evento de mantenimiento** (historial, no se pisa): id, válvula_id, fecha, tipo (engrase/mantenimiento), resultado prueba de hermeticidad (OK/Negativo), próxima_revisión (fecha, calculada a +1 año si OK).
- **Acción correctiva**: id, evento_id, tipo (lavado, bombeo, otro — catálogo abierto/configurable), estado (pendiente/en curso/hecha), fecha asignada.
- **Plan semanal**: id, semana, lista de pozos/válvulas asignadas, estado de aviso al equipo.

Entregable: diagrama ER + migraciones iniciales (Prisma/TypeORM o SQLAlchemy/Alembic según backend elegido).

## 2. Importador de Excel (carga inicial de datos reales)

- Definir con el cliente la estructura exacta de su Excel (columnas de pozos, válvulas, zona, últimas pruebas).
- Script/endpoint de importación que puebla Zona → Pozo → Válvula → Evento de mantenimiento históricos.
- Validaciones básicas: pozo sin zona, válvula duplicada, fechas inválidas.

Entregable: importador corriendo contra el Excel real del cliente, con reporte de filas importadas/rechazadas.

## 3. Backend API

Endpoints mínimos para soportar el frontend:

- `GET /zonas` — lista de zonas con conteo de pozos (para clusters del mapa).
- `GET /zonas/:id/pozos` — pozos de una zona con coordenadas y estado resumen.
- `GET /pozos/:id` — detalle de pozo con sus válvulas y último estado de cada una.
- `GET /pozos/:id/valvulas/:id/historial` — historial de mantenimiento de una válvula.
- `POST /valvulas/:id/eventos` — registrar nuevo evento de mantenimiento/prueba.
- `GET /acciones?tipo=lavado` — válvulas agrupadas por acción correctiva pendiente.
- `POST /planes-semanales` — crear/asignar plan de trabajo semanal.

## 4. Frontend — Mapa interactivo (zona → pozos → válvula)

- Montar MapLibre GL con capa de **clusters por zona** (zoom bajo: círculos/zonas agregadas con conteo de pozos).
- Click en zona → zoom + expandir a pins individuales de cada pozo (consumiendo `GET /zonas/:id/pozos`).
- Click en pozo → abrir panel lateral/modal con el detalle del pozo (sin salir del mapa).
- Color/ícono de cada pin de pozo según su peor estado de válvula (ej. rojo si tiene alguna válvula con prueba negativa sin acción, verde si todo OK).

Entregable: demo navegable zona → pozo, con datos reales importados.

## 5. Frontend — Visor 3D de válvulas por pozo

- Al seleccionar un pozo, montar escena con React Three Fiber mostrando sus N válvulas (modelo simple inicial: geometrías básicas o un modelo GLTF genérico de válvula reutilizado, posicionadas según vertical/horizontal).
- Cantidad de válvulas renderizadas = dinámica según el pozo (no hardcodeada).
- Click/tap en una válvula del modelo 3D → mostrar su estado (mantenimiento, última prueba, próxima revisión, acción pendiente si aplica), con color (verde/rojo/amarillo) según estado.

Entregable: visor 3D funcional para al menos un pozo con válvulas reales importadas.

## 6. Registro de mantenimiento (alta de eventos)

- Formulario para registrar mantenimiento + resultado de prueba de hermeticidad por válvula.
- Si resultado = OK → calcular automáticamente próxima revisión a +1 año.
- Si resultado = Negativo → obligar a seleccionar acción correctiva (catálogo: lavado, bombeo, + abierto a agregar otras).

Entregable: flujo completo de carga manual de un evento desde la UI (reemplaza parcialmente al Excel a futuro).

## 7. Agrupamiento por acción + planificación semanal

- Vista de lista/tabla: válvulas agrupadas por tipo de acción correctiva pendiente (lavado, bombeo, etc.), con nombre de válvula y pozo.
- Lógica de agrupamiento geográfico usando PostGIS (`ST_ClusterDBSCAN` o similar) para sugerir qué pozos conviene atender juntos por cercanía.
- Armado de plan semanal: seleccionar/confirmar grupo de pozos para la semana, marcar como "notificado al equipo".

Entregable: pantalla de planificación semanal operativa, con sugerencia automática de agrupamiento geográfico.

## 8. Aviso al equipo de campo

- Definir con el cliente el canal (pendiente de confirmar: notificación in-app, email, WhatsApp).
- Implementar el canal elegido para notificar el plan semanal confirmado.

## 9. Fuera de alcance del MVP (futuro)

- App/interfaz de campo para que el técnico registre mantenimiento válvula por válvula in situ (mobile/tablet).
- Modelos 3D más realistas/detallados de válvulas (más allá de geometría genérica).
- Reglas de agrupamiento geográfico más sofisticadas (más allá de clustering por distancia).

## 10. Orden de ejecución sugerido (sprints)

1. **Sprint 1**: Modelo de datos + migraciones + importador de Excel.
2. **Sprint 2**: Backend API (zonas, pozos, válvulas, historial).
3. **Sprint 3**: Mapa interactivo (zona → pozos) con datos reales.
4. **Sprint 4**: Visor 3D por pozo + detalle de válvula.
5. **Sprint 5**: Registro manual de mantenimiento + regla de +1 año + catálogo de acciones.
6. **Sprint 6**: Agrupamiento por acción + clustering geográfico + plan semanal + aviso al equipo.

## 11. Pendientes a confirmar con el cliente antes/durante el desarrollo

(heredado de SPECS.md, sigue abierto)

- Estructura exacta del Excel existente.
- Catálogo completo de acciones correctivas.
- Canal de aviso al equipo de campo.
- Criterio preciso de agrupamiento geográfico (¿por yacimiento, por radio de distancia, por cuadrante?).
