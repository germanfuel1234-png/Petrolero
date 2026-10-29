/**
 * REGISTRO CENTRAL DE SUPUESTOS
 * =============================
 *
 * Cada entrada acá es una decisión que tomé SIN tener el dato real del cliente.
 * El sistema funciona igual, pero estos puntos hay que confirmarlos.
 *
 * Este archivo es la única fuente de verdad: lo consumen el backend (para loguear
 * al arrancar) y el frontend (para mostrar el banner amarillo en pantalla).
 *
 * Cuando el cliente confirme un dato:
 *   1. Aplicar el cambio real donde dice `archivos`.
 *   2. Marcar la entrada como `resuelto: true` (no borrarla: queda el historial de qué se asumió).
 *   3. Correr `npm run pendientes` para regenerar PENDIENTES-CLIENTE.md.
 */

export type CategoriaSupuesto =
  | 'DATOS'
  | 'REGLA_DE_NEGOCIO'
  | 'SEGURIDAD'
  | 'INTEGRACION'
  | 'VISUAL';

export interface Supuesto {
  /** ID estable. Se usa en <BannerSupuesto id="..."/> y en los comentarios TODO del código. */
  id: string;
  categoria: CategoriaSupuesto;
  /** Qué asumí, en una línea. Es el texto que se muestra en pantalla. */
  asumido: string;
  /** Qué necesito que conteste el cliente para destrabarlo. */
  necesitoDelCliente: string;
  /** Dónde impacta, para saber qué tocar cuando llegue la respuesta. */
  archivos: string[];
  /** Pasa a true cuando el cliente confirma y se aplica el dato real. */
  resuelto: boolean;
}

export const SUPUESTOS: Supuesto[] = [
  {
    id: 'COORDENADAS_POZOS',
    categoria: 'DATOS',
    asumido:
      'Las coordenadas de los pozos son sintéticas, generadas sobre cuencas petroleras reales de Argentina (Vaca Muerta, Golfo San Jorge, Austral, Cuyana). No son las ubicaciones reales de los pozos del cliente.',
    necesitoDelCliente:
      'Listado de pozos con su latitud/longitud real, o el sistema de donde se pueden exportar.',
    archivos: ['apps/api/prisma/seed.ts'],
    resuelto: false,
  },
  {
    id: 'ESTRUCTURA_EXCEL',
    categoria: 'DATOS',
    asumido:
      'El Excel de carga tiene las columnas: zona, pozo, latitud, longitud, valvula, orientacion, fecha_mantenimiento, resultado_prueba. El importador lee esta estructura desde un mapeo configurable.',
    necesitoDelCliente:
      'El archivo Excel maestro real que usan hoy, para ajustar el mapeo de columnas.',
    archivos: ['apps/api/src/importador/mapeo-columnas.ts'],
    resuelto: false,
  },
  {
    id: 'CATALOGO_ACCIONES',
    categoria: 'REGLA_DE_NEGOCIO',
    asumido:
      'Las acciones correctivas disponibles son: Lavado, Bombeo de grasa y Cambio de sello. En los audios el cliente mencionó "lavado", "bomba" y "etcétera".',
    necesitoDelCliente:
      'El listado completo de acciones correctivas posibles cuando una prueba de hermeticidad da negativa.',
    archivos: ['apps/api/prisma/seed.ts'],
    resuelto: false,
  },
  {
    id: 'ROLES_Y_PERMISOS',
    categoria: 'SEGURIDAD',
    asumido:
      'Existen 2 roles: SUPERVISOR (ve todo, planifica y notifica) y TECNICO (consulta y registra mantenimiento, no planifica).',
    necesitoDelCliente:
      '¿Hay más roles (gerencia, HSE, auditoría)? ¿Qué puede ver y editar exactamente cada uno?',
    archivos: ['apps/api/src/auth/roles.ts'],
    resuelto: false,
  },
  {
    id: 'AUDITORIA_TRAZABILIDAD',
    categoria: 'SEGURIDAD',
    asumido:
      'El historial de mantenimiento es append-only (nunca se edita ni se borra un registro) y guarda qué usuario lo cargó. No hay firma digital ni validación de un segundo responsable.',
    necesitoDelCliente:
      '¿Hay requisitos regulatorios de trazabilidad? ¿Hace falta firma del responsable o doble validación de la prueba de hermeticidad?',
    archivos: ['apps/api/prisma/schema.prisma'],
    resuelto: false,
  },
  {
    id: 'CRITERIO_AGRUPAMIENTO',
    categoria: 'REGLA_DE_NEGOCIO',
    asumido:
      'Los pozos se agrupan por cercanía usando un radio configurable de 15 km (variable de entorno RADIO_AGRUPAMIENTO_KM).',
    necesitoDelCliente:
      '¿El agrupamiento debe ser por radio de distancia, por yacimiento/zona administrativa, o por cuadrante? Si es por radio, ¿cuántos km tiene sentido para sus cuadrillas?',
    archivos: ['apps/api/src/planificacion/planificacion.service.ts'],
    resuelto: false,
  },
  {
    id: 'CANAL_NOTIFICACION',
    categoria: 'INTEGRACION',
    asumido:
      'El aviso al equipo de campo se registra en base de datos y se loguea por consola. No se envía por ningún canal externo todavía.',
    necesitoDelCliente:
      '¿Por dónde se le avisa al equipo el plan semanal: notificación dentro de la app, email, WhatsApp u otro?',
    archivos: ['apps/api/src/notificaciones/consola.notificador.ts'],
    resuelto: false,
  },
  {
    id: 'MODELO_3D_VALVULAS',
    categoria: 'VISUAL',
    asumido:
      'Las válvulas se representan con geometría genérica (cilindros y cuerpos simples) diferenciando orientación vertical y horizontal, coloreadas según estado. No son modelos CAD reales.',
    necesitoDelCliente:
      '¿Tienen planos o modelos CAD de sus válvulas? ¿Hay distintos tipos que deban verse diferentes entre sí?',
    archivos: ['apps/web/src/components/visor3d/ModeloValvula.tsx'],
    resuelto: false,
  },
  {
    id: 'TILES_MAPA',
    categoria: 'INTEGRACION',
    asumido:
      'El mapa usa tiles raster de OpenStreetMap sin API key, que no tienen garantía de servicio para uso productivo.',
    necesitoDelCliente:
      'Para producción conviene definir un proveedor de mapas con SLA (MapTiler, Mapbox) o un servidor de tiles propio. Definir presupuesto/preferencia.',
    archivos: ['apps/web/src/components/mapa/estiloMapa.ts'],
    resuelto: false,
  },
];

/** Busca un supuesto por ID. Devuelve undefined si no existe o si ya fue resuelto. */
export function obtenerSupuesto(id: string): Supuesto | undefined {
  const supuesto = SUPUESTOS.find((s) => s.id === id);
  return supuesto && !supuesto.resuelto ? supuesto : undefined;
}

/** Todos los supuestos sin resolver, para el reporte y el log de arranque. */
export function supuestosPendientes(): Supuesto[] {
  return SUPUESTOS.filter((s) => !s.resuelto);
}
