import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegistrarEventoDto {
  @IsString()
  valvulaId!: string;

  @Type(() => Date)
  @IsDate({ message: 'La fecha de mantenimiento no es válida.' })
  fecha!: Date;

  @IsBoolean()
  engraseRealizado!: boolean;

  @IsIn(['OK', 'NEGATIVO'], {
    message: 'El resultado de la prueba debe ser OK o NEGATIVO.',
  })
  resultadoPrueba!: 'OK' | 'NEGATIVO';

  /**
   * Obligatorio cuando el resultado es NEGATIVO.
   * La validación cruzada se hace en el servicio, que es donde vive la regla de negocio.
   */
  @IsOptional()
  @IsString()
  tipoAccionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
