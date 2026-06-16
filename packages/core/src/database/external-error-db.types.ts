import { type Prisma } from '@prisma/client';

export type RecentExternalErrorRow = {
  id: number;
  count: number;
  timestamp: Date;
  severity: string;
};

export type ExternalErrorCreateData = {
  provider: string;
  errorCode?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  requestId?: string | null;
  statusCode?: number | null;
  endpoint?: string | null;
  latency: number;
  severity: string;
  count: number;
  timestamp: Date;
  lastSeenAt: Date;
  metadata?: Prisma.InputJsonObject;
};

export type ExternalErrorUpdateData = {
  count?: { increment: number };
  lastSeenAt?: Date;
  severity?: string;
  errorMessage?: string;
  requestId?: string | null;
  latency?: number;
};
