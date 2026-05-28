import { IsDateString } from 'class-validator';

export class CreateSemanaLaboralDto {
  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;
}
