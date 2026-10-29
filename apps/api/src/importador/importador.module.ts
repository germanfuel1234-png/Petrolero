import { Module } from '@nestjs/common';

import { ImportadorController } from './importador.controller';
import { ImportadorService } from './importador.service';

@Module({
  controllers: [ImportadorController],
  providers: [ImportadorService],
  exports: [ImportadorService],
})
export class ImportadorModule {}
