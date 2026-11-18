import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { TipoAjusteDia } from '@prisma/client';

export class PatchDiaLiquidacionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  horasAjustadasSupervisor?: number;

  @ValidateIf((o) => o.horasAjustadasSupervisor !== undefined && o.horasAjustadasSupervisor !== null)
  @IsString()
  motivoAjuste?: string;

  @IsOptional()
  @IsEnum(TipoAjusteDia)
  ajusteTipo?: TipoAjusteDia;

  @ValidateIf((o) => o.ajusteTipo !== undefined && o.ajusteTipo !== null)
  @IsNumber()
  @IsPositive()
  ajusteValor?: number;

  @ValidateIf((o) => o.ajusteTipo !== undefined && o.ajusteTipo !== null)
  @IsString()
  ajusteDescripcion?: string;

  @IsOptional()
  @IsBoolean()
  aprobar?: boolean;
}
