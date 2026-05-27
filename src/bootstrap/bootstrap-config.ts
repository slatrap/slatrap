export type AppProfile = 'production' | 'simulation';

export type BootstrapConfig = {
  profile: AppProfile;
  nodeEnv: string;
};

function resolveAppProfile(env: NodeJS.ProcessEnv): AppProfile {
  const profile = (env.APP_PROFILE ?? 'production').toLowerCase();

  if (profile === 'production' || profile === 'simulation') {
    return profile;
  }

  throw new Error(
    `Invalid APP_PROFILE value "${profile}". Expected "production" or "simulation".`,
  );
}

export function resolveBootstrapConfig(
  env: NodeJS.ProcessEnv,
): BootstrapConfig {
  const profile = resolveAppProfile(env);
  const nodeEnv = (env.NODE_ENV ?? 'development').toLowerCase();

  if (nodeEnv === 'production' && profile === 'simulation') {
    throw new Error(
      'Refusing to start with APP_PROFILE=simulation when NODE_ENV=production.',
    );
  }

  return { profile, nodeEnv };
}
