# Checklist — Estado del MVP

> Documento de seguimiento. Compara qué está funcional hoy contra qué falta para la versión
> final. Para el detalle de cada pendiente del cliente ver [PENDIENTES-CLIENTE.md](PENDIENTES-CLIENTE.md);
> para el plan de fases original ver [MVP.md](MVP.md).

Última actualización: 2026-10-25

---

## ✅ Funcional hoy

| Área | Estado | Dónde |
|---|---|---|
| Modelo de datos | Completo: `Zona`, `Pozo`, `Valvula`, `EventoMantenimiento`, `TipoAccionCorrectiva`, `AccionCorrectiva`, `PlanSemanal`, `Usuario` en PostgreSQL + PostGIS | `apps/api/prisma/schema.prisma` |
| Importador de Excel | Mapeo de columnas configurable, vista previa sin escritura, validaciones, variantes de encabezado | `apps/api/src/importador/` |
| API backend | Controllers de pozos, mantenimiento, planificación, importador y auth operativos | `apps/api/src/` |
| Mapa interactivo | Clusters por zona → pozos individuales → panel de detalle | `apps/web/src/vistas/VistaMapa.tsx`, `apps/web/src/componentes/PanelPozo.tsx` |
| Visor 3D | Válvulas dinámicas por pozo, color según estado | `apps/web/src/componentes/visor3d/VisorPozo3D.tsx` |
| Registro de mantenimiento | Formulario + regla automática de +1 año + acción correctiva obligatoria si la prueba falla | `apps/web/src/componentes/FormularioMantenimiento.tsx` |
| Planificación semanal | Agrupamiento geográfico (radio 15 km) + armado de plan | `apps/web/src/vistas/VistaPlanificador.tsx`, `apps/api/src/planificacion/` |
| Estado derivado + historial append-only | `OK / POR_VENCER / FALLA / SIN_DATOS` calculado del último evento; el historial nunca se pisa | `packages/shared/` |
| Login/roles (motor) | JWT, guards y permisos construidos y testeados, desactivados por `AUTH_HABILITADA=false` | `apps/api/src/auth/` |
| Tests de reglas de negocio | Cubren importador y reglas de dominio | `apps/api/src/reglas.spec.ts`, `apps/api/src/importador/importador.spec.ts` |

---

## ❌ Falta para la versión final

### Bloqueado por el cliente (9 definiciones)

1. Coordenadas reales de pozos (hoy son sintéticas)
2. Estructura real del Excel maestro
3. Catálogo completo de acciones correctivas (hoy solo lavado / bombeo / sello)
4. Esquema real de roles (¿gerencia, HSE, auditoría además de supervisor/técnico?)
5. Requisitos de trazabilidad / firma digital
6. Criterio real de agrupamiento (radio vs. yacimiento vs. cuadrante)
7. Canal real de aviso al equipo (hoy solo se registra en log/BD, no llega a nadie)
8. Modelos 3D reales de válvulas (hoy geometría genérica)
9. Proveedor de mapas con SLA para producción (hoy OpenStreetMap sin garantía)

> Detalle completo, con archivo y línea de cada marcador, en [PENDIENTES-CLIENTE.md](PENDIENTES-CLIENTE.md).

### Trabajo técnico pendiente (no depende del cliente)

- [ ] Conectar la pantalla de **login** en el frontend (el backend ya lo exige si se activa `AUTH_HABILITADA=true`)
- [ ] Implementar el **canal de notificación real** una vez definido (hoy es un stub de consola)
- [ ] Reemplazar los usuarios de prueba (contraseña `petrolero123`) por los reales
- [ ] Deploy / infraestructura de producción (hoy `docker-compose` solo levanta Postgres local)
- [ ] Apagar los banners de supuestos (`VITE_MOSTRAR_SUPUESTOS=false`) antes de mostrarle la app al cliente final

---

## En una línea

El esqueleto funcional está completo y probado. Lo que falta es, sobre todo, **información real del
cliente** (datos, reglas de negocio, canal de aviso) más un puñado de tareas de cierre que dependen
solo de nosotros (login conectado, deploy, canal de notificación).
