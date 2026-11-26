import { describe, expect, it } from 'vitest';
import {
  buildLocalFullLeverLabLicense,
  FREE_LEVERLAB_LICENSE,
  isLocalPreviewHost,
  LEVERLAB_DEMO_KEYS,
  parseStoredLeverLabLicense,
  validateLeverLabKeyLocally,
} from './licenseEngine';

describe('LeverLab Licensing Engine', () => {
  it('detects localhost hosts and builds Local Full Pro edition', () => {
    expect(isLocalPreviewHost('localhost')).toBe(true);
    expect(isLocalPreviewHost('127.0.0.1')).toBe(true);
    expect(isLocalPreviewHost('leverlab.app')).toBe(false);

    const local = buildLocalFullLeverLabLicense('2026-11-24T00:00:00Z');
    expect(local.isPro).toBe(true);
    expect(local.mode).toBe('local_full');
  });

  it('validates Athlete Lifetime & Coach keys and handles malformed storage safely', () => {
    const athlete = validateLeverLabKeyLocally(LEVERLAB_DEMO_KEYS.athleteLifetime);
    expect(athlete.valid).toBe(true);
    expect(athlete.state?.planId).toBe('athlete_lifetime');

    const coach = validateLeverLabKeyLocally(LEVERLAB_DEMO_KEYS.coachAnnual);
    expect(coach.valid).toBe(true);
    expect(coach.state?.planId).toBe('coach_annual');

    expect(validateLeverLabKeyLocally('INVALID').valid).toBe(false);
    expect(parseStoredLeverLabLicense('not-json')).toEqual(FREE_LEVERLAB_LICENSE);
  });
});
