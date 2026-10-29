import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TipoAccionCorrectiva } from '@petrolero/shared';

import { RegistrarEventoDto } from './dto/registrar-evento.dto';
import { MantenimientoService } from './mantenimiento.service';

@Controller()
export class MantenimientoController {
  constructor(private readonly mantenimiento: MantenimientoService) {}

  @Get('acciones/tipos')
  listarTiposAccion(): Promise<TipoAccionCorrectiva[]> {
    return this.mantenimiento.listarTiposAccion();
  }

  @Post('mantenimiento')
  registrar(@Body() dto: RegistrarEventoDto) {
    // TODO[CLIENTE]: mientras no esté definido el esquema de usuarios real, el registro
    // queda atribuido de forma genérica. Con auth activa se toma del token.
    return this.mantenimiento.registrarEvento(dto);
  }

  @Patch('acciones/:id/completar')
  completarAccion(@Param('id') id: string) {
    return this.mantenimiento.completarAccion(id);
  }
}
