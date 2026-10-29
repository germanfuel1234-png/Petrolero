/**
 * Cliente HTTP de la API.
 * Las rutas son relativas: Vite proxea /api a NestJS en desarrollo (ver vite.config.ts).
 */

import type {
  GrupoSugerido,
  Kpis,
  PozoDetalle,
  PozoResumen,
  TipoAccionCorrectiva,
  ZonaResumen,
} from '@petrolero/shared';

const BASE = '/api';
const CLAVE_TOKEN = 'petrolero_token';

let token: string | null = localStorage.getItem(CLAVE_TOKEN);

/** Guarda el token en memoria y en localStorage (o lo borra si se pasa null). */
function setToken(nuevo: string | null): void {
  token = nuevo;
  if (nuevo) localStorage.setItem(CLAVE_TOKEN, nuevo);
  else localStorage.removeItem(CLAVE_TOKEN);
}

function encabezados(): HeadersInit {
  const base: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    headers: encabezados(),
    ...opciones,
  });

  if (!respuesta.ok) {
    // La API devuelve { message } en los errores de validación: se propaga ese texto
    // para poder mostrárselo al usuario tal cual.
    let detalle = `Error ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      if (cuerpo?.message) {
        detalle = Array.isArray(cuerpo.message) ? cuerpo.message.join('. ') : cuerpo.message;
      }
    } catch {
      // Respuesta sin JSON: se queda el mensaje genérico.
    }
    throw new Error(detalle);
  }

  if (respuesta.status === 204) return undefined as T;
  return respuesta.json() as Promise<T>;
}

export interface HistorialValvula {
  valvulaId: string;
  codigo: string;
  nombre: string;
  pozoNombre: string;
  eventos: Array<{
    id: string;
    fecha: string;
    engraseRealizado: boolean;
    resultadoPrueba: 'OK' | 'NEGATIVO';
    proximaRevision: string | null;
    observaciones: string | null;
    registradoPor: string | null;
    accion: { nombre: string; estado: string } | null;
  }>;
}

export interface AccionPendienteAgrupada {
  tipoAccionId: string;
  tipoNombre: string;
  items: Array<{
    accionId: string;
    valvulaId: string;
    valvulaCodigo: string;
    valvulaNombre: string;
    pozoId: string;
    pozoNombre: string;
    zonaNombre: string;
    detectadoEn: string;
    diasPendiente: number;
    estado: string;
    planSemanalId: string | null;
  }>;
}

export interface PlanSemanalListado {
  id: string;
  nombre: string;
  semanaInicio: string;
  notificadoEn: string | null;
  cantidadAcciones: number;
  acciones: Array<{
    id: string;
    tipoNombre: string;
    pozoNombre: string;
    valvulaCodigo: string;
    estado: string;
  }>;
}

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  permisos: string[];
}

export interface ReporteImportacion {
  filasLeidas: number;
  filasImportadas: number;
  errores: Array<{ fila: number; motivo: string; contenido?: string }>;
  columnasNoEncontradas: string[];
  creados: { zonas: number; pozos: number; valvulas: number; eventos: number; acciones: number };
  advertencias: string[];
}

export const api = {
  setToken,
  hayToken: () => token !== null,

  login: (email: string, password: string) =>
    pedir<{ token: string; usuario: UsuarioAutenticado }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  perfil: () => pedir<UsuarioAutenticado>('/auth/perfil'),

  kpis: () => pedir<Kpis>('/kpis'),

  zonas: () => pedir<ZonaResumen[]>('/zonas'),

  pozos: (zonaId?: string) =>
    pedir<PozoResumen[]>(zonaId ? `/pozos?zonaId=${encodeURIComponent(zonaId)}` : '/pozos'),

  pozo: (id: string) => pedir<PozoDetalle>(`/pozos/${id}`),

  historialValvula: (id: string) => pedir<HistorialValvula>(`/valvulas/${id}/historial`),

  tiposAccion: () => pedir<TipoAccionCorrectiva[]>('/acciones/tipos'),

  registrarMantenimiento: (datos: {
    valvulaId: string;
    fecha: string;
    engraseRealizado: boolean;
    resultadoPrueba: 'OK' | 'NEGATIVO';
    tipoAccionId?: string;
    observaciones?: string;
  }) => pedir('/mantenimiento', { method: 'POST', body: JSON.stringify(datos) }),

  accionesPendientes: (zonaId?: string) =>
    pedir<AccionPendienteAgrupada[]>(
      zonaId ? `/acciones/pendientes?zonaId=${encodeURIComponent(zonaId)}` : '/acciones/pendientes',
    ),

  sugerencias: () => pedir<GrupoSugerido[]>('/planificacion/sugerencias'),

  planes: () => pedir<PlanSemanalListado[]>('/planes'),

  crearPlan: (datos: { nombre: string; semanaInicio: string; accionIds: string[] }) =>
    pedir<{ id: string; nombre: string; accionesAsignadas: number }>('/planes', {
      method: 'POST',
      body: JSON.stringify(datos),
    }),

  notificarPlan: (id: string) =>
    pedir<{ id: string; notificadoEn: string | null; tareasNotificadas: number }>(
      `/planes/${id}/notificar`,
      { method: 'POST' },
    ),

  importarExcel: async (archivo: File, simular: boolean): Promise<ReporteImportacion> => {
    const datos = new FormData();
    datos.append('archivo', archivo);

    // Sin Content-Type manual: el navegador arma el boundary del multipart.
    const respuesta = await fetch(`${BASE}/importacion?simular=${simular}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: datos,
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => null);
      throw new Error(cuerpo?.message ?? `Error ${respuesta.status}`);
    }

    return respuesta.json();
  },
};
