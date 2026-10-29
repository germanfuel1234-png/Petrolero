/**
 * Utilidades de fecha para los formularios.
 *
 * Regla: nunca usar toISOString() para obtener "la fecha de hoy". Ese método convierte a
 * UTC, y en Argentina (UTC-3) después de las 21:00 devuelve la fecha del día siguiente.
 * Como el backend rechaza fechas futuras, eso rompía la carga de mantenimiento nocturna.
 */

/** Fecha en formato YYYY-MM-DD según la hora local del navegador. */
export function aIsoLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Hoy, en formato YYYY-MM-DD local. */
export function hoyEnIso(): string {
  return aIsoLocal(new Date());
}

/** Lunes de la semana siguiente, en formato YYYY-MM-DD local. */
export function proximoLunes(): string {
  const fecha = new Date();
  // getDay(): 0 = domingo. Si hoy es lunes, salta al lunes que viene.
  const diasHastaLunes = (8 - fecha.getDay()) % 7 || 7;
  fecha.setDate(fecha.getDate() + diasHastaLunes);
  return aIsoLocal(fecha);
}

/**
 * Convierte un YYYY-MM-DD de un <input type="date"> al ISO completo que espera la API,
 * interpretándolo como medianoche local.
 */
export function aIsoCompleto(fechaIso: string): string {
  return new Date(`${fechaIso}T00:00:00`).toISOString();
}
