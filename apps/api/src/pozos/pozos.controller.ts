import { Controller, Get, Param, Query } from '@nestjs/common';
import { Kpis, PozoDetalle, PozoResumen, ZonaResumen } from '@petrolero/shared';

import { PozosService } from './pozos.service';

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

  @Get('pozos/:id')
  obtenerPozo(@Param('id') id: string): Promise<PozoDetalle> {
    return this.pozos.obtenerPozo(id);
  }

  @Get('valvulas/:id/historial')
  historialValvula(@Param('id') id: string) {
    return this.pozos.historialValvula(id);
  }
}
