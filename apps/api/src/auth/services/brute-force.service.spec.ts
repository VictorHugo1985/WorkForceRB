import { BruteForceService } from './brute-force.service';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('BruteForceService', () => {
  let service: BruteForceService;

  beforeEach(() => {
    service = new BruteForceService();
  });

  it('allows access for unknown email', () => {
    expect(() => service.checkLock('new@example.com')).not.toThrow();
  });

  it('does not lock before 5 failures', () => {
    for (let i = 0; i < 4; i++) service.recordFailure('a@b.com');
    expect(() => service.checkLock('a@b.com')).not.toThrow();
  });

  it('throws 429 after 5 failures', () => {
    for (let i = 0; i < 5; i++) service.recordFailure('a@b.com');
    expect(() => service.checkLock('a@b.com')).toThrow(HttpException);
    try {
      service.checkLock('a@b.com');
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(err.getResponse()).toMatchObject({ retryAfterSeconds: expect.any(Number) });
    }
  });

  it('resets counter on success', () => {
    for (let i = 0; i < 5; i++) service.recordFailure('a@b.com');
    service.resetOnSuccess('a@b.com');
    expect(() => service.checkLock('a@b.com')).not.toThrow();
    for (let i = 0; i < 4; i++) service.recordFailure('a@b.com');
    expect(() => service.checkLock('a@b.com')).not.toThrow();
  });

  it('expires lock after lockedUntil passes', () => {
    for (let i = 0; i < 5; i++) service.recordFailure('a@b.com');
    const entry = (service as any).map.get('a@b.com');
    entry.lockedUntil = new Date(Date.now() - 1000);
    expect(() => service.checkLock('a@b.com')).not.toThrow();
    expect((service as any).map.has('a@b.com')).toBe(false);
  });
});
