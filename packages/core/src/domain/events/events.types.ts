export type ProviderErrorInspectionEvent = {
  provider: string;
  endpoint?: string;
  statusCode?: number;
  providerPayload: unknown;
  latency?: number;
};

export type PlaidItemCreatedEvent = {
  itemId?: string;
  institutionId?: string;
  institutionName?: string;
};
