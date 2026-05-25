import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

const mockJwt = { sign: jest.fn().mockReturnValue('signed-token') } as any as JwtService;
const mockPrisma = {
  usuario: { update: jest.fn().mockResolvedValue({}) },
} as any as PrismaService;

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'a@b.com',
    nombre: 'Ana',
    apellido: 'García',
    debe_cambiar_password: false,
    roles: [{ rol: 'ADMINISTRADOR' }],
    ...overrides,
  };
}

function makeRes() {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as any;
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(mockJwt, mockPrisma);
  });

  it('login sets cookie and returns DTO', () => {
    const res = makeRes();
    const dto = service.login(makeUser() as any, res);
    expect(res.cookie).toHaveBeenCalledWith('access_token', 'signed-token', expect.any(Object));
    expect(dto).toMatchObject({ nombre: 'Ana García', roles: ['ADMINISTRADOR'], debeChangiarPassword: false });
  });

  it('logout adds jti to blacklist', () => {
    service.logout('jti-abc');
    expect(service.isBlacklisted('jti-abc')).toBe(true);
  });

  it('isBlacklisted returns false for unknown jti', () => {
    expect(service.isBlacklisted('unknown')).toBe(false);
  });

  it('renewToken signs new token with fresh jti', () => {
    const res = makeRes();
    const payload = {
      sub: 'u1', email: 'a@b.com', nombre: 'Ana García',
      roles: ['ADMINISTRADOR'] as any, debeChangiarPassword: false,
      jti: 'old-jti', iat: 1000, exp: 2000,
    };
    service.renewToken(payload, res);
    expect(mockJwt.sign).toHaveBeenCalledWith(
      expect.not.objectContaining({ iat: expect.anything() }),
      expect.any(Object),
    );
    expect(res.cookie).toHaveBeenCalledWith('access_token', 'signed-token', expect.any(Object));
  });
});
