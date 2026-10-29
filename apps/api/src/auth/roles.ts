/**
 * ROLES Y PERMISOS
 * ================
 *
 * TODO[CLIENTE]: esquema de roles asumido. De los audios se deducen dos perfiles
 * (quien planifica y quien ejecuta en campo), pero falta confirmar si existen más
 * (gerencia, HSE/seguridad, auditoría) y qué puede ver o editar exactamente cada uno.
 *
 * Para agregar un rol nuevo: sumarlo al enum y a PERMISOS. Los guards de los
 * controladores no necesitan cambios.
 */

export const ROLES = {
  /** Planifica, notifica cuadrillas e importa datos. Ve todo. */
  SUPERVISOR: 'SUPERVISOR',
  /** Consulta pozos y registra mantenimiento en campo. No planifica ni importa. */
  TECNICO: 'TECNICO',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];

/** Acciones que el sistema sabe controlar. */
export type Permiso =
  | 'ver:pozos'
  | 'registrar:mantenimiento'
  | 'completar:acciones'
  | 'crear:planes'
  | 'notificar:planes'
  | 'importar:datos';

export const PERMISOS: Record<Rol, Permiso[]> = {
  SUPERVISOR: [
    'ver:pozos',
    'registrar:mantenimiento',
    'completar:acciones',
    'crear:planes',
    'notificar:planes',
    'importar:datos',
  ],
  // TODO[SUPUESTO]: se asume que el técnico de campo no planifica ni importa datos masivos.
  TECNICO: ['ver:pozos', 'registrar:mantenimiento', 'completar:acciones'],
};

export function tienePermiso(rol: string, permiso: Permiso): boolean {
  const permisos = PERMISOS[rol as Rol];
  return permisos !== undefined && permisos.includes(permiso);
}
