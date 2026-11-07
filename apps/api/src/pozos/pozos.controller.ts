import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Kpis, PozoDetalle, PozoResumen, ZonaResumen } from '@petrolero/shared';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { JwtOpcionalGuard } from '../auth/jwt-opcional.guard';
import { PermisosGuard, Requiere } from '../auth/permisos.guard';
import { PozosService } from './pozos.service';

class ArchivarPozoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

@Controller()
export class PozosController {
  constructor(private readonly pozos: PozosService) {}

  @Get('kpis')
  obtenerKpis(): Promise<Kpis> {
    return this.pozos.obtenerKpis();
  }

  @Get('zonas')
  listarZonas(): Promise<ZonaResumen[]> {
    return this.pozos.listarZonas();
  }

  @Get('zonas/:id/pozos')
  listarPozosDeZona(@Param('id') id: string): Promise<PozoResumen[]> {
    return this.pozos.listarPozosDeZona(id);
  }

  /** Con `?zonaId=` filtra; sin parámetro devuelve todos (el mapa los pide de una sola vez). */
  @Get('pozos')
  listarPozos(@Query('zonaId') zonaId?: string): Promise<PozoResumen[]> {
    return zonaId ? this.pozos.listarPozosDeZona(zonaId) : this.pozos.listarTodosLosPozos();
  }

  /** Va antes de 'pozos/:id' para que "archivados" no se interprete como un id. */
  @Get('pozos/archivados')
  listarArchivados() {
    return this.pozos.listarArchivados();
  }

  @Get('pozos/:id')
  obtenerPozo(@Param('id') id: string): Promise<PozoDetalle> {
    return this.pozos.obtenerPozo(id);
  }

  /**
   * Retira un pozo de operación conservando su historial.
   * No existe un endpoint de borrado físico: el historial de pruebas de hermeticidad
   * es dato de seguridad y la base lo protege con ON DELETE RESTRICT.
   */
  @Patch('pozos/:id/archivar')
  @UseGuards(JwtOpcionalGuard, PermisosGuard)
  @Requiere('archivar:pozos')
  archivar(@Param('id') id: string, @Body() dto: ArchivarPozoDto) {
    return this.pozos.archivarPozo(id, dto.motivo);
  }

  @Patch('pozos/:id/desarchivar')
  @UseGuards(JwtOpcionalGuard, PermisosGuard)
  @Requiere('archivar:pozos')
  desarchivar(@Param('id') id: string) {
    return this.pozos.desarchivarPozo(id);
  }

  @Get('valvulas/:id/historial')
  historialValvula(@Param('id') id: string) {
    return this.pozos.historialValvula(id);
  }
}
