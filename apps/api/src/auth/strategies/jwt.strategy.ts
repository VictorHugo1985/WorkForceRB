import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
  nombre: string;
  roles: RolUsuario[];
  debeChangiarPassword: boolean;
  jti: string;
  iat: number;
  exp: number;
}

const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (this.authService.isBlacklisted(payload.jti)) {
      throw new UnauthorizedException('Token revocado');
    }

    const user = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { activo: true },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    return payload;
  }
}
