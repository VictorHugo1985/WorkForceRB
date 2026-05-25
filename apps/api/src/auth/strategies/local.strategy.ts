import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { BruteForceService } from '../services/brute-force.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bruteForce: BruteForceService,
  ) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    this.bruteForce.checkLock(email);

    const user = await this.prisma.usuario.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user || !user.activo) {
      this.bruteForce.recordFailure(email);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      this.bruteForce.recordFailure(email);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.bruteForce.resetOnSuccess(email);
    return user;
  }
}
