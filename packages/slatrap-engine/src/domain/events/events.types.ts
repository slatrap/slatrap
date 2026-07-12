export type ProviderErrorInspectionEvent = {
  provider: string;
  endpoint?: string;
  statusCode?: number;
  providerPayload: unknown;
  latency?: number;
};

export type ProviderLatencyInspectionEvent = {
  provider: string;
  endpoint?: string;
  latency: number;
  success: boolean;
  statusCode?: number | null;
  metadata?: Record<string, unknown>;
};

export type PlaidItemCreatedEvent = {
  itemId?: string;
  institutionId?: string;
  institutionName?: string;
};
