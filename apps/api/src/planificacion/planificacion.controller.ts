import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsString } from 'class-validator';

import { JwtOpcionalGuard } from '../auth/jwt-opcional.guard';
import { PermisosGuard, Requiere } from '../auth/permisos.guard';
import { PlanificacionService } from './planificacion.service';

class CrearPlanDto {
  @IsString()
  nombre!: string;

  @Type(() => Date)
  @IsDate({ message: 'La semana de inicio no es una fecha válida.' })
  semanaInicio!: Date;

  @IsArray()
  @IsString({ each: true })
  accionIds!: string[];
}

@Controller()
export class PlanificacionController {
  constructor(private readonly planificacion: PlanificacionService) {}

  /** Acciones pendientes agrupadas por tipo (lavado, bombeo, etc.). */
  @Get('acciones/pendientes')
  listarPendientes(@Query('zonaId') zonaId?: string) {
    return this.planificacion.listarAccionesPendientes(zonaId);
  }

  /** Grupos de pozos cercanos sugeridos por PostGIS. */
  @Get('planificacion/sugerencias')
  sugerirGrupos() {
    return this.planificacion.sugerirGrupos();
  }

  @Get('planes')
  listarPlanes() {
    return this.planificacion.listarPlanes();
  }

  // Los permisos ya están declarados, pero recién se aplican cuando la autenticación
  // se active globalmente (ver PermisosGuard y ROLES_Y_PERMISOS en PENDIENTES-CLIENTE.md).
  @Post('planes')
  @UseGuards(JwtOpcionalGuard, PermisosGuard)
  @Requiere('crear:planes')
  crearPlan(@Body() dto: CrearPlanDto) {
    return this.planificacion.crearPlan(dto);
  }

  @Post('planes/:id/notificar')
  @UseGuards(JwtOpcionalGuard, PermisosGuard)
  @Requiere('notificar:planes')
  notificar(@Param('id') id: string) {
    return this.planificacion.notificarPlan(id);
  }
}
