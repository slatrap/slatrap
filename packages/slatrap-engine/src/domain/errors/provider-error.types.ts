export type MetadataContext = {
  userId?: string;
  itemId?: string;
  institutionId?: string;
  institutionName?: string;
};

export type MetadataBuilder = (ctx: MetadataContext) => MetadataContext;

export type CapturedProviderError = {
  normalizedProvider?: string;
  errorCode?: string;
  errorType?: string;
  errorMessage?: string;
  requestId?: string;
  endpoint?: string;
  statusCode?: number;
  metadata: MetadataContext;
};

export type FintechErrorContext = {
  provider?: string;
  payload: unknown;
  errorCode?: string;
  errorType?: string;
  errorMessage?: string;
  requestId?: string;
  userId?: string;
  institutionId?: string;
  itemId?: string;
  institutionName?: string;
};
