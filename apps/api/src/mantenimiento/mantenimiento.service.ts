import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TipoAccionCorrectiva } from '@petrolero/shared';
import { calcularProximaRevision, requiereAccionCorrectiva } from '@petrolero/shared';

import { PrismaService } from '../prisma/prisma.service';
import { RegistrarEventoDto } from './dto/registrar-evento.dto';

@Injectable()
export class MantenimientoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catálogo de acciones correctivas activas, para poblar el selector del formulario. */
  async listarTiposAccion(): Promise<TipoAccionCorrectiva[]> {
    const tipos = await this.prisma.tipoAccionCorrectiva.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    return tipos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
    }));
  }

  /**
   * Registra una inspección de válvula.
   *
   * Reglas aplicadas acá (y no en el frontend, para que valgan también vía API):
   *  - Resultado OK      -> próxima revisión a +1 año.
   *  - Resultado NEGATIVO -> sin próxima revisión, y acción correctiva OBLIGATORIA.
   *
   * El historial es append-only: esto siempre inserta, nunca actualiza un evento previo.
   */
  async registrarEvento(dto: RegistrarEventoDto, usuario?: string) {
    const valvula = await this.prisma.valvula.findUnique({
      where: { id: dto.valvulaId },
      select: { id: true, codigo: true },
    });

    if (!valvula) {
      throw new NotFoundException(`No existe la válvula ${dto.valvulaId}`);
    }

    // Una inspección con fecha futura casi siempre es un error de tipeo.
    const finDeHoy = new Date();
    finDeHoy.setHours(23, 59, 59, 999);
    if (dto.fecha > finDeHoy) {
      throw new BadRequestException('La fecha del mantenimiento no puede ser futura.');
    }

    const necesitaAccion = requiereAccionCorrectiva(dto.resultadoPrueba);

    if (necesitaAccion && !dto.tipoAccionId) {
      throw new BadRequestException(
        'Una prueba con resultado NEGATIVO requiere elegir una acción correctiva.',
      );
    }

    if (dto.tipoAccionId) {
      const tipo = await this.prisma.tipoAccionCorrectiva.findUnique({
        where: { id: dto.tipoAccionId },
      });

      if (!tipo) {
        throw new BadRequestException(`No existe la acción correctiva ${dto.tipoAccionId}`);
      }
    }

    const proximaRevision = calcularProximaRevision(dto.fecha, dto.resultadoPrueba);

    // Transacción: el evento y su acción correctiva tienen que nacer juntos o no nacer.
    return this.prisma.$transaction(async (tx) => {
      const evento = await tx.eventoMantenimiento.create({
        data: {
          valvulaId: dto.valvulaId,
          fecha: dto.fecha,
          engraseRealizado: dto.engraseRealizado,
          resultadoPrueba: dto.resultadoPrueba,
          proximaRevision,
          observaciones: dto.observaciones ?? null,
          // TODO[CLIENTE]: se guarda el usuario que carga, sin firma ni segunda validación.
          registradoPor: usuario ?? null,
        },
      });

      if (necesitaAccion && dto.tipoAccionId) {
        await tx.accionCorrectiva.create({
          data: {
            eventoId: evento.id,
            tipoAccionId: dto.tipoAccionId,
            estado: 'PENDIENTE',
          },
        });
      }

      return {
        id: evento.id,
        valvulaId: evento.valvulaId,
        fecha: evento.fecha.toISOString(),
        engraseRealizado: evento.engraseRealizado,
        resultadoPrueba: evento.resultadoPrueba as 'OK' | 'NEGATIVO',
        proximaRevision: evento.proximaRevision?.toISOString() ?? null,
        observaciones: evento.observaciones,
        registradoPor: evento.registradoPor,
      };
    });
  }

  /** Marca una acción correctiva como completada (ya se intervino la válvula en campo). */
  async completarAccion(accionId: string) {
    const accion = await this.prisma.accionCorrectiva.findUnique({ where: { id: accionId } });

    if (!accion) {
      throw new NotFoundException(`No existe la acción correctiva ${accionId}`);
    }

    return this.prisma.accionCorrectiva.update({
      where: { id: accionId },
      data: { estado: 'COMPLETADA' },
    });
  }
}
