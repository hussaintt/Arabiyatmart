import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET } from '@/app/api/ready/route';
import {
  setIdempotencyStore,
  MemoryIdempotencyStore,
  RedisIdempotencyStore,
  MockRedisClient,
} from '@/lib/security/idempotency';

describe('Readiness Probe API (/api/ready)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 ready when memory store probe succeeds in non-production', async () => {
    const memoryStore = new MemoryIdempotencyStore();
    setIdempotencyStore(memoryStore);

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ready');
    expect(data.ready).toBe(true);
    expect(data.driver).toBe('memory');
  });

  it('returns 200 ready when Redis store probe succeeds', async () => {
    const redisClient = new MockRedisClient();
    const redisStore = new RedisIdempotencyStore({ client: redisClient });
    setIdempotencyStore(redisStore);

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ready');
    expect(data.ready).toBe(true);
    expect(data.driver).toBe('redis');
  });

  it('returns 503 degraded when Redis store reservation fails or throws', async () => {
    const failingClient = new MockRedisClient();
    vi.spyOn(failingClient, 'eval').mockRejectedValue(new Error('Connection refused to redis:6379'));

    const redisStore = new RedisIdempotencyStore({ client: failingClient });
    setIdempotencyStore(redisStore);

    const response = await GET();
    expect(response.status).toBe(503);

    const data = await response.json();
    expect(data.status).toBe('degraded');
    expect(data.ready).toBe(false);
    expect(data.error).toContain('Connection refused to redis:6379');
  });
});
