import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { RolUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { LiquidacionesService } from './liquidaciones.service';
import { PatchDiaLiquidacionDto } from './dto/patch-dia-liquidacion.dto';
import { CreateBonoDto } from './dto/create-bono.dto';
import { PatchBonoDto } from './dto/patch-bono.dto';
import { CreateSemanaLaboralDto } from './dto/create-semana-laboral.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class LiquidacionesController {
  constructor(private readonly liquidacionesService: LiquidacionesService) {}

  @Get('semanas-laborales')
  async getSemanas() {
    return this.liquidacionesService.getSemanas();
  }

  @Post('semanas-laborales')
  async createSemana(@Body() dto: CreateSemanaLaboralDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    this.assertAdminAccess(user.roles);
    return this.liquidacionesService.createSemana(dto);
  }

  @Patch('semanas-laborales/:id/cerrar')
  async cerrarSemana(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    this.assertAdminAccess(user.roles);
    return this.liquidacionesService.cerrarSemana(id, user.sub);
  }

  @Get('liquidaciones/resumen')
  async getResumen(
    @Query('semana_id') semanaId: string | undefined,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    this.assertLiquidacionesAccess(user.roles);
    return this.liquidacionesService.getResumen(semanaId, user.sub, user.roles);
  }

  @Get('liquidaciones')
  async getLiquidacion(
    @Query('colaborador_id') colaboradorId: string,
    @Query('semana_id') semanaId: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    this.assertLiquidacionesAccess(user.roles);

    if (!colaboradorId || !semanaId) {
      throw new NotFoundException('Se requiere colaborador_id y semana_id');
    }

    await this.liquidacionesService.assertScope(user.sub, user.roles, colaboradorId);
    const liq = await this.liquidacionesService.getLiquidacion(colaboradorId, semanaId);
    if (!liq) throw new NotFoundException('Liquidación no encontrada');
    return liq;
  }

  @Patch('dias-liquidacion/:id')
  async patchDiaLiquidacion(
    @Param('id') id: string,
    @Body() dto: PatchDiaLiquidacionDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    this.assertLiquidacionesAccess(user.roles);
    return this.liquidacionesService.patchDiaLiquidacion(id, dto, user.sub, user.roles);
  }

  @Post('liquidaciones/:id/aprobar')
  async aprobarLiquidacion(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    this.assertLiquidacionesAccess(user.roles);
    return this.liquidacionesService.aprobarLiquidacion(id, user.sub, user.roles);
  }

  @Post('bonos')
  async createBono(@Body() dto: CreateBonoDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    this.assertLiquidacionesAccess(user.roles);
    return this.liquidacionesService.createBono(dto, user.sub, user.roles);
  }

  @Patch('bonos/:id')
  async patchBono(
    @Param('id') id: string,
    @Body() dto: PatchBonoDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    this.assertLiquidacionesAccess(user.roles);
    return this.liquidacionesService.patchBono(id, dto, user.sub, user.roles);
  }

  @Delete('bonos/:id')
  async deleteBono(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    this.assertLiquidacionesAccess(user.roles);
    return this.liquidacionesService.deleteBono(id, user.sub, user.roles);
  }

  private assertLiquidacionesAccess(roles: RolUsuario[]): void {
    if (!roles.includes(RolUsuario.ADMINISTRADOR) && !roles.includes(RolUsuario.SUPERVISOR)) {
      throw new ForbiddenException('Acceso no autorizado');
    }
  }

  private assertAdminAccess(roles: RolUsuario[]): void {
    if (!roles.includes(RolUsuario.ADMINISTRADOR)) {
      throw new ForbiddenException('Solo administradores pueden gestionar semanas');
    }
  }
}
