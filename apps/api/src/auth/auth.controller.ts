import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

const SLIDING_WINDOW_THRESHOLD_SECONDS = 3600;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '';
    const user = req.user as any;

    try {
      const result = this.authService.login(user, res);
      await this.logAudit('LOGIN_EXITOSO', user.id, ip, { email: user.email });
      return result;
    } catch (err) {
      await this.logAudit('LOGIN_FALLIDO', null, ip, {
        email: user?.email,
        motivo_fallo: (err as Error).message,
      });
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const payload = req.user as JwtPayload;
    this.authService.logout(payload.jti);
    res.clearCookie('access_token', { path: '/' });
    return { message: 'Sesión cerrada correctamente' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const payload = req.user as JwtPayload;
    const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
    if (secondsLeft < SLIDING_WINDOW_THRESHOLD_SECONDS) {
      this.authService.renewToken(payload, res);
    }
    return {
      sub: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      roles: payload.roles,
      debeChangiarPassword: payload.debeChangiarPassword,
    };
  }

  private async logAudit(
    accion: string,
    usuarioId: string | null,
    ip: string,
    datosNuevos: object,
  ) {
    try {
      await this.prisma.registroAuditoria.create({
        data: {
          accion,
          usuario_id: usuarioId ?? undefined,
          ip_origen: ip,
          datos_nuevos: datosNuevos,
        },
      });
    } catch {
      // audit logging must never break the auth flow
    }
  }
}
