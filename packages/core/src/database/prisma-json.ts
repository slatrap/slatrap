import { Prisma } from '@prisma/client';

export function toPrismaJsonObject(
  metadata: Record<string, unknown> | undefined,
): Prisma.InputJsonObject | undefined {
  if (!metadata) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as Prisma.InputJsonObject;
}
