import { Injectable } from '@nestjs/common';
import { type SlatrapProviderLatencyEvent } from '@slatrap/slatrap';
import { PrismaService } from '../../database/prisma.service';
import { toPrismaJsonObject } from '../../database/prisma-json';

@Injectable()
export class LatencyTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async recordObservation(
    input: SlatrapProviderLatencyEvent,
  ): Promise<{ id: number } | null> {
    if (!this.prisma.isEnabled) {
      return null;
    }

    return this.prisma.createLatencyObservation({
      provider: input.provider.toUpperCase(),
      endpoint: input.endpoint,
      latencyMs: input.latency,
      success: input.success,
      statusCode: input.statusCode ?? undefined,
      metadata: toPrismaJsonObject(input.metadata),
    });
  }
}
