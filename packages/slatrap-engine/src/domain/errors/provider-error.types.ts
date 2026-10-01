export type FintechErrorContext = {
  provider?: string;
  payload: unknown;
  errorCode?: string;
  errorType?: string;
  errorMessage?: string;
  requestId?: string;
  userId?: string;
  itemId?: string;
  institutionId?: string;
  institutionName?: string;
};

/** Provider-scoped fields from {@link FintechErrorContext} attached to incidents. */
export type ProviderErrorMetadata = Pick<
  FintechErrorContext,
  'userId' | 'itemId' | 'institutionId' | 'institutionName'
>;

export type MetadataBuilder = (
  ctx: ProviderErrorMetadata,
) => ProviderErrorMetadata;

export type CapturedProviderError = {
  normalizedProvider?: string;
  errorCode?: string;
  errorType?: string;
  errorMessage?: string;
  requestId?: string;
  endpoint?: string;
  statusCode?: number;
  metadata: ProviderErrorMetadata;
};
