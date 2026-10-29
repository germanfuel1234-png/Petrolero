/**
 * MAPEO DE COLUMNAS DEL EXCEL
 * ===========================
 *
 * TODO[CLIENTE]: este mapeo está inventado. No tenemos el Excel maestro real del cliente.
 *
 * ESTE ES EL ÚNICO ARCHIVO QUE HAY QUE TOCAR cuando llegue el Excel de verdad.
 * El importador (importador.service.ts) no conoce ningún nombre de columna: lee todo de acá.
 *
 * Cómo adaptarlo:
 *   1. Abrir el Excel del cliente y mirar los encabezados de la primera fila.
 *   2. Poner esos nombres exactos en `columnas` (se puede listar más de uno por campo:
 *      el importador usa el primero que encuentre, así tolera variantes entre archivos).
 *   3. Correr la importación: el reporte avisa si alguna columna obligatoria no apareció.
 *
 * La comparación de nombres ignora mayúsculas, acentos y espacios de más, así que
 * "Pozo", "POZO " y "pozo" se consideran la misma columna.
 */

export type CampoImportacion =
  | 'zona'
  | 'pozo'
  | 'latitud'
  | 'longitud'
  | 'valvula'
  | 'nombreValvula'
  | 'orientacion'
  | 'fechaMantenimiento'
  | 'resultadoPrueba'
  | 'accionCorrectiva'
  | 'observaciones';

interface DefinicionColumna {
  /** Nombres posibles del encabezado en el Excel. Se usa el primero que exista. */
  columnas: string[];
  /** Si falta, la fila se rechaza y va al reporte de errores. */
  obligatorio: boolean;
  descripcion: string;
}

export const MAPEO_COLUMNAS: Record<CampoImportacion, DefinicionColumna> = {
  zona: {
    columnas: ['zona', 'yacimiento', 'area'],
    obligatorio: true,
    descripcion: 'Zona o yacimiento al que pertenece el pozo.',
  },
  pozo: {
    columnas: ['pozo', 'nombre pozo', 'well'],
    obligatorio: true,
    descripcion: 'Identificador del pozo, ej. LC-4022.',
  },
  latitud: {
    columnas: ['latitud', 'lat', 'y'],
    obligatorio: false,
    descripcion: 'Latitud en grados decimales. Sin esto el pozo no aparece en el mapa.',
  },
  longitud: {
    columnas: ['longitud', 'lng', 'lon', 'x'],
    obligatorio: false,
    descripcion: 'Longitud en grados decimales.',
  },
  valvula: {
    columnas: ['valvula', 'codigo valvula', 'id valvula'],
    obligatorio: true,
    descripcion: 'Código de la válvula dentro del pozo, ej. V-1.',
  },
  nombreValvula: {
    columnas: ['nombre valvula', 'descripcion valvula', 'tipo valvula'],
    obligatorio: false,
    descripcion: 'Nombre descriptivo, ej. "Master superior". Si falta se usa el código.',
  },
  orientacion: {
    columnas: ['orientacion', 'posicion', 'disposicion'],
    obligatorio: false,
    descripcion: 'VERTICAL u HORIZONTAL. Si falta se asume VERTICAL.',
  },
  fechaMantenimiento: {
    columnas: ['fecha mantenimiento', 'fecha', 'fecha inspeccion'],
    obligatorio: false,
    descripcion: 'Fecha de la última inspección. Sin esto la válvula queda "sin datos".',
  },
  resultadoPrueba: {
    columnas: ['resultado', 'resultado prueba', 'hermeticidad', 'prueba'],
    obligatorio: false,
    descripcion: 'Resultado de la prueba de hermeticidad (ver RESULTADOS_ACEPTADOS).',
  },
  accionCorrectiva: {
    columnas: ['accion', 'accion correctiva', 'intervencion'],
    obligatorio: false,
    descripcion: 'Acción requerida cuando el resultado fue negativo.',
  },
  observaciones: {
    columnas: ['observaciones', 'comentarios', 'notas'],
    obligatorio: false,
    descripcion: 'Texto libre.',
  },
};

/**
 * Valores que se interpretan como resultado de la prueba.
 * TODO[CLIENTE]: confirmar con qué palabras exactas se carga hoy el resultado en el Excel.
 */
export const RESULTADOS_ACEPTADOS = {
  OK: ['ok', 'positivo', 'positiva', 'si', 'sí', 'aprobado', 'pasa', 'bien', 'p'],
  NEGATIVO: ['negativo', 'negativa', 'no', 'rechazado', 'falla', 'mal', 'n'],
} as const;

export const ORIENTACIONES_ACEPTADAS = {
  VERTICAL: ['vertical', 'v', 'vert'],
  HORIZONTAL: ['horizontal', 'h', 'horiz'],
} as const;

/** Normaliza un encabezado o valor para comparar sin depender de mayúsculas ni acentos. */
export function normalizar(texto: unknown): string {
  return String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Quita los diacríticos ya separados por NFD (tildes, diéresis).
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}
