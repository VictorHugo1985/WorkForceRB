import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface BruteForceEntry {
  attempts: number;
  lockedUntil: Date | null;
}

@Injectable()
export class BruteForceService {
  private readonly map = new Map<string, BruteForceEntry>();

  checkLock(email: string): void {
    const entry = this.map.get(email);
    if (!entry?.lockedUntil) return;

    if (entry.lockedUntil > new Date()) {
      const retryAfterSeconds = Math.ceil(
        (entry.lockedUntil.getTime() - Date.now()) / 1000,
      );
      throw new HttpException(
        { message: 'Cuenta bloqueada temporalmente.', retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.map.delete(email);
  }

  recordFailure(email: string): void {
    const entry = this.map.get(email) ?? { attempts: 0, lockedUntil: null };
    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      entry.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    }
    this.map.set(email, entry);
  }

  resetOnSuccess(email: string): void {
    this.map.delete(email);
  }
}
