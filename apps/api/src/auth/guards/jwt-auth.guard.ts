import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { JwtPayload } from '../strategies/jwt.strategy';

const ALLOWED_WHEN_MUST_CHANGE_PASSWORD = [
  '/auth/cambiar-contrasena',
  '/auth/logout',
];

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = JwtPayload>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('No autenticado');
    }

    const payload = user as unknown as JwtPayload;
    if (payload.debeChangiarPassword) {
      const req = context.switchToHttp().getRequest<Request>();
      const path = req.path;
      const allowed = ALLOWED_WHEN_MUST_CHANGE_PASSWORD.some((p) =>
        path.startsWith(p),
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Debe cambiar su contraseña antes de continuar',
        );
      }
    }

    return user;
  }
}
