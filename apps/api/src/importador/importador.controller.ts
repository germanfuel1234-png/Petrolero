import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtOpcionalGuard } from '../auth/jwt-opcional.guard';
import { PermisosGuard, Requiere } from '../auth/permisos.guard';
import { ImportadorService, ReporteImportacion } from './importador.service';
import { MAPEO_COLUMNAS } from './mapeo-columnas';

/** 50 MB, el mismo límite que anuncia la pantalla de importación. */
const TAMANIO_MAXIMO = 50 * 1024 * 1024;

@Controller('importacion')
export class ImportadorController {
  constructor(private readonly importador: ImportadorService) {}

  /** Devuelve el mapeo vigente, para que la UI muestre qué columnas espera el sistema. */
  @Get('mapeo')
  obtenerMapeo(): typeof MAPEO_COLUMNAS {
    return MAPEO_COLUMNAS;
  }

  /**
   * Carga un Excel/CSV.
   * Con `?simular=true` solo valida y devuelve la vista previa, sin escribir en la base.
   */
  @Post()
  @UseGuards(JwtOpcionalGuard, PermisosGuard)
  @Requiere('importar:datos')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANIO_MAXIMO } }))
  async importar(
    @UploadedFile() archivo: Express.Multer.File,
    @Query('simular') simular?: string,
  ): Promise<ReporteImportacion> {
    if (!archivo) {
      throw new BadRequestException('No se recibió ningún archivo en el campo "archivo".');
    }

    const extensionValida = /\.(xlsx|xls|csv)$/i.test(archivo.originalname);
    if (!extensionValida) {
      throw new BadRequestException(
        `Formato no soportado: "${archivo.originalname}". Se aceptan .xlsx, .xls o .csv.`,
      );
    }

    return this.importador.importar(archivo.buffer, { simular: simular === 'true' });
  }
}
