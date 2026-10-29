/**
 * TIPOS DE DOMINIO
 * ================
 * Definidos una sola vez y consumidos por la API y el frontend.
 * Si cambia una regla de negocio acá, TypeScript rompe en los dos lados: esa es la idea.
 */

/** Resultado de la prueba de hermeticidad. Es binario, tal como lo describió el cliente. */
export type ResultadoPrueba = 'OK' | 'NEGATIVO';

/**
 * Orientación física de la válvula en el árbol de producción.
 * Del audio del cliente: "tienen nueve válvulas, cuatro en vertical, cinco en horizontal".
 */
export type OrientacionValvula = 'VERTICAL' | 'HORIZONTAL';

/**
 * Estado operativo derivado (no se guarda en base, se calcula).
 * - OK: última prueba positiva y lejos de vencer.
 * - POR_VENCER: última prueba positiva pero la próxima revisión está dentro de la ventana de aviso.
 * - FALLA: última prueba negativa, con acción correctiva pendiente.
 * - SIN_DATOS: nunca se le registró un mantenimiento.
 */
export type EstadoValvula = 'OK' | 'POR_VENCER' | 'FALLA' | 'SIN_DATOS';

/** Estado de una acción correctiva asignada a una válvula que falló la prueba. */
export type EstadoAccion = 'PENDIENTE' | 'PLANIFICADA' | 'COMPLETADA';

export interface Zona {
  id: string;
  nombre: string;
  /** Centro aproximado de la zona, para encuadrar el mapa. */
  lat: number;
  lng: number;
}

export interface Pozo {
  id: string;
  nombre: string;
  zonaId: string;
  lat: number;
  lng: number;
}

export interface Valvula {
  id: string;
  pozoId: string;
  /** Código corto visible en el visor 3D, ej "V-1". */
  codigo: string;
  nombre: string;
  orientacion: OrientacionValvula;
  /** Posición dentro de su grupo de orientación, para ubicarla en el modelo 3D. */
  orden: number;
}

export interface EventoMantenimiento {
  id: string;
  valvulaId: string;
  fecha: string;
  /** Si se hizo el engrase. Puede registrarse un evento solo de prueba, sin engrase. */
  engraseRealizado: boolean;
  resultadoPrueba: ResultadoPrueba;
  /** Calculada en el backend: fecha + 1 año cuando el resultado es OK. Null si fue NEGATIVO. */
  proximaRevision: string | null;
  observaciones: string | null;
  registradoPor: string | null;
}

export interface TipoAccionCorrectiva {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export interface AccionCorrectiva {
  id: string;
  eventoId: string;
  tipoAccionId: string;
  estado: EstadoAccion;
  planSemanalId: string | null;
}

/** Válvula con su estado actual resuelto, que es lo que consume la UI. */
export interface ValvulaConEstado extends Valvula {
  estado: EstadoValvula;
  ultimoEvento: EventoMantenimiento | null;
  accionPendiente: {
    id: string;
    tipoNombre: string;
    estado: EstadoAccion;
  } | null;
}

/** Pozo con sus válvulas resueltas. Lo devuelve el endpoint de detalle. */
export interface PozoDetalle extends Pozo {
  zonaNombre: string;
  valvulas: ValvulaConEstado[];
  /** Peor estado entre sus válvulas: define el color del pin en el mapa. */
  estadoGeneral: EstadoValvula;
}

/** Resumen por pozo para los pines del mapa (sin traer todas las válvulas). */
export interface PozoResumen extends Pozo {
  estadoGeneral: EstadoValvula;
  cantidadValvulas: number;
  accionesPendientes: number;
}

/** Zona con conteo, para los clusters del mapa en zoom bajo. */
export interface ZonaResumen extends Zona {
  cantidadPozos: number;
  estadoGeneral: EstadoValvula;
}

/** Grupo de pozos cercanos sugerido por el clustering geográfico. */
export interface GrupoSugerido {
  /** Índice del cluster devuelto por PostGIS. */
  grupo: number;
  pozos: Array<{
    id: string;
    nombre: string;
    lat: number;
    lng: number;
    accionesPendientes: number;
  }>;
  /**
   * Distancia máxima entre dos pozos del grupo, en km.
   * Puede superar el radio de agrupamiento configurado: DBSCAN encadena pozos vecinos,
   * así que A-B y B-C a 15 km dejan a A y C a 30 km dentro del mismo grupo.
   */
  distanciaMaxKm: number;
}

export interface PlanSemanal {
  id: string;
  /** Lunes de la semana planificada, en ISO (YYYY-MM-DD). */
  semanaInicio: string;
  nombre: string;
  notificadoEn: string | null;
}

export const KPIS_VACIOS = {
  totalPozos: 0,
  valvulasOk: 0,
  valvulasEnFalla: 0,
  accionesPendientes: 0,
  porVencerEn30Dias: 0,
};

export type Kpis = typeof KPIS_VACIOS;
