import { IsDateString, IsEnum, IsNumber, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';
import { TipoBono } from '@prisma/client';

export class CreateBonoDto {
  @IsUUID()
  colaboradorId: string;

  @IsUUID()
  semanaId: string;

  @IsDateString()
  fechaDia: string;

  @IsEnum(TipoBono)
  tipo: TipoBono;

  @IsNumber()
  @IsPositive()
  monto: number;

  @IsString()
  @MinLength(1)
  comentario: string;
}
