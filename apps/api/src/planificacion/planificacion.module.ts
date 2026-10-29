import { Module } from '@nestjs/common';

import { PlanificacionController } from './planificacion.controller';
import { PlanificacionService } from './planificacion.service';

@Module({
  controllers: [PlanificacionController],
  providers: [PlanificacionService],
  exports: [PlanificacionService],
})
export class PlanificacionModule {}
