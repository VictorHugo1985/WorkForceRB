import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario, Usuario, UsuarioRol } from '@prisma/client';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginResponseDto } from './dto/login-response.dto';

const JWT_TTL_SECONDS = 7200;
const COOKIE_NAME = 'access_token';

type UserWithRoles = Usuario & { roles: UsuarioRol[] };

interface JwtPayload {
  sub: string;
  email: string;
  nombre: string;
  roles: RolUsuario[];
  debeChangiarPassword: boolean;
  jti: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly blacklist = new Set<string>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  login(user: UserWithRoles, res: Response): LoginResponseDto {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      nombre: `${user.nombre} ${user.apellido}`,
      roles: user.roles.map((r) => r.rol),
      debeChangiarPassword: user.debe_cambiar_password,
      jti: randomUUID(),
    };

    const token = this.jwt.sign(payload, {
      expiresIn: JWT_TTL_SECONDS,
    });

    this.setCookie(res, token);
    void this.updateUltimoAcceso(user.id);

    return {
      nombre: payload.nombre,
      roles: payload.roles,
      debeChangiarPassword: payload.debeChangiarPassword,
    };
  }

  logout(jti: string): void {
    this.blacklist.add(jti);
  }

  isBlacklisted(jti: string): boolean {
    return this.blacklist.has(jti);
  }

  renewToken(payload: JwtPayload, res: Response): void {
    const { iat: _iat, exp: _exp, ...rest } = payload;
    const newPayload = { ...rest, jti: randomUUID() };
    const token = this.jwt.sign(newPayload, { expiresIn: JWT_TTL_SECONDS });
    this.setCookie(res, token);
  }

  private setCookie(res: Response, token: string): void {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  async updateUltimoAcceso(userId: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { ultimo_acceso: new Date() },
    });
  }
}
