import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GrupoSugerido } from '@petrolero/shared';

import { NotificadorService } from '../notificaciones/notificador.interface';
import { PrismaService } from '../prisma/prisma.service';

/** Fila que devuelve la consulta de clustering. */
interface FilaCluster {
  grupo: number;
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  acciones_pendientes: bigint;
}

/** Válvula con acción pendiente, agrupada por tipo de acción. */
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

@Injectable()
export class PlanificacionService {
  private readonly logger = new Logger(PlanificacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificador: NotificadorService,
  ) {}

  /**
   * Válvulas con acción correctiva sin completar, agrupadas por tipo de acción.
   * Es la vista de "todos estos pozos necesitan lavado" que pidió el cliente.
   */
  async listarAccionesPendientes(zonaId?: string): Promise<AccionPendienteAgrupada[]> {
    const acciones = await this.prisma.accionCorrectiva.findMany({
      where: {
        estado: { not: 'COMPLETADA' },
        ...(zonaId ? { evento: { valvula: { pozo: { zonaId } } } } : {}),
      },
      include: {
        tipoAccion: true,
        evento: {
          include: {
            valvula: { include: { pozo: { include: { zona: true } } } },
          },
        },
      },
      orderBy: { creadoEn: 'asc' },
    });

    const ahora = Date.now();
    const porTipo = new Map<string, AccionPendienteAgrupada>();

    for (const accion of acciones) {
      const { valvula } = accion.evento;

      if (!porTipo.has(accion.tipoAccionId)) {
        porTipo.set(accion.tipoAccionId, {
          tipoAccionId: accion.tipoAccionId,
          tipoNombre: accion.tipoAccion.nombre,
          items: [],
        });
      }

      const diasPendiente = Math.floor(
        (ahora - accion.evento.fecha.getTime()) / (1000 * 60 * 60 * 24),
      );

      porTipo.get(accion.tipoAccionId)!.items.push({
        accionId: accion.id,
        valvulaId: valvula.id,
        valvulaCodigo: valvula.codigo,
        valvulaNombre: valvula.nombre,
        pozoId: valvula.pozo.id,
        pozoNombre: valvula.pozo.nombre,
        zonaNombre: valvula.pozo.zona.nombre,
        detectadoEn: accion.evento.fecha.toISOString(),
        diasPendiente,
        estado: accion.estado,
        planSemanalId: accion.planSemanalId,
      });
    }

    // Primero el tipo de acción con más pendientes: es lo que más conviene planificar.
    return [...porTipo.values()].sort((a, b) => b.items.length - a.items.length);
  }

  /**
   * Agrupa por cercanía geográfica los pozos que tienen acciones pendientes,
   * para que una cuadrilla resuelva varios en el mismo viaje.
   *
   * Usa ST_ClusterDBSCAN sobre la columna `geom` (generada por PostGIS a partir de lat/lng).
   *
   * TODO[CLIENTE]: el criterio real de agrupamiento no está confirmado. Hoy agrupa por
   * radio (RADIO_AGRUPAMIENTO_KM, default 15 km). Si el cliente trabaja por yacimiento o
   * por cuadrante, se cambia esta consulta.
   */
  async sugerirGrupos(): Promise<GrupoSugerido[]> {
    const radioKm = Number(process.env.RADIO_AGRUPAMIENTO_KM ?? 15);

    // ST_ClusterDBSCAN trabaja sobre geometry y mide en las unidades del SRID.
    // En 4326 son grados, así que se convierten los km a grados aproximados.
    // 1 grado de latitud ~ 111.32 km. Es una aproximación suficiente para agrupar
    // cuadrillas; si hiciera falta precisión métrica real habría que reproyectar.
    const epsGrados = radioKm / 111.32;

    const filas = await this.prisma.$queryRaw<FilaCluster[]>`
      WITH pozos_con_pendientes AS (
        SELECT
          p.id,
          p.nombre,
          p.lat,
          p.lng,
          p.geom,
          COUNT(ac.id) AS acciones_pendientes
        FROM "Pozo" p
        JOIN "Valvula" v ON v."pozoId" = p.id
        JOIN "EventoMantenimiento" em ON em."valvulaId" = v.id
        JOIN "AccionCorrectiva" ac ON ac."eventoId" = em.id
        WHERE ac.estado <> 'COMPLETADA'
          AND ac."planSemanalId" IS NULL
        GROUP BY p.id, p.nombre, p.lat, p.lng, p.geom
      )
      SELECT
        ST_ClusterDBSCAN(geom::geometry, eps := ${epsGrados}, minpoints := 1)
          OVER () AS grupo,
        id,
        nombre,
        lat,
        lng,
        acciones_pendientes
      FROM pozos_con_pendientes
    `;

    const porGrupo = new Map<number, FilaCluster[]>();
    for (const fila of filas) {
      const grupo = Number(fila.grupo);
      if (!porGrupo.has(grupo)) porGrupo.set(grupo, []);
      porGrupo.get(grupo)!.push(fila);
    }

    const grupos: GrupoSugerido[] = [...porGrupo.entries()].map(([grupo, pozos]) => ({
      grupo,
      pozos: pozos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        lat: p.lat,
        lng: p.lng,
        accionesPendientes: Number(p.acciones_pendientes),
      })),
      distanciaMaxKm: this.calcularDistanciaMaxima(pozos),
    }));

    // Los grupos más grandes primero: son los que más viaje ahorran.
    return grupos.sort((a, b) => b.pozos.length - a.pozos.length);
  }

  /**
   * Distancia máxima entre dos pozos del grupo, en km (fórmula de Haversine).
   * Puede dar más que RADIO_AGRUPAMIENTO_KM: DBSCAN encadena vecinos, así que dos pozos
   * extremos del mismo grupo pueden estar a varias veces esa distancia entre sí.
   */
  private calcularDistanciaMaxima(pozos: FilaCluster[]): number {
    if (pozos.length < 2) return 0;

    let maxima = 0;
    for (let i = 0; i < pozos.length; i++) {
      for (let j = i + 1; j < pozos.length; j++) {
        const distancia = this.distanciaKm(
          pozos[i].lat,
          pozos[i].lng,
          pozos[j].lat,
          pozos[j].lng,
        );
        if (distancia > maxima) maxima = distancia;
      }
    }

    return Math.round(maxima * 10) / 10;
  }

  private distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const RADIO_TIERRA_KM = 6371;
    const aRad = (grados: number): number => (grados * Math.PI) / 180;

    const dLat = aRad(lat2 - lat1);
    const dLng = aRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(aRad(lat1)) * Math.cos(aRad(lat2)) * Math.sin(dLng / 2) ** 2;

    return RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async listarPlanes() {
    const planes = await this.prisma.planSemanal.findMany({
      orderBy: { semanaInicio: 'desc' },
      include: {
        acciones: {
          include: {
            tipoAccion: true,
            evento: { include: { valvula: { include: { pozo: true } } } },
          },
        },
      },
    });

    return planes.map((plan) => ({
      id: plan.id,
      nombre: plan.nombre,
      semanaInicio: plan.semanaInicio.toISOString().slice(0, 10),
      notificadoEn: plan.notificadoEn?.toISOString() ?? null,
      cantidadAcciones: plan.acciones.length,
      acciones: plan.acciones.map((a) => ({
        id: a.id,
        tipoNombre: a.tipoAccion.nombre,
        pozoNombre: a.evento.valvula.pozo.nombre,
        valvulaCodigo: a.evento.valvula.codigo,
        estado: a.estado,
      })),
    }));
  }

  /** Crea un plan semanal y le asigna las acciones correctivas elegidas. */
  async crearPlan(datos: { nombre: string; semanaInicio: Date; accionIds: string[] }) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.planSemanal.create({
        data: { nombre: datos.nombre, semanaInicio: datos.semanaInicio },
      });

      if (datos.accionIds.length > 0) {
        await tx.accionCorrectiva.updateMany({
          where: { id: { in: datos.accionIds } },
          data: { planSemanalId: plan.id, estado: 'PLANIFICADA' },
        });
      }

      return { id: plan.id, nombre: plan.nombre, accionesAsignadas: datos.accionIds.length };
    });
  }

  /** Avisa al equipo de campo y deja registrada la fecha del aviso. */
  async notificarPlan(planId: string) {
    const plan = await this.prisma.planSemanal.findUnique({
      where: { id: planId },
      include: {
        acciones: {
          include: {
            tipoAccion: true,
            evento: { include: { valvula: { include: { pozo: true } } } },
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`No existe el plan ${planId}`);
    }

    await this.notificador.notificarPlanSemanal({
      planId: plan.id,
      nombre: plan.nombre,
      semanaInicio: plan.semanaInicio,
      tareas: plan.acciones.map((a) => ({
        pozo: a.evento.valvula.pozo.nombre,
        valvula: a.evento.valvula.codigo,
        accion: a.tipoAccion.nombre,
      })),
    });

    const actualizado = await this.prisma.planSemanal.update({
      where: { id: planId },
      data: { notificadoEn: new Date() },
    });

    return {
      id: actualizado.id,
      notificadoEn: actualizado.notificadoEn?.toISOString() ?? null,
      tareasNotificadas: plan.acciones.length,
    };
  }
}
