import { z } from 'zod';

/**
 * Pure, framework-agnostic licensing engine for LeverLab PWA.
 * Zero React or DOM imports.
 */
export type LeverLabPlanId = 'free' | 'athlete_lifetime' | 'coach_annual';

export const LeverLabLicenseSchema = z.object({
  isPro: z.boolean().default(false),
  planId: z.enum(['free', 'athlete_lifetime', 'coach_annual']).default('free'),
  keyMasked: z.string().max(40).default(''),
  mode: z.enum(['none', 'local_full', 'offline_demo', 'remote_mor']).default('none'),
  activatedAtIso: z.string().max(40).default(''),
});

export type LeverLabLicenseState = z.infer<typeof LeverLabLicenseSchema>;

export const FREE_LEVERLAB_LICENSE: LeverLabLicenseState = {
  isPro: false,
  planId: 'free',
  keyMasked: '',
  mode: 'none',
  activatedAtIso: '',
};

export const LEVERLAB_DEMO_KEYS = {
  athleteLifetime: 'LVLB-DEMO-2026-PRO1',
  coachAnnual: 'LVLB-COCH-2026-PRO2',
} as const;

const KEY_REGEX = /^LVLB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isLocalPreviewHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h.endsWith('.local');
}

export function buildLocalFullLeverLabLicense(nowIso: string = new Date().toISOString()): LeverLabLicenseState {
  return {
    isPro: true,
    planId: 'coach_annual',
    keyMasked: 'LOCAL-FULL-PRO',
    mode: 'local_full',
    activatedAtIso: nowIso,
  };
}

export function maskLeverLabKey(normalized: string): string {
  const parts = normalized.split('-');
  if (parts.length !== 4) return normalized.slice(0, 8) + '••••';
  return `${parts[0]}-${parts[1]}-••••-${parts[3]}`;
}

export function validateLeverLabKeyLocally(
  rawKey: string,
  nowIso: string = new Date().toISOString()
): { valid: boolean; reason: 'ok' | 'empty' | 'invalid_format'; state?: LeverLabLicenseState } {
  const key = rawKey.trim().toUpperCase().replace(/\s+/g, '');
  if (!key) return { valid: false, reason: 'empty' };
  if (!KEY_REGEX.test(key)) return { valid: false, reason: 'invalid_format' };

  const isCoach = key.includes('-COCH-');
  const isDemo = key === LEVERLAB_DEMO_KEYS.athleteLifetime || key === LEVERLAB_DEMO_KEYS.coachAnnual;

  return {
    valid: true,
    reason: 'ok',
    state: LeverLabLicenseSchema.parse({
      isPro: true,
      planId: isCoach ? 'coach_annual' : 'athlete_lifetime',
      keyMasked: maskLeverLabKey(key),
      mode: isDemo ? 'offline_demo' : 'remote_mor',
      activatedAtIso: nowIso,
    }),
  };
}

export function parseStoredLeverLabLicense(rawJson: string | null): LeverLabLicenseState {
  if (!rawJson) return FREE_LEVERLAB_LICENSE;
  try {
    const res = LeverLabLicenseSchema.safeParse(JSON.parse(rawJson));
    return res.success ? res.data : FREE_LEVERLAB_LICENSE;
  } catch {
    return FREE_LEVERLAB_LICENSE;
  }
}
