import { IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class PatchBonoDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  monto?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  comentario?: string;
}
