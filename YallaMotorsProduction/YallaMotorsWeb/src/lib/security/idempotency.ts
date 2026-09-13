import 'server-only';

/**
 * Idempotency Engine and Storage (IDEM-01).
 *
 * Implements Phase 2 Section 3.1 & 3.8 (IDEM-01):
 * - Keyed by (user-or-anonymous-fingerprint, operation, Idempotency-Key).
 * - Retains canonical request hash and final response for 24 hours (IDEMPOTENCY_TTL_SECONDS).
 * - Atomic compare-and-set reservation prevents duplicate upstream mutations during concurrent executions.
 * - Concurrent same-key/same-hash requests wait for and replay the first final response without repeating upstream I/O.
 * - Different-hash requests return typed 409 Conflict immediately, even while the first is in flight.
 * - Redis-backed store (RedisIdempotencyStore) provides horizontally scalable, durable coordination across instances.
 * - Strict production guard (UnsafeIdempotencyConfigurationError): forbids in-memory fallback in production.
 * - Release ownership safety: only the token owner that claimed the reservation can release it.
 */

import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import { EventEmitter } from 'node:events';
import type { AuthClaims, SessionClaims } from '@/types/auth';
import type { OperationError } from '@/types/common';
import { createOperationError } from '@/lib/api/error';
import { serverEnv } from '@/lib/env/server';

export const IDEMPOTENCY_TTL_MS = (serverEnv.IDEMPOTENCY_TTL_SECONDS ?? 86400) * 1000;
export const DEFAULT_LOCK_TIMEOUT_MS = 30 * 1000; // 30 seconds reservation lease
export const DEFAULT_WAIT_TIMEOUT_MS = 30 * 1000; // 30 seconds max concurrent wait
export const DEFAULT_POLL_INTERVAL_MS = 50; // 50ms polling tick

const completionEmitter = new EventEmitter();
completionEmitter.setMaxListeners(200);

export class UnsafeIdempotencyConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeIdempotencyConfigurationError';
  }
}

export interface IdempotentResponse {
  readonly status: number;
  readonly headers?: Record<string, string> | undefined;
  readonly body: unknown;
}

export interface BaseIdempotencyRecord {
  readonly key: string;
  readonly fingerprint: string;
  readonly operation: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly createdAt: number;
}

export interface InFlightIdempotencyRecord extends BaseIdempotencyRecord {
  readonly status: 'IN_FLIGHT';
  readonly ownerToken: string;
  readonly lockExpiresAt: number;
  readonly expiresAt: number;
  readonly response?: undefined;
}

export interface CompletedIdempotencyRecord extends BaseIdempotencyRecord {
  readonly status: 'COMPLETED';
  readonly response: IdempotentResponse;
  readonly completedAt: number;
  readonly expiresAt: number;
  readonly ownerToken?: string | undefined;
  readonly lockExpiresAt?: undefined;
}

export type IdempotencyRecord = InFlightIdempotencyRecord | CompletedIdempotencyRecord;

export interface ReserveStoreOptions {
  key: string;
  fingerprint: string;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  lockTimeoutMs: number;
  ownerToken?: string | undefined;
}

export interface FinalizeStoreOptions {
  key: string;
  /** The token returned by reserve(). Only that reservation may finalize its response. */
  ownerToken?: string | undefined;
  response: IdempotentResponse;
  ttlMs: number;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | undefined> | IdempotencyRecord | undefined;
  set(key: string, record: IdempotencyRecord): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
  reserve(options: ReserveStoreOptions): Promise<{ reserved: boolean; existing?: IdempotencyRecord | undefined }> | { reserved: boolean; existing?: IdempotencyRecord | undefined };
  finalize(options: FinalizeStoreOptions): Promise<void> | void;
  release(key: string, ownerToken?: string | undefined): Promise<void> | void;
}

// ── Minimal High-Performance Redis RESP Protocol Client ───────────────────────

export function encodeCommand(args: (string | number)[]): string {
  let out = `*${args.length}\r\n`;
  for (const arg of args) {
    const str = String(arg);
    out += `$${Buffer.byteLength(str, 'utf8')}\r\n${str}\r\n`;
  }
  return out;
}

export class RespParser {
  private buffer = '';

  public append(chunk: string): void {
    this.buffer += chunk;
  }

  public parseNext(): { hasValue: boolean; value?: unknown } {
    if (this.buffer.length === 0) return { hasValue: false };

    const type = this.buffer[0];
    const crlf = this.buffer.indexOf('\r\n');
    if (crlf === -1) return { hasValue: false };

    if (type === '+') {
      const val = this.buffer.slice(1, crlf);
      this.buffer = this.buffer.slice(crlf + 2);
      return { hasValue: true, value: val };
    }

    if (type === '-') {
      const errMsg = this.buffer.slice(1, crlf);
      this.buffer = this.buffer.slice(crlf + 2);
      throw new Error(`Redis error: ${errMsg}`);
    }

    if (type === ':') {
      const num = parseInt(this.buffer.slice(1, crlf), 10);
      this.buffer = this.buffer.slice(crlf + 2);
      return { hasValue: true, value: num };
    }

    if (type === '$') {
      const len = parseInt(this.buffer.slice(1, crlf), 10);
      if (len === -1) {
        this.buffer = this.buffer.slice(crlf + 2);
        return { hasValue: true, value: null };
      }
      const dataStart = crlf + 2;
      const dataEnd = dataStart + len;
      if (this.buffer.length < dataEnd + 2) {
        return { hasValue: false };
      }
      const val = this.buffer.slice(dataStart, dataEnd);
      this.buffer = this.buffer.slice(dataEnd + 2);
      return { hasValue: true, value: val };
    }

    if (type === '*') {
      const count = parseInt(this.buffer.slice(1, crlf), 10);
      if (count === -1) {
        this.buffer = this.buffer.slice(crlf + 2);
        return { hasValue: true, value: null };
      }
      const savedBuffer = this.buffer;
      this.buffer = this.buffer.slice(crlf + 2);
      const arr: unknown[] = [];
      for (let i = 0; i < count; i++) {
        const item = this.parseNext();
        if (!item.hasValue) {
          this.buffer = savedBuffer;
          return { hasValue: false };
        }
        arr.push(item.value);
      }
      return { hasValue: true, value: arr };
    }

    throw new Error(`Unknown RESP data type: ${type}`);
  }
}

export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: 'PX', duration?: number, flag?: 'NX'): Promise<string | null>;
  del(key: string): Promise<number>;
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  quit?(): Promise<void>;
  disconnect?(): void;
  clear?(): void;
}

export class NativeRedisClient implements RedisClientLike {
  private readonly url: URL;
  private socket: net.Socket | tls.TLSSocket | null = null;
  private connectingPromise: Promise<void> | null = null;
  private parser = new RespParser();
  private pendingCallbacks: Array<{
    resolve: (val: unknown) => void;
    reject: (err: Error) => void;
  }> = [];

  constructor(redisUrl: string) {
    this.url = new URL(redisUrl);
  }

  private async ensureConnected(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = new Promise<void>((resolve, reject) => {
      const isTls = this.url.protocol === 'rediss:';
      const port = this.url.port ? parseInt(this.url.port, 10) : 6379;
      const host = this.url.hostname || 'localhost';

      const onConnect = () => {
        const authCommands: (string | number)[][] = [];
        if (this.url.password) {
          if (this.url.username && this.url.username !== 'default') {
            authCommands.push(['AUTH', this.url.username, this.url.password]);
          } else {
            authCommands.push(['AUTH', this.url.password]);
          }
        }
        if (this.url.pathname && this.url.pathname.length > 1) {
          const dbIndex = parseInt(this.url.pathname.slice(1), 10);
          if (!isNaN(dbIndex) && dbIndex > 0) {
            authCommands.push(['SELECT', dbIndex]);
          }
        }

        if (authCommands.length > 0) {
          for (const cmd of authCommands) {
            this.sendCommand(cmd).catch(() => {});
          }
        }
        resolve();
      };

      const onError = (err: Error) => {
        this.connectingPromise = null;
        reject(err);
      };

      if (isTls) {
        this.socket = tls.connect({ host, port, rejectUnauthorized: true }, onConnect);
      } else {
        this.socket = net.createConnection({ host, port }, onConnect);
      }

      this.socket.on('error', onError);
      this.socket.on('data', (data) => {
        try {
          this.parser.append(data.toString('utf8'));
          while (true) {
            const next = this.parser.parseNext();
            if (!next.hasValue) break;
            const cb = this.pendingCallbacks.shift();
            if (cb) {
              cb.resolve(next.value);
            }
          }
        } catch (parseErr) {
          const cb = this.pendingCallbacks.shift();
          if (cb) {
            cb.reject(parseErr instanceof Error ? parseErr : new Error(String(parseErr)));
          }
        }
      });
      this.socket.on('close', () => {
        this.socket = null;
        this.connectingPromise = null;
        while (this.pendingCallbacks.length > 0) {
          this.pendingCallbacks.shift()?.reject(new Error('Redis connection closed'));
        }
      });
    });

    return this.connectingPromise;
  }

  public async sendCommand(args: (string | number)[]): Promise<unknown> {
    await this.ensureConnected();
    if (!this.socket || this.socket.destroyed) {
      throw new Error('Redis socket is not connected');
    }

    return new Promise((resolve, reject) => {
      this.pendingCallbacks.push({ resolve, reject });
      const encoded = encodeCommand(args);
      this.socket?.write(encoded, 'utf8', (err) => {
        if (err) {
          const idx = this.pendingCallbacks.findIndex((cb) => cb.resolve === resolve);
          if (idx !== -1) {
            this.pendingCallbacks.splice(idx, 1);
          }
          reject(err);
        }
      });
    });
  }

  public async get(key: string): Promise<string | null> {
    const res = await this.sendCommand(['GET', key]);
    return typeof res === 'string' ? res : null;
  }

  public async set(
    key: string,
    value: string,
    mode?: 'PX',
    duration?: number,
    flag?: 'NX'
  ): Promise<string | null> {
    const args: (string | number)[] = ['SET', key, value];
    if (mode && duration !== undefined) {
      args.push(mode, duration);
    }
    if (flag) {
      args.push(flag);
    }
    const res = await this.sendCommand(args);
    return typeof res === 'string' ? res : null;
  }

  public async del(key: string): Promise<number> {
    const res = await this.sendCommand(['DEL', key]);
    return typeof res === 'number' ? res : 0;
  }

  public async eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown> {
    return this.sendCommand(['EVAL', script, numKeys, ...args]);
  }

  public async quit(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      this.socket.end();
    }
    this.socket = null;
  }

  public disconnect(): void {
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy();
    }
    this.socket = null;
  }
}

/**
 * In-memory Mock Redis Client for test injection and offline contract verification.
 */
export class MockRedisClient implements RedisClientLike {
  private readonly store = new Map<string, { value: string; expiresAt?: number | undefined }>();

  public async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  public async set(
    key: string,
    value: string,
    mode?: 'PX',
    duration?: number,
    flag?: 'NX'
  ): Promise<string | null> {
    const existing = await this.get(key);
    if (flag === 'NX' && existing !== null) {
      return null;
    }
    const expiresAt = mode === 'PX' && duration !== undefined ? Date.now() + duration : undefined;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  public async del(key: string): Promise<number> {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }

  public async eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown> {
    const keys = args.slice(0, numKeys).map(String);
    const scriptArgs = args.slice(numKeys).map(String);
    const key = keys[0];
    if (!key) return null;

    // Script 1: Atomic Compare-and-Set Reservation (SET_NX_CAS)
    if (script.includes('SET_NX_CAS')) {
      const existing = await this.get(key);
      if (!existing) {
        const val = scriptArgs[0] ?? '';
        const timeoutMs = parseInt(scriptArgs[1] ?? '30000', 10);
        await this.set(key, val, 'PX', timeoutMs);
        return [1, ''];
      }
      return [0, existing];
    }

    // Script 2: Safe Ownership Release (RELEASE_OWNER_SAFE)
    if (script.includes('RELEASE_OWNER_SAFE')) {
      const current = await this.get(key);
      if (current) {
        const ownerToken = scriptArgs[0] ?? '';
        if (ownerToken === '*' || current.includes(ownerToken)) {
          await this.del(key);
          return 1;
        }
      }
      return 0;
    }

    // Script 3: Safe Ownership Finalization (FINALIZE_OWNER_SAFE)
    if (script.includes('FINALIZE_OWNER_SAFE')) {
      const current = await this.get(key);
      if (!current) return 0;
      try {
        const record = JSON.parse(current) as { status?: string; ownerToken?: string };
        if (record.status !== 'IN_FLIGHT' || record.ownerToken !== scriptArgs[0]) {
          return 0;
        }
      } catch {
        return 0;
      }
      const completed = scriptArgs[1] ?? '';
      const ttlMs = parseInt(scriptArgs[2] ?? '86400000', 10);
      await this.set(key, completed, 'PX', ttlMs);
      return 1;
    }

    return null;
  }

  public clear(): void {
    this.store.clear();
  }
}

// ── Redis Lua Scripts for Concurrency & Ownership Safety ──────────────────────

const RESERVATION_LUA_SCRIPT = `
-- SET_NX_CAS
local existing = redis.call('get', KEYS[1])
if not existing then
    redis.call('set', KEYS[1], ARGV[1], 'PX', ARGV[2])
    return {1, ''}
else
    return {0, existing}
end
`;

const RELEASE_OWNERSHIP_LUA_SCRIPT = `
-- RELEASE_OWNER_SAFE
local current = redis.call('get', KEYS[1])
if current then
    local ok, record = pcall(cjson.decode, current)
    if ok and record.status == 'IN_FLIGHT' and record.ownerToken == ARGV[1] then
        return redis.call('del', KEYS[1])
    end
end
return 0
`;

const FINALIZE_OWNERSHIP_LUA_SCRIPT = `
-- FINALIZE_OWNER_SAFE
local current = redis.call('get', KEYS[1])
if not current then
    return 0
end
local ok, record = pcall(cjson.decode, current)
if not ok or record.status ~= 'IN_FLIGHT' or record.ownerToken ~= ARGV[1] then
    return 0
end
redis.call('set', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1
`;

export interface RedisIdempotencyStoreOptions {
  url?: string | undefined;
  client?: RedisClientLike | undefined;
  ttlSeconds?: number | undefined;
  keyPrefix?: string | undefined;
}

/**
 * Production-ready Redis-backed Idempotency Store.
 * Provides atomic compare-and-set reservation, lease expiry, release ownership safety,
 * and durable 24-hour completed response retention across horizontally scaled instances.
 */
export class RedisIdempotencyStore implements IdempotencyStore {
  public readonly client: RedisClientLike;
  public readonly ttlSeconds: number;
  public readonly keyPrefix: string;

  constructor(options: RedisIdempotencyStoreOptions) {
    this.ttlSeconds = options.ttlSeconds ?? (serverEnv.IDEMPOTENCY_TTL_SECONDS || 86400);
    this.keyPrefix = options.keyPrefix ?? 'arabiyatmart:idem:';

    if (options.client) {
      this.client = options.client;
    } else if (options.url) {
      this.client = new NativeRedisClient(options.url);
    } else {
      throw new Error('RedisIdempotencyStore requires either a redis client or valid url');
    }
  }

  private redisKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  public async get(key: string): Promise<IdempotencyRecord | undefined> {
    const raw = await this.client.get(this.redisKey(key));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as IdempotencyRecord;
    } catch {
      return undefined;
    }
  }

  public async set(key: string, record: IdempotencyRecord): Promise<void> {
    const rKey = this.redisKey(key);
    const ttlMs = record.status === 'COMPLETED'
      ? Math.max(1000, record.expiresAt - Date.now())
      : Math.max(1000, record.lockExpiresAt - Date.now());
    await this.client.set(rKey, JSON.stringify(record), 'PX', ttlMs);
  }

  public async reserve(options: ReserveStoreOptions): Promise<{ reserved: boolean; existing?: IdempotencyRecord | undefined }> {
    const rKey = this.redisKey(options.key);
    const now = Date.now();
    const ownerToken = options.ownerToken ?? crypto.randomUUID();

    const inFlightRecord: InFlightIdempotencyRecord = {
      status: 'IN_FLIGHT',
      key: options.key,
      ownerToken,
      fingerprint: options.fingerprint,
      operation: options.operation,
      idempotencyKey: options.idempotencyKey,
      requestHash: options.requestHash,
      createdAt: now,
      lockExpiresAt: now + options.lockTimeoutMs,
      expiresAt: now + options.lockTimeoutMs,
    };

    const res = await this.client.eval(
      RESERVATION_LUA_SCRIPT,
      1,
      rKey,
      JSON.stringify(inFlightRecord),
      options.lockTimeoutMs
    );

    if (Array.isArray(res)) {
      const [reservedFlag, rawExisting] = res;
      if (reservedFlag === 1) {
        return { reserved: true };
      }
      if (typeof rawExisting === 'string' && rawExisting.length > 0) {
        try {
          const existing = JSON.parse(rawExisting) as IdempotencyRecord;
          return { reserved: false, existing };
        } catch {
          // ignore parse failure
        }
      }
    }

    const fallbackExisting = await this.get(options.key);
    return { reserved: false, existing: fallbackExisting };
  }

  public async finalize(options: FinalizeStoreOptions): Promise<void> {
    const rKey = this.redisKey(options.key);
    const existing = await this.get(options.key);
    if (existing?.status !== 'IN_FLIGHT' || !options.ownerToken || existing.ownerToken !== options.ownerToken) {
      return;
    }
    const now = Date.now();
    const ttlMs = options.ttlMs ?? this.ttlSeconds * 1000;

    const completedRecord: CompletedIdempotencyRecord = {
      status: 'COMPLETED',
      key: options.key,
      fingerprint: existing?.fingerprint ?? '',
      operation: existing?.operation ?? '',
      idempotencyKey: existing?.idempotencyKey ?? '',
      requestHash: existing?.requestHash ?? '',
      response: options.response,
      createdAt: existing?.createdAt ?? now,
      completedAt: now,
      expiresAt: now + ttlMs,
    };

    await this.client.eval(
      FINALIZE_OWNERSHIP_LUA_SCRIPT,
      1,
      rKey,
      options.ownerToken,
      JSON.stringify(completedRecord),
      ttlMs
    );
  }

  public async release(key: string, ownerToken?: string | undefined): Promise<void> {
    if (!ownerToken) return;
    const rKey = this.redisKey(key);
    await this.client.eval(RELEASE_OWNERSHIP_LUA_SCRIPT, 1, rKey, ownerToken);
  }

  public async delete(key: string): Promise<void> {
    await this.client.del(this.redisKey(key));
  }

  public async clear(): Promise<void> {
    if (typeof this.client.clear === 'function') {
      this.client.clear();
    }
  }
}

/**
 * Standard In-Memory Idempotency Store with atomic reservation, lease, and release ownership.
 */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly store = new Map<string, IdempotencyRecord>();

  public get(key: string): IdempotencyRecord | undefined {
    const record = this.store.get(key);
    if (!record) return undefined;
    const now = Date.now();
    if (record.status === 'COMPLETED' && now > record.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    if (record.status === 'IN_FLIGHT' && now > record.lockExpiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return record;
  }

  public set(key: string, record: IdempotencyRecord): void {
    this.store.set(key, record);
  }

  public reserve(options: ReserveStoreOptions): { reserved: boolean; existing?: IdempotencyRecord | undefined } {
    const existing = this.store.get(options.key);
    const now = Date.now();
    if (existing) {
      if (existing.status === 'COMPLETED' && now > existing.expiresAt) {
        this.store.delete(options.key);
      } else if (existing.status === 'IN_FLIGHT' && now > existing.lockExpiresAt) {
        this.store.delete(options.key);
      } else {
        return { reserved: false, existing };
      }
    }

    const inFlightRecord: InFlightIdempotencyRecord = {
      status: 'IN_FLIGHT',
      key: options.key,
      ownerToken: options.ownerToken ?? crypto.randomUUID(),
      fingerprint: options.fingerprint,
      operation: options.operation,
      idempotencyKey: options.idempotencyKey,
      requestHash: options.requestHash,
      createdAt: now,
      lockExpiresAt: now + options.lockTimeoutMs,
      expiresAt: now + options.lockTimeoutMs,
    };
    this.store.set(options.key, inFlightRecord);
    return { reserved: true };
  }

  public finalize(options: FinalizeStoreOptions): void {
    const existing = this.store.get(options.key);
    if (existing?.status !== 'IN_FLIGHT' || !options.ownerToken || existing.ownerToken !== options.ownerToken) {
      return;
    }
    const now = Date.now();
    const completedRecord: CompletedIdempotencyRecord = {
      status: 'COMPLETED',
      key: options.key,
      fingerprint: existing?.fingerprint ?? '',
      operation: existing?.operation ?? '',
      idempotencyKey: existing?.idempotencyKey ?? '',
      requestHash: existing?.requestHash ?? '',
      response: options.response,
      createdAt: existing?.createdAt ?? now,
      completedAt: now,
      expiresAt: now + options.ttlMs,
    };
    this.store.set(options.key, completedRecord);
  }

  public release(key: string, ownerToken?: string | undefined): void {
    const existing = this.store.get(key);
    if (existing && existing.status === 'IN_FLIGHT') {
      if (ownerToken && existing.ownerToken === ownerToken) {
        this.store.delete(key);
      }
    }
  }

  public delete(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }

  public size(): number {
    return this.store.size;
  }
}

// ── Store Selection & Factory ────────────────────────────────────────────────

export interface StoreSelectionEnv {
  NODE_ENV?: string | undefined;
  APP_ENV?: string | undefined;
  IDEMPOTENCY_STORAGE_DRIVER?: 'memory' | 'redis' | undefined;
  REDIS_URL?: string | undefined;
  IDEMPOTENCY_TTL_SECONDS?: number | undefined;
}

/**
 * Resolves the appropriate idempotency store according to environment configuration.
 * Strictly forbids insecure in-memory or temporary local fallback in production.
 */
export function resolveIdempotencyStore(customEnv?: StoreSelectionEnv): IdempotencyStore {
  const env: StoreSelectionEnv = customEnv ?? {
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    IDEMPOTENCY_STORAGE_DRIVER: (process.env.IDEMPOTENCY_STORAGE_DRIVER as 'memory' | 'redis') || serverEnv.IDEMPOTENCY_STORAGE_DRIVER,
    REDIS_URL: process.env.REDIS_URL || serverEnv.REDIS_URL,
    IDEMPOTENCY_TTL_SECONDS: process.env.IDEMPOTENCY_TTL_SECONDS
      ? parseInt(process.env.IDEMPOTENCY_TTL_SECONDS, 10)
      : serverEnv.IDEMPOTENCY_TTL_SECONDS,
  };

  const isProduction =
    env.APP_ENV === 'production' ||
    (env.NODE_ENV === 'production' && env.APP_ENV !== 'development' && env.APP_ENV !== 'test');

  const driver = env.IDEMPOTENCY_STORAGE_DRIVER ?? 'memory';

  if (isProduction) {
    if (driver !== 'redis') {
      throw new UnsafeIdempotencyConfigurationError(
        `[idempotency] Insecure idempotency configuration for production: driver="${driver}". Production strictly requires IDEMPOTENCY_STORAGE_DRIVER=redis to guarantee 24-hour durability across distributed instances without data loss.`
      );
    }
    if (!env.REDIS_URL) {
      throw new UnsafeIdempotencyConfigurationError(
        '[idempotency] Missing REDIS_URL for production idempotency. REDIS_URL is required when IDEMPOTENCY_STORAGE_DRIVER=redis.'
      );
    }
    return new RedisIdempotencyStore({
      url: env.REDIS_URL,
      ttlSeconds: env.IDEMPOTENCY_TTL_SECONDS,
    });
  }

  // Non-production (development, test)
  if (driver === 'redis') {
    if (!env.REDIS_URL) {
      throw new UnsafeIdempotencyConfigurationError(
        '[idempotency] REDIS_URL is required when IDEMPOTENCY_STORAGE_DRIVER=redis.'
      );
    }
    return new RedisIdempotencyStore({
      url: env.REDIS_URL,
      ttlSeconds: env.IDEMPOTENCY_TTL_SECONDS,
    });
  }

  return new MemoryIdempotencyStore();
}

let configuredStore: IdempotencyStore | null = null;

export function getIdempotencyStore(): IdempotencyStore {
  if (!configuredStore) {
    configuredStore = resolveIdempotencyStore();
  }
  return configuredStore;
}

export function setIdempotencyStore(store: IdempotencyStore): void {
  configuredStore = store;
}

export function clearIdempotencyStore(): void {
  const store = getIdempotencyStore();
  store.clear();
}

/**
 * Builds the composite idempotency storage key.
 */
export function buildCompositeIdempotencyKey(
  fingerprint: string,
  operation: string,
  idempotencyKey: string
): string {
  return `${fingerprint.trim()}:${operation.trim()}:${idempotencyKey.trim()}`;
}

/**
 * Generates an anonymous or authenticated user fingerprint.
 */
export function getUserOrAnonymousFingerprint(
  claims: AuthClaims | SessionClaims | { sub?: string; userId?: string; sessionId?: string } | null | undefined,
  headers?: Headers | Record<string, string | string[] | undefined> | null
): string {
  if (claims) {
    const record = claims as Record<string, unknown>;
    const sub = record.sub ?? record.userId ?? record.sessionId;
    if (typeof sub === 'string' && sub.trim().length > 0) {
      return `usr:${sub.trim()}`;
    }
  }

  let ip = 'unknown-ip';
  let ua = 'unknown-ua';

  if (headers instanceof Headers) {
    const forwarded = headers.get('x-forwarded-for');
    ip = (forwarded ? forwarded.split(',')[0]?.trim() : null) ??
      headers.get('x-real-ip') ??
      headers.get('cf-connecting-ip') ??
      'unknown-ip';
    ua = headers.get('user-agent') ?? 'unknown-ua';
  } else if (headers && typeof headers === 'object') {
    const headerRecord = headers as Record<string, string | string[] | undefined>;
    const rawFwd = headerRecord['x-forwarded-for'];
    const forwarded = typeof rawFwd === 'string' ? rawFwd : Array.isArray(rawFwd) ? rawFwd[0] : null;
    const rawIp = headerRecord['x-real-ip'];
    const realIp = typeof rawIp === 'string' ? rawIp : Array.isArray(rawIp) ? rawIp[0] : null;
    ip = (forwarded ? forwarded.split(',')[0]?.trim() : null) ?? realIp ?? 'unknown-ip';
    const rawUa = headerRecord['user-agent'];
    ua = (typeof rawUa === 'string' ? rawUa : Array.isArray(rawUa) ? rawUa[0] : null) ?? 'unknown-ua';
  }

  const hash = crypto
    .createHash('sha256')
    .update(`${ip}|${ua}`)
    .digest('hex')
    .slice(0, 32);

  return `anon:${hash}`;
}

/**
 * Recursively serializes any value into a canonical, deterministic JSON string
 * with sorted object keys.
 */
function canonicalizeJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalizeJson(v)}`)
    .join(',')}}`;
}

/**
 * Computes a deterministic SHA-256 hash of the canonical request.
 */
export function computeCanonicalRequestHash(
  method: string,
  pathname: string,
  query?: Record<string, unknown> | null,
  body?: unknown
): string {
  const normMethod = method.toUpperCase().trim();
  const normPath = pathname.trim().toLowerCase();

  let queryStr = '';
  if (query && Object.keys(query).length > 0) {
    const sortedParams = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : String(v))}`)
      .join('&');
    queryStr = sortedParams;
  }

  let bodyStr = '';
  if (body !== undefined && body !== null) {
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        bodyStr = canonicalizeJson(parsed);
      } catch {
        bodyStr = body.trim();
      }
    } else {
      bodyStr = canonicalizeJson(body);
    }
  }

  const raw = `${normMethod}\n${normPath}\n${queryStr}\n${bodyStr}`;
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function waitForCompletionOrTick(key: string, maxWaitMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let timer: NodeJS.Timeout | null = null;

    const onDone = () => {
      if (timer) clearTimeout(timer);
      completionEmitter.removeListener(`completed:${key}`, onDone);
      completionEmitter.removeListener(`released:${key}`, onDone);
      resolve();
    };

    completionEmitter.once(`completed:${key}`, onDone);
    completionEmitter.once(`released:${key}`, onDone);

    timer = setTimeout(onDone, maxWaitMs);
  });
}

export type ReserveIdempotencyResult =
  | { action: 'execute'; key: string; ownerToken: string }
  | { action: 'replay'; response: IdempotentResponse; record: CompletedIdempotencyRecord }
  | { action: 'conflict'; error: OperationError };

/**
 * Atomically reserves an idempotency key before upstream execution.
 */
export async function reserveIdempotency(options: {
  fingerprint: string;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  requestId: string;
  lockTimeoutMs?: number | undefined;
  waitTimeoutMs?: number | undefined;
  pollIntervalMs?: number | undefined;
  store?: IdempotencyStore | undefined;
}): Promise<ReserveIdempotencyResult> {
  const { fingerprint, operation, idempotencyKey, requestHash, requestId } = options;
  const store = options.store ?? getIdempotencyStore();
  const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  const waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const compositeKey = buildCompositeIdempotencyKey(fingerprint, operation, idempotencyKey);
  const ownerToken = crypto.randomUUID();
  const startTime = Date.now();

  while (Date.now() - startTime < waitTimeoutMs) {
    const reserveResult = await store.reserve({
      key: compositeKey,
      ownerToken,
      fingerprint,
      operation,
      idempotencyKey,
      requestHash,
      lockTimeoutMs,
    });

    if (reserveResult.reserved) {
      return { action: 'execute', key: compositeKey, ownerToken };
    }

    const existing = reserveResult.existing ?? (await store.get(compositeKey));

    if (!existing) {
      continue;
    }

    // Immediate 409 Conflict if payload differs (even while in flight)
    if (existing.requestHash !== requestHash) {
      const conflictError = createOperationError({
        status: 409,
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Idempotency key reused with different request payload',
        requestId,
        details: {
          operation,
          idempotencyKey,
        },
      });

      return {
        action: 'conflict',
        error: conflictError,
      };
    }

    // Replay completed response
    if (existing.status === 'COMPLETED') {
      return {
        action: 'replay',
        response: existing.response,
        record: existing,
      };
    }

    // In-flight: check if lock lease expired
    if (Date.now() > existing.lockExpiresAt) {
      await store.delete(compositeKey);
      continue;
    }

    // Wait for in-process event notification or cross-process poll interval
    await waitForCompletionOrTick(compositeKey, pollIntervalMs);
  }

  throw createOperationError({
    status: 504,
    code: 'GATEWAY_TIMEOUT',
    message: 'Timed out waiting for concurrent idempotent operation to complete',
    requestId,
  });
}

/**
 * Finalizes an in-flight reservation with its authoritative response for 24 hours.
 */
export async function finalizeIdempotency(options: {
  key: string;
  ownerToken?: string | undefined;
  response: IdempotentResponse;
  ttlMs?: number | undefined;
  store?: IdempotencyStore | undefined;
}): Promise<void> {
  const store = options.store ?? getIdempotencyStore();
  const ttlMs = options.ttlMs ?? IDEMPOTENCY_TTL_MS;

  await store.finalize({
    key: options.key,
    ownerToken: options.ownerToken,
    response: options.response,
    ttlMs,
  });

  completionEmitter.emit(`completed:${options.key}`);
}

/**
 * Safely releases an in-flight reservation on upstream failure with ownership verification.
 */
export async function releaseIdempotency(options: {
  key: string;
  ownerToken?: string | undefined;
  store?: IdempotencyStore | undefined;
}): Promise<void> {
  const store = options.store ?? getIdempotencyStore();
  await store.release(options.key, options.ownerToken);

  completionEmitter.emit(`released:${options.key}`);
}

export type IdempotencyCheckResult =
  | { action: 'execute' }
  | { action: 'replay'; response: IdempotentResponse; record: CompletedIdempotencyRecord }
  | { action: 'conflict'; error: OperationError };

/**
 * Legacy checkIdempotency helper for backwards compatibility.
 */
export async function checkIdempotency(options: {
  fingerprint: string;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  requestId: string;
  store?: IdempotencyStore | undefined;
}): Promise<IdempotencyCheckResult> {
  const { fingerprint, operation, idempotencyKey, requestHash, requestId } = options;
  const store = options.store ?? getIdempotencyStore();

  const compositeKey = buildCompositeIdempotencyKey(fingerprint, operation, idempotencyKey);
  const existing = await store.get(compositeKey);

  if (!existing) {
    return { action: 'execute' };
  }

  if (existing.requestHash === requestHash) {
    if (existing.status === 'COMPLETED') {
      return {
        action: 'replay',
        response: existing.response,
        record: existing,
      };
    }
    return { action: 'execute' };
  }

  const conflictError = createOperationError({
    status: 409,
    code: 'IDEMPOTENCY_CONFLICT',
    message: 'Idempotency key reused with different request payload',
    requestId,
    details: {
      operation,
      idempotencyKey,
    },
  });

  return {
    action: 'conflict',
    error: conflictError,
  };
}

/**
 * Legacy recordIdempotentResponse helper for backwards compatibility.
 */
export async function recordIdempotentResponse(options: {
  fingerprint: string;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  response: IdempotentResponse;
  ttlMs?: number | undefined;
  store?: IdempotencyStore | undefined;
}): Promise<void> {
  const { fingerprint, operation, idempotencyKey, response } = options;
  const compositeKey = buildCompositeIdempotencyKey(fingerprint, operation, idempotencyKey);
  await finalizeIdempotency({
    key: compositeKey,
    response,
    ttlMs: options.ttlMs,
    store: options.store,
  });
}
