/**
 * CONTRATO DE NOTIFICACIÓN
 * ========================
 *
 * TODO[CLIENTE]: no está definido por qué canal se avisa al equipo de campo
 * (app, email, WhatsApp u otro).
 *
 * Por eso el canal se define como una interfaz abstracta: el planificador depende de
 * este contrato, no de una implementación concreta. Cuando el cliente confirme el canal,
 * se agrega una clase nueva que extienda NotificadorService y se cambia el provider en
 * notificaciones.module.ts. El resto del sistema no se toca.
 */

export interface TareaNotificada {
  pozo: string;
  valvula: string;
  accion: string;
}

export interface PlanParaNotificar {
  planId: string;
  nombre: string;
  semanaInicio: Date;
  tareas: TareaNotificada[];
}

export abstract class NotificadorService {
  /** Avisa al equipo de campo las tareas de un plan semanal confirmado. */
  abstract notificarPlanSemanal(plan: PlanParaNotificar): Promise<void>;

  /** Nombre del canal, para mostrarlo en la UI y saber qué está activo. */
  abstract get canal(): string;
}
