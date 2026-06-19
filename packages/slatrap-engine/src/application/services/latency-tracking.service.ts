import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toPrismaJsonObject } from '../../database/prisma-json';

export type LatencyObservationInput = {
  provider: string;
  endpoint?: string;
  latencyMs: number;
  success: boolean;
  statusCode?: number | null;
  metadata?: Record<string, unknown>;
};

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
      metadata: toPrismaJsonObject(input.metadata),
    });
  }
}
