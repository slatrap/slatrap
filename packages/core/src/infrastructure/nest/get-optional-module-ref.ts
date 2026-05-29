import { type ModuleRef } from '@nestjs/core';

/**
 * Nest `ModuleRef.get(..., { strict: false })` still throws when the token is
 * missing. Use this for optional providers (e.g. Bull queue when loaded lazily).
 */
export function getOptionalModuleRef<T>(
  moduleRef: ModuleRef,
  token: string | symbol | (new (...args: unknown[]) => unknown),
): T | undefined {
  try {
    return moduleRef.get<T>(token, { strict: false });
  } catch {
    return undefined;
  }
}
