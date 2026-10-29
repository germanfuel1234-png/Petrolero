import { Injectable, Logger } from '@nestjs/common';

import { NotificadorService, PlanParaNotificar } from './notificador.interface';

/**
 * Implementación provisoria: deja el aviso en el log del servidor.
 *
 * TODO[CLIENTE]: reemplazar por el canal real una vez definido. Para hacerlo:
 *   1. Crear por ejemplo `email.notificador.ts` extendiendo NotificadorService.
 *   2. Cambiar el `useClass` en notificaciones.module.ts.
 * No hay que tocar PlanificacionService: depende de la interfaz, no de esta clase.
 */
@Injectable()
export class ConsolaNotificador extends NotificadorService {
  private readonly logger = new Logger(ConsolaNotificador.name);

  get canal(): string {
    return 'consola (provisorio)';
  }

  async notificarPlanSemanal(plan: PlanParaNotificar): Promise<void> {
    const semana = plan.semanaInicio.toISOString().slice(0, 10);

    this.logger.log(`--- AVISO AL EQUIPO DE CAMPO ---`);
    this.logger.log(`Plan: ${plan.nombre} (semana del ${semana})`);
    this.logger.log(`${plan.tareas.length} tareas asignadas:`);

    for (const tarea of plan.tareas) {
      this.logger.log(`  · ${tarea.pozo} / ${tarea.valvula} -> ${tarea.accion}`);
    }

    this.logger.warn(
      'Este aviso solo quedó en el log: falta definir el canal real con el cliente.',
    );
  }
}
