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
import { TipoDescuentoDia } from '@prisma/client';

export class PatchDiaLiquidacionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  horasAjustadasSupervisor?: number;

  @ValidateIf((o) => o.horasAjustadasSupervisor !== undefined && o.horasAjustadasSupervisor !== null)
  @IsString()
  motivoAjuste?: string;

  @IsOptional()
  @IsEnum(TipoDescuentoDia)
  descuentoTipo?: TipoDescuentoDia;

  @ValidateIf((o) => o.descuentoTipo !== undefined && o.descuentoTipo !== null)
  @IsNumber()
  @IsPositive()
  descuentoValor?: number;

  @ValidateIf((o) => o.descuentoTipo !== undefined && o.descuentoTipo !== null)
  @IsString()
  descuentoMotivo?: string;

  @IsOptional()
  @IsBoolean()
  aprobar?: boolean;
}
