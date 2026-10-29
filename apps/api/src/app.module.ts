import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { ImportadorModule } from './importador/importador.module';
import { MantenimientoModule } from './mantenimiento/mantenimiento.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { PlanificacionModule } from './planificacion/planificacion.module';
import { PozosModule } from './pozos/pozos.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    NotificacionesModule,
    AuthModule,
    PozosModule,
    MantenimientoModule,
    PlanificacionModule,
    ImportadorModule,
  ],
})
export class AppModule {}
