import { PrismaService } from '../../database/prisma.service';
import { ErrorIncidentService } from './error-incident.service';
import { type DedupStore } from '../../infrastructure/redis/dedup-store';
import { type InspectorCoreModuleOptions } from '../../config/inspector-core.options';
import { type ErrorIncidentSummary } from '../../domain/incidents/incident.types';
import { buildErrorIncidentFingerprint } from '../../domain/incidents/incident-fingerprint';

describe('ErrorIncidentService', () => {
  const incidentSummary: ErrorIncidentSummary = {
    provider: 'plaid',
    errorCode: 'ITEM_LOGIN_REQUIRED',
    errorType: 'ITEM_ERROR',
    errorMessage: 'Re-auth required',
    endpoint: '/plaid/transactions/get',
    statusCode: 401,
    severity: 'medium',
    requestId: 'req_abc123',
    latency: 42,
    metadata: {
      itemId: 'item_001',
      institutionId: 'ins_109508',
      institutionName: 'First Platypus Bank',
    },
    fingerprint: buildErrorIncidentFingerprint({
      provider: 'plaid',
      errorCode: 'ITEM_LOGIN_REQUIRED',
      errorType: 'ITEM_ERROR',
      endpoint: '/plaid/transactions/get',
      environment: 'simulation',
    }),
  };

  const createMocks = (
    options: InspectorCoreModuleOptions = { errorDedupWindowSeconds: 300 },
  ) => {
    const dedupStore = {
      get: jest.fn(),
      setex: jest.fn().mockResolvedValue(undefined),
    };

    const prisma = {
      isEnabled: true,
      findRecentExternalError: jest.fn().mockResolvedValue(null),
      countPriorExternalErrorIncidents: jest.fn().mockResolvedValue(0),
      incrementExternalError: jest.fn().mockResolvedValue(undefined),
      createExternalError: jest.fn(),
    };

    const service = new ErrorIncidentService(
      dedupStore as unknown as DedupStore,
      prisma as unknown as PrismaService,
      options,
    );

    return { service, dedupStore, prisma, options };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a DB record and caches first occurrence when key is not found', async () => {
    const { service, dedupStore, prisma } = createMocks({ errorDedupWindowSeconds: 300 });
    dedupStore.get.mockResolvedValue(null);
    prisma.createExternalError.mockResolvedValue({ id: 123 });

    const result = await service.checkAndRegisterIncident(incidentSummary);

    expect(dedupStore.get).toHaveBeenCalledWith(
      'error:plaid:ITEM_LOGIN_REQUIRED:ITEM_ERROR:/plaid/transactions/get:401',
    );
    expect(prisma.countPriorExternalErrorIncidents).toHaveBeenCalled();
    expect(prisma.createExternalError).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'PLAID',
        errorCode: 'ITEM_LOGIN_REQUIRED',
        errorType: 'ITEM_ERROR',
        errorMessage: 'Re-auth required',
        requestId: 'req_abc123',
        statusCode: 401,
        endpoint: '/plaid/transactions/get',
        latency: 42,
        severity: 'medium',
        count: 1,
        metadata: incidentSummary.metadata,
        timestamp: expect.any(Date),
        lastSeenAt: expect.any(Date),
      }),
    );
    expect(prisma.incrementExternalError).not.toHaveBeenCalled();

    expect(result).toEqual({
      isDuplicate: false,
      id: 123,
      count: 1,
      severity: 'medium',
    });
  });

  it('increments existing DB row when cache is empty but a recent match exists', async () => {
    const { service, dedupStore, prisma } = createMocks({ errorDedupWindowSeconds: 300 });
    dedupStore.get.mockResolvedValue(null);
    prisma.findRecentExternalError.mockResolvedValue({
      id: 42,
      count: 5,
      timestamp: new Date('2026-05-29T12:00:00.000Z'),
      severity: 'medium',
    });

    const result = await service.checkAndRegisterIncident(incidentSummary);

    expect(prisma.findRecentExternalError).toHaveBeenCalled();
    expect(prisma.incrementExternalError).toHaveBeenCalledWith(42, {
      count: { increment: 1 },
      lastSeenAt: expect.any(Date),
      severity: 'medium',
      errorMessage: 'Re-auth required',
      requestId: 'req_abc123',
      latency: 42,
    });
    expect(prisma.createExternalError).not.toHaveBeenCalled();
    expect(result).toEqual({
      isDuplicate: true,
      id: 42,
      count: 6,
      severity: 'medium',
      previousSeverity: 'medium',
    });
  });

  it('escalates severity when volume crosses the high threshold', async () => {
    const { service, dedupStore, prisma } = createMocks({ errorDedupWindowSeconds: 300 });
    dedupStore.get.mockResolvedValue(
      JSON.stringify({
        id: 555,
        count: 49,
        severity: 'medium',
        firstSeenAt: '2026-05-19T12:00:00.000Z',
        priorIncidentCount: 0,
      }),
    );

    const result = await service.checkAndRegisterIncident({
      ...incidentSummary,
      severity: 'low',
    });

    expect(prisma.incrementExternalError).toHaveBeenCalledWith(
      555,
      expect.objectContaining({ severity: 'high' }),
    );
    expect(result.severity).toBe('high');
    expect(result.previousSeverity).toBe('medium');
  });

  it('escalates severity for recurring incidents', async () => {
    const { service, dedupStore, prisma } = createMocks({ errorDedupWindowSeconds: 300 });
    dedupStore.get.mockResolvedValue(null);
    prisma.countPriorExternalErrorIncidents.mockResolvedValue(2);
    prisma.createExternalError.mockResolvedValue({ id: 77 });

    const result = await service.checkAndRegisterIncident({
      ...incidentSummary,
      severity: 'low',
    });

    expect(result).toEqual({
      isDuplicate: false,
      id: 77,
      count: 1,
      severity: 'medium',
    });
  });

  it('uses configurable severity thresholds from module options', async () => {
    const { service, dedupStore, prisma } = createMocks({
      errorDedupWindowSeconds: 300,
      errorSeverityThresholds: { countElevated: 5 },
    });
    dedupStore.get.mockResolvedValue(
      JSON.stringify({
        id: 777,
        count: 4,
        severity: 'low',
        firstSeenAt: '2026-05-19T12:00:00.000Z',
        priorIncidentCount: 0,
      }),
    );

    const result = await service.checkAndRegisterIncident({
      ...incidentSummary,
      severity: 'low',
    });

    expect(prisma.incrementExternalError).toHaveBeenCalledWith(
      777,
      expect.objectContaining({ severity: 'high' }),
    );
    expect(result.severity).toBe('high');
  });

  it('skips database writes when persistence is disabled', async () => {
    const dedupStore = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue(undefined),
    };

    const prisma = {
      isEnabled: false,
      findRecentExternalError: jest.fn(),
      countPriorExternalErrorIncidents: jest.fn(),
      incrementExternalError: jest.fn(),
      createExternalError: jest.fn(),
    };

    const service = new ErrorIncidentService(
      dedupStore as unknown as DedupStore,
      prisma as unknown as PrismaService,
      { errorDedupWindowSeconds: 300 },
    );

    const result = await service.checkAndRegisterIncident(incidentSummary);

    expect(prisma.createExternalError).not.toHaveBeenCalled();
    expect(prisma.incrementExternalError).not.toHaveBeenCalled();
    expect(result).toEqual({
      isDuplicate: false,
      id: 0,
      count: 1,
      severity: 'medium',
    });
  });
});
