import { Global, Module } from '@nestjs/common';

import { ConsolaNotificador } from './consola.notificador';
import { NotificadorService } from './notificador.interface';

/**
 * Único lugar donde se elige el canal de notificación.
 * Cuando el cliente defina el canal real, se cambia el `useClass` de acá.
 */
@Global()
@Module({
  providers: [{ provide: NotificadorService, useClass: ConsolaNotificador }],
  exports: [NotificadorService],
})
export class NotificacionesModule {}
