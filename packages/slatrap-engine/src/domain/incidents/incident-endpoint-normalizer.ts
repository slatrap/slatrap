const ID_SEGMENT_PATTERNS = [
  // Stripe object IDs, e.g. cus_123, pi_abc, ch_xyz.
  /^(cus|pi|ch|acct|in|sub)_[a-z0-9]+$/i,
  /^\d{4,}$/,
  /^[0-9a-f]{16,}$/i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
];

export function normalizeEndpointForFingerprint(endpoint: string): string {
  const path = endpoint.split(/[?#]/, 1)[0];

  return path
    .split('/')
    .map((segment) =>
      ID_SEGMENT_PATTERNS.some((pattern) => pattern.test(segment)) ? ':id' : segment,
    )
    .join('/');
}
