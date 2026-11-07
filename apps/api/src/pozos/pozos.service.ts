import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DIAS_AVISO_VENCIMIENTO,
  EstadoValvula,
  Kpis,
  PozoDetalle,
  PozoResumen,
  ValvulaConEstado,
  ZonaResumen,
  derivarEstadoValvula,
  peorEstado,
} from '@petrolero/shared';

import { PrismaService } from '../prisma/prisma.service';

/** Fila mínima que devuelve la consulta de KPIs: un registro por válvula. */
interface FilaEstadoValvula {
  resultado: string | null;
  proxima_revision: Date | null;
  estado_accion: string | null;
}

/** Forma de válvula con su último evento, tal como la trae Prisma. */
type ValvulaCruda = {
  id: string;
  pozoId: string;
  codigo: string;
  nombre: string;
  orientacion: string;
  orden: number;
  eventos: Array<{
    id: string;
    valvulaId: string;
    fecha: Date;
    engraseRealizado: boolean;
    resultadoPrueba: string;
    proximaRevision: Date | null;
    observaciones: string | null;
    registradoPor: string | null;
    accionCorrectiva: {
      id: string;
      estado: string;
      tipoAccion: { nombre: string };
    } | null;
  }>;
};

@Injectable()
export class PozosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Zonas con conteo de pozos, para los clusters del mapa en zoom bajo.
   *
   * Antes esto hacía una consulta por zona (llamaba a listarPozosDeZona en un bucle);
   * ahora trae todos los pozos de una sola vez y los agrupa en memoria.
   */
  async listarZonas(): Promise<ZonaResumen[]> {
    const [zonas, pozos] = await Promise.all([
      this.prisma.zona.findMany({ orderBy: { nombre: 'asc' } }),
      this.listarTodosLosPozos(),
    ]);

    const pozosPorZona = new Map<string, PozoResumen[]>();
    for (const pozo of pozos) {
      const lista = pozosPorZona.get(pozo.zonaId);
      if (lista) lista.push(pozo);
      else pozosPorZona.set(pozo.zonaId, [pozo]);
    }

    return zonas.map((zona) => {
      const deLaZona = pozosPorZona.get(zona.id) ?? [];

      return {
        id: zona.id,
        nombre: zona.nombre,
        lat: zona.lat,
        lng: zona.lng,
        cantidadPozos: deLaZona.length,
        estadoGeneral: peorEstado(deLaZona.map((p) => p.estadoGeneral)),
      };
    });
  }

  /** Pozos de una zona, resumidos para los pines del mapa. */
  listarPozosDeZona(zonaId: string): Promise<PozoResumen[]> {
    return this.cargarResumenDePozos(zonaId);
  }

  /** Todos los pozos, para dibujar el mapa completo de una sola vez. */
  listarTodosLosPozos(): Promise<PozoResumen[]> {
    return this.cargarResumenDePozos();
  }

  /**
   * Única consulta que alimenta los listados de pozos.
   * Excluye archivados: un pozo retirado no aparece en el mapa ni en los listados,
   * pero su historial sigue existiendo en la base.
   */
  private async cargarResumenDePozos(zonaId?: string): Promise<PozoResumen[]> {
    const pozos = await this.prisma.pozo.findMany({
      where: {
        archivadoEn: null,
        ...(zonaId ? { zonaId } : {}),
      },
      orderBy: { nombre: 'asc' },
      include: {
        valvulas: {
          where: { archivadoEn: null },
          include: {
            eventos: {
              orderBy: { fecha: 'desc' },
              take: 1,
              include: { accionCorrectiva: { include: { tipoAccion: true } } },
            },
          },
        },
      },
    });

    return pozos.map((pozo) => {
      const valvulas = pozo.valvulas.map((v) => this.resolverEstadoValvula(v as ValvulaCruda));

      return {
        id: pozo.id,
        nombre: pozo.nombre,
        zonaId: pozo.zonaId,
        lat: pozo.lat,
        lng: pozo.lng,
        cantidadValvulas: valvulas.length,
        estadoGeneral: peorEstado(valvulas.map((v) => v.estado)),
        accionesPendientes: valvulas.filter((v) => v.accionPendiente !== null).length,
      };
    });
  }

  /** Detalle completo de un pozo con todas sus válvulas resueltas. */
  async obtenerPozo(id: string): Promise<PozoDetalle> {
    const pozo = await this.prisma.pozo.findUnique({
      where: { id },
      include: {
        zona: true,
        valvulas: {
          where: { archivadoEn: null },
          // El visor 3D ubica las válvulas por orientación y orden.
          orderBy: [{ orientacion: 'asc' }, { orden: 'asc' }],
          include: {
            eventos: {
              orderBy: { fecha: 'desc' },
              take: 1,
              include: { accionCorrectiva: { include: { tipoAccion: true } } },
            },
          },
        },
      },
    });

    if (!pozo) {
      throw new NotFoundException(`No existe el pozo ${id}`);
    }

    const valvulas = pozo.valvulas.map((v) => this.resolverEstadoValvula(v as ValvulaCruda));

    return {
      id: pozo.id,
      nombre: pozo.nombre,
      zonaId: pozo.zonaId,
      zonaNombre: pozo.zona.nombre,
      lat: pozo.lat,
      lng: pozo.lng,
      valvulas,
      estadoGeneral: peorEstado(valvulas.map((v) => v.estado)),
    };
  }

  /** Historial completo de una válvula, del evento más nuevo al más viejo. */
  async historialValvula(valvulaId: string) {
    const valvula = await this.prisma.valvula.findUnique({
      where: { id: valvulaId },
      include: {
        pozo: { select: { nombre: true } },
        eventos: {
          orderBy: { fecha: 'desc' },
          include: { accionCorrectiva: { include: { tipoAccion: true } } },
        },
      },
    });

    if (!valvula) {
      throw new NotFoundException(`No existe la válvula ${valvulaId}`);
    }

    return {
      valvulaId: valvula.id,
      codigo: valvula.codigo,
      nombre: valvula.nombre,
      pozoNombre: valvula.pozo.nombre,
      eventos: valvula.eventos.map((e) => ({
        id: e.id,
        fecha: e.fecha.toISOString(),
        engraseRealizado: e.engraseRealizado,
        resultadoPrueba: e.resultadoPrueba,
        proximaRevision: e.proximaRevision?.toISOString() ?? null,
        observaciones: e.observaciones,
        registradoPor: e.registradoPor,
        accion: e.accionCorrectiva
          ? { nombre: e.accionCorrectiva.tipoAccion.nombre, estado: e.accionCorrectiva.estado }
          : null,
      })),
    };
  }

  /**
   * KPIs del encabezado.
   *
   * El estado de una válvula depende de su ÚLTIMO evento, así que no se puede contar
   * con un simple GROUP BY. Antes esto traía TODAS las válvulas con sus eventos y
   * relaciones completas a memoria.
   *
   * Ahora una sola consulta con DISTINCT ON devuelve exactamente una fila mínima por
   * válvula (tres campos), y la clasificación se sigue haciendo con
   * `derivarEstadoValvula` de @petrolero/shared.
   *
   * La regla de negocio NO se reimplementa en SQL a propósito: si se duplicara,
   * la versión SQL y la de shared podrían divergir sin que los tests lo noten.
   */
  async obtenerKpis(): Promise<Kpis> {
    const [totalPozos, accionesPendientes, ultimosEventos] = await Promise.all([
      this.prisma.pozo.count({ where: { archivadoEn: null } }),
      this.prisma.accionCorrectiva.count({
        where: {
          estado: { not: 'COMPLETADA' },
          evento: { valvula: { archivadoEn: null, pozo: { archivadoEn: null } } },
        },
      }),
      this.prisma.$queryRaw<FilaEstadoValvula[]>`
        SELECT DISTINCT ON (v.id)
          em."resultadoPrueba" AS resultado,
          em."proximaRevision" AS proxima_revision,
          ac.estado            AS estado_accion
        FROM "Valvula" v
        JOIN "Pozo" p ON p.id = v."pozoId"
        LEFT JOIN "EventoMantenimiento" em ON em."valvulaId" = v.id
        LEFT JOIN "AccionCorrectiva" ac ON ac."eventoId" = em.id
        WHERE v."archivadoEn" IS NULL
          AND p."archivadoEn" IS NULL
        ORDER BY v.id, em.fecha DESC NULLS LAST
      `,
    ]);

    const estados = ultimosEventos.map((fila) =>
      derivarEstadoValvula(
        fila.resultado
          ? {
              resultadoPrueba: fila.resultado as 'OK' | 'NEGATIVO',
              proximaRevision: fila.proxima_revision?.toISOString() ?? null,
            }
          : null,
        fila.estado_accion !== null && fila.estado_accion !== 'COMPLETADA',
      ),
    );

    return {
      totalPozos,
      valvulasOk: estados.filter((e) => e === 'OK').length,
      valvulasEnFalla: estados.filter((e) => e === 'FALLA').length,
      accionesPendientes,
      porVencerEn30Dias: estados.filter((e) => e === 'POR_VENCER').length,
    };
  }

  /**
   * Traduce una válvula cruda a su forma con estado resuelto.
   * El estado NO se guarda en base: se deriva siempre del último evento, así no puede
   * quedar desincronizado con el historial.
   */
  private resolverEstadoValvula(valvula: ValvulaCruda): ValvulaConEstado {
    const ultimo = valvula.eventos[0] ?? null;
    const accion = ultimo?.accionCorrectiva ?? null;
    const tieneAccionPendiente = accion !== null && accion.estado !== 'COMPLETADA';

    const ultimoEvento = ultimo
      ? {
          id: ultimo.id,
          valvulaId: ultimo.valvulaId,
          fecha: ultimo.fecha.toISOString(),
          engraseRealizado: ultimo.engraseRealizado,
          resultadoPrueba: ultimo.resultadoPrueba as 'OK' | 'NEGATIVO',
          proximaRevision: ultimo.proximaRevision?.toISOString() ?? null,
          observaciones: ultimo.observaciones,
          registradoPor: ultimo.registradoPor,
        }
      : null;

    const estado: EstadoValvula = derivarEstadoValvula(ultimoEvento, tieneAccionPendiente);

    return {
      id: valvula.id,
      pozoId: valvula.pozoId,
      codigo: valvula.codigo,
      nombre: valvula.nombre,
      orientacion: valvula.orientacion as 'VERTICAL' | 'HORIZONTAL',
      orden: valvula.orden,
      estado,
      ultimoEvento,
      accionPendiente:
        accion && tieneAccionPendiente
          ? {
              id: accion.id,
              tipoNombre: accion.tipoAccion.nombre,
              estado: accion.estado as 'PENDIENTE' | 'PLANIFICADA' | 'COMPLETADA',
            }
          : null,
    };
  }

  /**
   * Archiva un pozo: lo saca de mapas, listados y KPIs sin tocar su historial.
   *
   * Es la única forma de retirar un pozo de circulación. El borrado físico está
   * bloqueado por las claves foráneas (ON DELETE RESTRICT), justamente para que nadie
   * pueda destruir por accidente el historial de pruebas de hermeticidad.
   */
  async archivarPozo(id: string, motivo?: string, usuario?: string) {
    const pozo = await this.prisma.pozo.findUnique({ where: { id } });

    if (!pozo) throw new NotFoundException(`No existe el pozo ${id}`);

    if (pozo.archivadoEn) {
      throw new ConflictException(
        `El pozo ${pozo.nombre} ya estaba archivado el ${pozo.archivadoEn.toISOString().slice(0, 10)}.`,
      );
    }

    // Las válvulas se archivan junto con el pozo: dejarlas activas haría que siguieran
    // apareciendo en acciones pendientes de un pozo que ya no está operativo.
    const [actualizado] = await this.prisma.$transaction([
      this.prisma.pozo.update({
        where: { id },
        data: {
          archivadoEn: new Date(),
          archivadoPor: usuario ?? null,
          motivoArchivado: motivo ?? null,
        },
      }),
      this.prisma.valvula.updateMany({
        where: { pozoId: id, archivadoEn: null },
        data: { archivadoEn: new Date() },
      }),
    ]);

    return {
      id: actualizado.id,
      nombre: actualizado.nombre,
      archivadoEn: actualizado.archivadoEn?.toISOString() ?? null,
      motivo: actualizado.motivoArchivado,
    };
  }

  /** Devuelve un pozo archivado a operación, junto con sus válvulas. */
  async desarchivarPozo(id: string) {
    const pozo = await this.prisma.pozo.findUnique({ where: { id } });

    if (!pozo) throw new NotFoundException(`No existe el pozo ${id}`);
    if (!pozo.archivadoEn) {
      throw new ConflictException(`El pozo ${pozo.nombre} no está archivado.`);
    }

    const [actualizado] = await this.prisma.$transaction([
      this.prisma.pozo.update({
        where: { id },
        data: { archivadoEn: null, archivadoPor: null, motivoArchivado: null },
      }),
      this.prisma.valvula.updateMany({ where: { pozoId: id }, data: { archivadoEn: null } }),
    ]);

    return { id: actualizado.id, nombre: actualizado.nombre, archivadoEn: null };
  }

  /** Pozos archivados, para poder consultarlos o reactivarlos. */
  async listarArchivados() {
    const pozos = await this.prisma.pozo.findMany({
      where: { archivadoEn: { not: null } },
      orderBy: { archivadoEn: 'desc' },
      include: { zona: { select: { nombre: true } }, _count: { select: { valvulas: true } } },
    });

    return pozos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      zonaNombre: p.zona.nombre,
      cantidadValvulas: p._count.valvulas,
      archivadoEn: p.archivadoEn?.toISOString() ?? null,
      archivadoPor: p.archivadoPor,
      motivo: p.motivoArchivado,
    }));
  }

  /** Ventana de aviso usada por los KPIs, expuesta para que la UI muestre el mismo número. */
  get diasAviso(): number {
    return DIAS_AVISO_VENCIMIENTO;
  }
}
