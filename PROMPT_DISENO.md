Diseñá las pantallas (dashboards) de una aplicación web B2B para la industria de Oil & Gas, orientada a la gestión de mantenimiento de válvulas en pozos petroleros. Es una herramienta operativa/industrial (no de consumo), usada por supervisores de mantenimiento y equipos de campo. Estilo visual: dashboard profesional tipo industrial/SCADA, modo oscuro como base (con opción a modo claro), paleta con acentos de estado tipo semáforo (verde = OK, amarillo = atención/próximo a vencer, rojo = falla/acción pendiente), tipografía técnica legible, mucho uso de mapas, gráficos y tablas densas en datos. Pensado para desktop en primer lugar, pero debe ser responsive.

Stack real de la app (para que el diseño sea consistente con lo que se va a poder construir): React + TypeScript, mapa con MapLibre GL (estilo tipo Mapbox), visualización 3D con Three.js / React Three Fiber, backend con PostgreSQL + PostGIS.

Necesito el diseño de las siguientes pantallas:

## 1. Dashboard principal / Mapa de zonas y pozos
- Mapa interactivo a pantalla completa (o casi) con clusters por zona: cada zona se ve como un círculo/marcador con el número de pozos que contiene.
- Al hacer click/zoom en una zona, el cluster se expande y muestra los pines individuales de cada pozo dentro de esa zona.
- Cada pin de pozo tiene un color según su peor estado de válvula (verde/amarillo/rojo).
- Panel lateral (izquierdo o derecho) con filtros: por zona, por estado, por acción pendiente (lavado, bombeo, etc.), buscador de pozo por nombre.
- Header superior con KPIs resumen: total de pozos, válvulas con prueba OK, válvulas con prueba negativa, acciones pendientes, pozos a vencer en los próximos 30 días.

## 2. Detalle de pozo (al hacer click en un pin de pozo)
- Se abre como panel lateral deslizable o modal grande (no pantalla completa, para no perder el contexto del mapa).
- Header con nombre del pozo, zona, ubicación (lat/long), estado general.
- Visor 3D embebido del pozo con sus válvulas (cantidad variable, ej. 8 o 9 válvulas) posicionadas en vertical/horizontal, cada una coloreada según su estado (verde/amarillo/rojo).
- Al hacer click sobre una válvula del modelo 3D, se despliega un panel/tooltip con: nombre de válvula, fecha de último mantenimiento, resultado de la última prueba de hermeticidad, próxima fecha de revisión (si OK, +1 año), acción correctiva asignada (si negativo).
- Debajo o al costado del visor 3D, listado tabular alternativo de las mismas válvulas (para usuarios que prefieran tabla a 3D), con las mismas columnas de estado.
- Botón para "Registrar nuevo mantenimiento" sobre una válvula seleccionada.

## 3. Formulario de registro de mantenimiento de válvula
- Formulario simple, pensado para carga rápida (uso recurrente, muchas veces por día):
  - Selección de válvula (preseleccionada si viene del detalle de pozo).
  - Fecha del mantenimiento.
  - Checkbox/toggle: mantenimiento (engrase) realizado.
  - Resultado de la prueba de hermeticidad: selector binario OK / Negativo, bien visible (botones grandes tipo verde/rojo).
  - Si el resultado es Negativo: campo obligatorio para elegir la acción correctiva (lavado, bombeo, otro — lista desplegable editable/ampliable).
  - Si el resultado es OK: mostrar automáticamente la fecha calculada de próxima revisión (+1 año), sin que el usuario la edite.
  - Botón de guardar y volver al detalle del pozo.

## 4. Vista de acciones pendientes (agrupado por tipo de acción)
- Tabla/kanban agrupado por tipo de acción correctiva (ej. columnas: "Lavado", "Bombeo", "Otro"), cada columna con las válvulas/pozos que necesitan esa acción.
- Cada tarjeta/fila muestra: nombre del pozo, nombre de la válvula, zona, fecha en que se detectó la falla, prioridad/antigüedad.
- Filtro por zona y por antigüedad del pendiente.
- Posibilidad de seleccionar varias tarjetas/filas para asignarlas a un plan semanal (acción masiva).

## 5. Planificador semanal
- Vista tipo calendario/semana con columnas por día o una sola vista de "semana actual" vs "próxima semana".
- Lista de pozos/válvulas agrupados automáticamente por cercanía geográfica (sugerencia del sistema basada en ubicación), mostrando pequeño mapa de referencia con los pozos de ese grupo resaltados.
- El supervisor puede confirmar o reordenar los grupos sugeridos antes de asignarlos a una semana.
- Botón "Notificar al equipo" por grupo confirmado, con indicador de si ya fue notificado o no.

## 6. Pantalla de importación de datos (Excel)
- Zona de carga de archivo (drag & drop) para el Excel inicial.
- Vista previa de las filas detectadas antes de confirmar la importación.
- Reporte post-importación: filas importadas correctamente, filas con error (con detalle del motivo), opción de descargar el reporte de errores.

Para cada pantalla, generá: layout general, jerarquía visual, componentes principales (cards, tablas, modales, chips de estado), y la paleta de color aplicada a los estados (verde/amarillo/rojo) de forma consistente en todas las vistas.
