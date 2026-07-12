import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface LimitEntry { count: number; resetAt: number }
interface LimitState { version: 1; global: LimitEntry; ips: Record<string, LimitEntry> }

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; reason: 'ip_hourly' | 'global_daily'; resetAt: number; retryAfterSeconds: number };

export class PersistentRateLimiter {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly stateFile: string;
  private readonly hourMs: number;
  private readonly salt: string;

  constructor(private readonly options: {
    runtimeDir: string;
    hourlyIpLimit: number;
    globalDailyLimit: number;
    now?: () => number;
    hourMs?: number;
    salt?: string;
  }) {
    this.stateFile = path.join(options.runtimeDir, 'rate-limits.json');
    this.hourMs = options.hourMs ?? 60 * 60 * 1000;
    this.salt = options.salt ?? process.env.RATE_LIMIT_HASH_SALT ?? 'ai-exposure-check-h5-rate-limit-v1';
  }

  consume(clientIdentifier: string): Promise<RateLimitDecision> {
    const operation = this.queue.then(() => this.consumeLocked(clientIdentifier));
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  private async consumeLocked(clientIdentifier: string): Promise<RateLimitDecision> {
    const now = (this.options.now ?? Date.now)();
    const state = await this.readState(now);
    if (now >= state.global.resetAt) state.global = { count: 0, resetAt: nextUtcDayStart(now) };
    for (const [key, entry] of Object.entries(state.ips)) if (now >= entry.resetAt) delete state.ips[key];
    const key = createHash('sha256').update(`${this.salt}\0${clientIdentifier}`).digest('hex');
    const ipEntry = state.ips[key] ?? { count: 0, resetAt: now + this.hourMs };
    if (ipEntry.count >= this.options.hourlyIpLimit) return denied('ip_hourly', ipEntry.resetAt, now);
    if (state.global.count >= this.options.globalDailyLimit) return denied('global_daily', state.global.resetAt, now);
    state.ips[key] = { ...ipEntry, count: ipEntry.count + 1 };
    state.global.count += 1;
    await this.writeState(state);
    return { allowed: true };
  }

  private async readState(now: number): Promise<LimitState> {
    try {
      const value = JSON.parse(await readFile(this.stateFile, 'utf8')) as LimitState;
      if (value.version !== 1 || !value.global || !value.ips) throw new Error('invalid_rate_limit_state');
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { version: 1, global: { count: 0, resetAt: nextUtcDayStart(now) }, ips: {} };
    }
  }

  private async writeState(state: LimitState) {
    await mkdir(path.dirname(this.stateFile), { recursive: true });
    const temporary = `${this.stateFile}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.stateFile);
  }
}

function denied(reason: 'ip_hourly' | 'global_daily', resetAt: number, now: number): RateLimitDecision {
  return { allowed: false, reason, resetAt, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
}

function nextUtcDayStart(now: number) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}
