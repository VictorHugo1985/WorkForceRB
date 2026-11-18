import { Module } from '@nestjs/common';
import { LiquidacionesController } from './liquidaciones.controller';
import { LiquidacionesService } from './liquidaciones.service';
import { LiquidacionCalculatorService } from './services/liquidacion-calculator.service';
import { AuditLiquidacionService } from './services/audit-liquidacion.service';

@Module({
  controllers: [LiquidacionesController],
  providers: [LiquidacionesService, LiquidacionCalculatorService, AuditLiquidacionService],
  exports: [LiquidacionesService],
})
export class LiquidacionesModule {}
