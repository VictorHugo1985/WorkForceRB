import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';

function makePayload(overrides = {}): JwtPayload {
  return {
    sub: 'u1', email: 'a@b.com', nombre: 'Ana', roles: ['ADMINISTRADOR'] as any,
    debeChangiarPassword: false, jti: 'jti-1', iat: 0, exp: 9999999999, ...overrides,
  };
}

function makeAuth(blacklisted = false) {
  return { isBlacklisted: jest.fn().mockReturnValue(blacklisted) } as any;
}

function makePrisma(user: any) {
  return { usuario: { findUnique: jest.fn().mockResolvedValue(user) } } as any;
}

describe('JwtStrategy', () => {
  it('returns payload for valid active user', async () => {
    const strategy = new JwtStrategy(makeAuth(false), makePrisma({ activo: true }));
    const result = await strategy.validate(makePayload());
    expect(result).toMatchObject({ sub: 'u1' });
  });

  it('throws 401 for blacklisted jti', async () => {
    const strategy = new JwtStrategy(makeAuth(true), makePrisma({ activo: true }));
    await expect(strategy.validate(makePayload())).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when user is inactive', async () => {
    const strategy = new JwtStrategy(makeAuth(false), makePrisma({ activo: false }));
    await expect(strategy.validate(makePayload())).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when user not found', async () => {
    const strategy = new JwtStrategy(makeAuth(false), makePrisma(null));
    await expect(strategy.validate(makePayload())).rejects.toThrow(UnauthorizedException);
  });
});
