import { describe, expect, it } from 'vitest';
import { FEATURE_FLAG_ENV_KEYS, getFeatureFlags, readBooleanFeatureFlag } from './featureFlags';

describe('feature flags', () => {
  it('parses common enabled and disabled values', () => {
    expect(readBooleanFeatureFlag('true')).toBe(true);
    expect(readBooleanFeatureFlag('1')).toBe(true);
    expect(readBooleanFeatureFlag('enabled')).toBe(true);
    expect(readBooleanFeatureFlag('false')).toBe(false);
    expect(readBooleanFeatureFlag('0')).toBe(false);
    expect(readBooleanFeatureFlag('disabled')).toBe(false);
  });

  it('keeps Career OS disabled by default', () => {
    expect(getFeatureFlags({})).toEqual({
      careerOSExperience: false,
      careerOSNavigation: false,
    });
  });

  it('enables Career OS navigation when the parent experience flag is on', () => {
    expect(getFeatureFlags({
      [FEATURE_FLAG_ENV_KEYS.careerOSExperience]: 'true',
    })).toEqual({
      careerOSExperience: true,
      careerOSNavigation: true,
    });
  });

  it('allows Career OS navigation to roll out separately', () => {
    expect(getFeatureFlags({
      [FEATURE_FLAG_ENV_KEYS.careerOSExperience]: 'true',
      [FEATURE_FLAG_ENV_KEYS.careerOSNavigation]: 'false',
    })).toEqual({
      careerOSExperience: true,
      careerOSNavigation: false,
    });
  });
});
