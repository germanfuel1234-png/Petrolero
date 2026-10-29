/**
 * REGLAS DE NEGOCIO
 * =================
 * Centralizadas para que la API y la UI no puedan discrepar.
 * La API es la que manda (calcula y persiste); la UI usa esto solo para previsualizar.
 */

import type { EstadoValvula, EventoMantenimiento, ResultadoPrueba } from './dominio.js';

/**
 * Días de anticipación con que una válvula empieza a mostrarse como "por vencer".
 * No surge de los audios: es un default operativo razonable.
 */
export const DIAS_AVISO_VENCIMIENTO = 30;

/**
 * Calcula la próxima revisión a partir del resultado de la prueba.
 *
 * Regla del cliente (textual del audio): "si a vos te da la prueba positiva, tenés que volver
 * de acá a un año a volver a hacer esa prueba".
 *
 * Si el resultado es NEGATIVO no se agenda próxima revisión: la válvula pasa a requerir una
 * acción correctiva, y recién después de repararla se vuelve a probar.
 *
 * Nota sobre años bisiestos: setFullYear(+1) sobre un 29 de febrero cae en 28 de febrero
 * del año siguiente (JS normaliza), que es el comportamiento esperado para un vencimiento anual.
 */
export function calcularProximaRevision(
  fechaMantenimiento: Date,
  resultado: ResultadoPrueba,
): Date | null {
  if (resultado !== 'OK') return null;

  const proxima = new Date(fechaMantenimiento.getTime());
  proxima.setFullYear(proxima.getFullYear() + 1);
  return proxima;
}

/**
 * Deriva el estado visual de una válvula a partir de su último evento.
 * No se guarda en base: se calcula siempre, así nunca queda desincronizado.
 */
export function derivarEstadoValvula(
  ultimoEvento: Pick<EventoMantenimiento, 'resultadoPrueba' | 'proximaRevision'> | null,
  tieneAccionPendiente: boolean,
  hoy: Date = new Date(),
): EstadoValvula {
  if (!ultimoEvento) return 'SIN_DATOS';

  // Una acción correctiva sin completar manda sobre cualquier otra condición.
  if (ultimoEvento.resultadoPrueba === 'NEGATIVO' || tieneAccionPendiente) return 'FALLA';

  if (!ultimoEvento.proximaRevision) return 'SIN_DATOS';

  const proxima = new Date(ultimoEvento.proximaRevision);
  const limiteAviso = new Date(hoy.getTime());
  limiteAviso.setDate(limiteAviso.getDate() + DIAS_AVISO_VENCIMIENTO);

  // Ya vencida cuenta como falla: pasó más de un año sin volver a probarla.
  if (proxima < hoy) return 'FALLA';
  if (proxima <= limiteAviso) return 'POR_VENCER';

  return 'OK';
}

/** Prioridad para resolver el estado general de un pozo: manda el peor de sus válvulas. */
const GRAVEDAD: Record<EstadoValvula, number> = {
  FALLA: 3,
  POR_VENCER: 2,
  SIN_DATOS: 1,
  OK: 0,
};

export function peorEstado(estados: EstadoValvula[]): EstadoValvula {
  if (estados.length === 0) return 'SIN_DATOS';
  return estados.reduce((peor, actual) => (GRAVEDAD[actual] > GRAVEDAD[peor] ? actual : peor));
}

/**
 * Un resultado NEGATIVO obliga a elegir una acción correctiva.
 * La API rechaza el registro si no viene; la UI usa esto para habilitar el botón de guardar.
 */
export function requiereAccionCorrectiva(resultado: ResultadoPrueba): boolean {
  return resultado === 'NEGATIVO';
}

/** Colores de estado, compartidos entre el mapa, el visor 3D y las tablas. */
export const COLOR_ESTADO: Record<EstadoValvula, string> = {
  OK: '#10b981',
  POR_VENCER: '#f59e0b',
  FALLA: '#ef4444',
  SIN_DATOS: '#71717a',
};

export const ETIQUETA_ESTADO: Record<EstadoValvula, string> = {
  OK: 'Operativa',
  POR_VENCER: 'Próxima a vencer',
  FALLA: 'Requiere acción',
  SIN_DATOS: 'Sin datos',
};
