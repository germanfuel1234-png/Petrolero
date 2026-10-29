import { Module } from '@nestjs/common';

import { PozosController } from './pozos.controller';
import { PozosService } from './pozos.service';

@Module({
  controllers: [PozosController],
  providers: [PozosService],
  exports: [PozosService],
})
export class PozosModule {}
