import type { RedisClient } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ErrorDeduplicationService } from './error-deduplication.service';

describe('ErrorDeduplicationService', () => {
  const errorFingerprint = {
    provider: 'plaid',
    errorCode: 'ITEM_LOGIN_REQUIRED',
    errorType: 'ITEM_ERROR',
    errorMessage: 'Re-auth required',
    requestId: 'req_abc123',
    statusCode: 401,
    endpoint: '/plaid/transactions/get',
    latency: 42,
    metadata: {
      itemId: 'item_001',
      institutionId: 'ins_109508',
      institutionName: 'First Platypus Bank',
    },
  };

  const createMocks = (dedupWindow?: string) => {
    const redis = {
      get: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
    };

    const prisma = {
      isEnabled: true,
      db: {
        externalError: {
          update: jest.fn().mockResolvedValue(undefined),
          create: jest.fn(),
        },
      },
    };

    const configService = {
      get: jest.fn().mockReturnValue(dedupWindow),
    } as unknown as ConfigService;

    const service = new ErrorDeduplicationService(
      redis as unknown as RedisClient,
      prisma as unknown as PrismaService,
      configService,
    );

    return { service, redis, prisma, configService };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a DB record and caches first occurrence when key is not found', async () => {
    const { service, redis, prisma } = createMocks('300');
    redis.get.mockResolvedValue(null);
    prisma.db.externalError.create.mockResolvedValue({ id: 123 });

    const result = await service.checkAndRegisterError(errorFingerprint);

    expect(redis.get).toHaveBeenCalledWith(
      'error:plaid:ITEM_LOGIN_REQUIRED:/plaid/transactions/get:401',
    );
    expect(prisma.db.externalError.create).toHaveBeenCalledWith({
      data: {
        provider: errorFingerprint.provider.toUpperCase(),
        errorCode: errorFingerprint.errorCode,
        errorType: errorFingerprint.errorType,
        errorMessage: errorFingerprint.errorMessage,
        requestId: errorFingerprint.requestId,
        statusCode: errorFingerprint.statusCode,
        endpoint: errorFingerprint.endpoint,
        latency: errorFingerprint.latency,
        count: 1,
        metadata: errorFingerprint.metadata,
      },
    });
    expect(prisma.db.externalError.update).not.toHaveBeenCalled();

    expect(redis.setex).toHaveBeenCalledTimes(1);
    const [setexKey, setexTtl, setexPayload] = redis.setex.mock.calls[0] as [
      string,
      string | number,
      string,
    ];
    expect(setexKey).toBe(
      'error:plaid:ITEM_LOGIN_REQUIRED:/plaid/transactions/get:401',
    );
    expect(setexTtl).toBe('300');

    const parsedPayload = JSON.parse(setexPayload) as Record<string, unknown>;
    expect(parsedPayload).toEqual(
      expect.objectContaining({
        id: 123,
        count: 1,
        firstSeenAt: expect.any(String) as unknown,
        lastSeenAt: expect.any(String) as unknown,
      }),
    );

    expect(result).toEqual({ isDuplicate: false, id: 123 });
  });

  it('increments count and refreshes cache when duplicate key is found', async () => {
    const { service, redis, prisma } = createMocks('600');
    redis.get.mockResolvedValue(
      JSON.stringify({
        id: 555,
        count: 3,
        firstSeenAt: '2026-05-19T12:00:00.000Z',
        lastSeenAt: '2026-05-19T12:01:00.000Z',
      }),
    );

    const result = await service.checkAndRegisterError(errorFingerprint);

    expect(prisma.db.externalError.update).toHaveBeenCalledWith({
      where: { id: 555 },
      data: { count: { increment: 1 } },
    });
    expect(prisma.db.externalError.create).not.toHaveBeenCalled();

    expect(redis.setex).toHaveBeenCalledTimes(1);
    const [setexKey, setexTtl, setexPayload] = redis.setex.mock.calls[0] as [
      string,
      string | number,
      string,
    ];
    expect(setexKey).toBe(
      'error:plaid:ITEM_LOGIN_REQUIRED:/plaid/transactions/get:401',
    );
    expect(setexTtl).toBe('600');

    const parsedPayload = JSON.parse(setexPayload) as Record<string, unknown>;
    expect(parsedPayload).toEqual(
      expect.objectContaining({
        id: 555,
        count: 4,
        firstSeenAt: '2026-05-19T12:00:00.000Z',
        lastSeenAt: expect.any(String) as unknown,
      }),
    );

    expect(result).toEqual({ isDuplicate: true, id: 555 });
  });

  it('backfills a DB row with total count when Redis had id 0 and DB is enabled', async () => {
    const { service, redis, prisma } = createMocks('300');
    redis.get.mockResolvedValue(
      JSON.stringify({
        id: 0,
        count: 1,
        firstSeenAt: '2026-05-19T12:00:00.000Z',
      }),
    );
    prisma.db.externalError.create.mockResolvedValue({ id: 77 });

    const result = await service.checkAndRegisterError(errorFingerprint);

    expect(prisma.db.externalError.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        count: 2,
      }),
    });
    expect(prisma.db.externalError.update).not.toHaveBeenCalled();
    expect(result).toEqual({ isDuplicate: true, id: 77 });

    const [, , setexPayload] = redis.setex.mock.calls[0] as [
      string,
      string | number,
      string,
    ];
    const parsedPayload = JSON.parse(setexPayload) as Record<string, unknown>;
    expect(parsedPayload).toEqual(
      expect.objectContaining({
        id: 77,
        count: 2,
      }),
    );
  });

  it('skips database writes when persistence is disabled', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    };

    const prisma = {
      isEnabled: false,
      db: {
        externalError: {
          update: jest.fn(),
          create: jest.fn(),
        },
      },
    };

    const configService = {
      get: jest.fn().mockReturnValue('300'),
    } as unknown as ConfigService;

    const service = new ErrorDeduplicationService(
      redis as unknown as RedisClient,
      prisma as unknown as PrismaService,
      configService,
    );

    const result = await service.checkAndRegisterError(errorFingerprint);

    expect(prisma.db.externalError.create).not.toHaveBeenCalled();
    expect(prisma.db.externalError.update).not.toHaveBeenCalled();
    expect(result).toEqual({ isDuplicate: false, id: 0 });
    expect(redis.setex).toHaveBeenCalledTimes(1);
  });

  it('uses 300 seconds as default TTL when config is missing', async () => {
    const { service, redis, prisma } = createMocks(undefined);
    redis.get.mockResolvedValue(null);
    prisma.db.externalError.create.mockResolvedValue({ id: 999 });

    await service.checkAndRegisterError(errorFingerprint);

    expect(redis.setex).toHaveBeenCalledTimes(1);
    const [, setexTtl] = redis.setex.mock.calls[0] as [string, string | number];
    expect(setexTtl).toBe(300);
  });
});
