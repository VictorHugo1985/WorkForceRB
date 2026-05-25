import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');
const bcryptCompare = bcrypt.compare as jest.Mock;

function makePrisma(user: any) {
  return { usuario: { findUnique: jest.fn().mockResolvedValue(user) } } as any;
}

function makeBrute() {
  return { checkLock: jest.fn(), recordFailure: jest.fn(), resetOnSuccess: jest.fn() } as any;
}

function makeUser(overrides = {}) {
  return {
    id: 'u1', email: 'a@b.com', password_hash: 'hash',
    activo: true, roles: [{ rol: 'ADMINISTRADOR' }], ...overrides,
  };
}

describe('LocalStrategy', () => {
  it('returns user on valid credentials', async () => {
    bcryptCompare.mockResolvedValue(true);
    const strategy = new LocalStrategy(makePrisma(makeUser()), makeBrute());
    const result = await strategy.validate('a@b.com', 'pass');
    expect(result).toMatchObject({ id: 'u1' });
  });

  it('throws 401 on wrong password', async () => {
    bcryptCompare.mockResolvedValue(false);
    const brute = makeBrute();
    const strategy = new LocalStrategy(makePrisma(makeUser()), brute);
    await expect(strategy.validate('a@b.com', 'bad')).rejects.toThrow(UnauthorizedException);
    expect(brute.recordFailure).toHaveBeenCalledWith('a@b.com');
  });

  it('throws 401 for inactive user', async () => {
    bcryptCompare.mockResolvedValue(true);
    const brute = makeBrute();
    const strategy = new LocalStrategy(makePrisma(makeUser({ activo: false })), brute);
    await expect(strategy.validate('a@b.com', 'pass')).rejects.toThrow(UnauthorizedException);
    expect(brute.recordFailure).toHaveBeenCalled();
  });

  it('propagates lockout exception from BruteForceService', async () => {
    const brute = makeBrute();
    brute.checkLock.mockImplementation(() => { throw new Error('locked'); });
    const strategy = new LocalStrategy(makePrisma(null), brute);
    await expect(strategy.validate('a@b.com', 'pass')).rejects.toThrow('locked');
  });
});
