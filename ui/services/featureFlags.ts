export type FeatureFlags = {
  careerOSExperience: boolean;
  careerOSNavigation: boolean;
};

export const FEATURE_FLAG_ENV_KEYS = {
  careerOSExperience: 'VITE_FEATURE_CAREER_OS_EXPERIENCE',
  careerOSNavigation: 'VITE_FEATURE_CAREER_OS_NAVIGATION',
} as const;

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled']);

export function readBooleanFeatureFlag(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) return true;
    if (FALSE_VALUES.has(normalized)) return false;
  }

  return fallback;
}

export function getFeatureFlags(
  env: Record<string, unknown> = (import.meta as any).env ?? {},
): FeatureFlags {
  const careerOSExperience = readBooleanFeatureFlag(
    env[FEATURE_FLAG_ENV_KEYS.careerOSExperience],
    false,
  );

  return {
    careerOSExperience,
    careerOSNavigation: careerOSExperience && readBooleanFeatureFlag(
      env[FEATURE_FLAG_ENV_KEYS.careerOSNavigation],
      true,
    ),
  };
}

export const featureFlags = getFeatureFlags();
