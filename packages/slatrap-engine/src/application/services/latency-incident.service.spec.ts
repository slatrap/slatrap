import { PrismaService } from '../../database/prisma.service';
import { LatencyIncidentService } from './latency-incident.service';
import { type DedupStore } from '../../infrastructure/redis/dedup-store';
import { type InspectorCoreModuleOptions } from '../../config/inspector-core.options';

describe('LatencyIncidentService', () => {
  const incidentInput = {
    provider: 'plaid',
    endpoint: '/plaid/slow-response',
    latency: 2_500,
    thresholdMs: 2_000,
    success: true,
    statusCode: 200,
    metadata: { simulatedDelayMs: 2_500 },
  };

  const createMocks = (windowSeconds = 300) => {
    const dedupStore = {
      get: jest.fn(),
      setex: jest.fn().mockResolvedValue(undefined),
    };

    const prisma = {
      isEnabled: true,
      findRecentLatencyIncident: jest.fn().mockResolvedValue(null),
      incrementLatencyIncident: jest.fn().mockResolvedValue(undefined),
      createLatencyIncident: jest.fn(),
    };

    const options: InspectorCoreModuleOptions = {
      errorDedupWindowSeconds: windowSeconds,
      latencyIncidentWindowSeconds: windowSeconds,
    };

    const service = new LatencyIncidentService(
      dedupStore as unknown as DedupStore,
      prisma as unknown as PrismaService,
      options,
    );

    return { service, dedupStore, prisma, options };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('ignores observations below the threshold', async () => {
    const { service, dedupStore, prisma } = createMocks();

    const result = await service.checkAndRegisterIncident({
      ...incidentInput,
      latency: 1_500,
    });

    expect(result).toEqual({ isIncident: false, isDuplicate: false });
    expect(dedupStore.get).not.toHaveBeenCalled();
    expect(prisma.createLatencyIncident).not.toHaveBeenCalled();
  });

  it('creates an incident and caches first spike occurrence', async () => {
    const { service, dedupStore, prisma } = createMocks();
    dedupStore.get.mockResolvedValue(null);
    prisma.createLatencyIncident.mockResolvedValue({ id: 42 });

    const result = await service.checkAndRegisterIncident(incidentInput);

    expect(result).toEqual({
      isIncident: true,
      isDuplicate: false,
      id: 42,
      count: 1,
    });
    expect(dedupStore.get).toHaveBeenCalledWith(
      'latency:plaid:/plaid/slow-response:2000',
    );
    expect(prisma.createLatencyIncident).toHaveBeenCalledWith({
      provider: 'PLAID',
      endpoint: '/plaid/slow-response',
      thresholdMs: 2_000,
      observedMs: 2_500,
      maxLatencyMs: 2_500,
      count: 1,
      metadata: {
        success: true,
        statusCode: 200,
        simulatedDelayMs: 2_500,
      },
    });
  });

  it('groups repeated spikes within the incident window', async () => {
    const { service, dedupStore, prisma } = createMocks();
    dedupStore.get.mockResolvedValue(
      JSON.stringify({
        id: 42,
        count: 2,
        maxLatencyMs: 2_500,
        firstSeenAt: new Date().toISOString(),
      }),
    );

    const result = await service.checkAndRegisterIncident({
      ...incidentInput,
      latency: 3_100,
    });

    expect(result).toEqual({
      isIncident: true,
      isDuplicate: true,
      id: 42,
      count: 3,
    });
    expect(prisma.incrementLatencyIncident).toHaveBeenCalledWith(42, {
      count: { increment: 1 },
      maxLatencyMs: 3_100,
      observedMs: 3_100,
    });
  });
});
