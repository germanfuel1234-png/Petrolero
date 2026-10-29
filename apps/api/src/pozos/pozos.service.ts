import { Injectable, NotFoundException } from '@nestjs/common';
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

  /** Zonas con conteo de pozos, para los clusters del mapa en zoom bajo. */
  async listarZonas(): Promise<ZonaResumen[]> {
    const zonas = await this.prisma.zona.findMany({ orderBy: { nombre: 'asc' } });

    return Promise.all(
      zonas.map(async (zona) => {
        const pozos = await this.listarPozosDeZona(zona.id);

        return {
          id: zona.id,
          nombre: zona.nombre,
          lat: zona.lat,
          lng: zona.lng,
          cantidadPozos: pozos.length,
          estadoGeneral: peorEstado(pozos.map((p) => p.estadoGeneral)),
        };
      }),
    );
  }

  /** Pozos de una zona, resumidos para los pines del mapa. */
  async listarPozosDeZona(zonaId: string): Promise<PozoResumen[]> {
    const pozos = await this.prisma.pozo.findMany({
      where: { zonaId },
      orderBy: { nombre: 'asc' },
      include: {
        valvulas: {
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

  /** Todos los pozos, para dibujar el mapa completo de una sola vez. */
  async listarTodosLosPozos(): Promise<PozoResumen[]> {
    const zonas = await this.prisma.zona.findMany({ select: { id: true } });
    const porZona = await Promise.all(zonas.map((z) => this.listarPozosDeZona(z.id)));
    return porZona.flat();
  }

  /** Detalle completo de un pozo con todas sus válvulas resueltas. */
  async obtenerPozo(id: string): Promise<PozoDetalle> {
    const pozo = await this.prisma.pozo.findUnique({
      where: { id },
      include: {
        zona: true,
        valvulas: {
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

  /** KPIs del encabezado. Se calculan con agregaciones, no trayendo todo a memoria. */
  async obtenerKpis(): Promise<Kpis> {
    const [totalPozos, accionesPendientes] = await Promise.all([
      this.prisma.pozo.count(),
      this.prisma.accionCorrectiva.count({ where: { estado: { not: 'COMPLETADA' } } }),
    ]);

    // El estado de una válvula depende de su ÚLTIMO evento, así que no alcanza con
    // contar eventos: hay que resolver válvula por válvula.
    const valvulas = await this.prisma.valvula.findMany({
      include: {
        eventos: {
          orderBy: { fecha: 'desc' },
          take: 1,
          include: { accionCorrectiva: { include: { tipoAccion: true } } },
        },
      },
    });

    const estados = valvulas.map((v) => this.resolverEstadoValvula(v as ValvulaCruda).estado);

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

  /** Ventana de aviso usada por los KPIs, expuesta para que la UI muestre el mismo número. */
  get diasAviso(): number {
    return DIAS_AVISO_VENCIMIENTO;
  }
}
