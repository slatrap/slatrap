import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type LatencyObservationInput = {
  provider: string;
  endpoint?: string;
  latencyMs: number;
  success: boolean;
  statusCode?: number | null;
  metadata?: Record<string, unknown>;
};

function toJsonObject(
  metadata: Record<string, unknown> | undefined,
): Prisma.InputJsonObject | undefined {
  if (!metadata) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as Prisma.InputJsonObject;
}

@Injectable()
export class LatencyTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async recordObservation(
    input: LatencyObservationInput,
  ): Promise<{ id: number } | null> {
    if (!this.prisma.isEnabled) {
      return null;
    }

    return this.prisma.createLatencyObservation({
      provider: input.provider.toUpperCase(),
      endpoint: input.endpoint,
      latencyMs: input.latencyMs,
      success: input.success,
      statusCode: input.statusCode ?? undefined,
      metadata: toJsonObject(input.metadata),
    });
  }
}
