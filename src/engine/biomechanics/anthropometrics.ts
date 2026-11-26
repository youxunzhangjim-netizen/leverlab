import { z } from 'zod';

/**
 * Peer-reviewed anthropometric constants:
 * - Segment mass fractions: Winter (2009) / de Leva (1996) adjustments to Zatsiorsky-Seluyanov
 * - Segment length fractions: Drillis & Contini (1966)
 */
export const SEGMENT_MASS_FRACTIONS = {
  headNeck: 0.081,
  trunk: 0.497,
  thighsPair: 0.200, // 2 x 0.100
  shanksPair: 0.093, // 2 x 0.0465
  feetPair: 0.029, // 2 x 0.0145
  totalSuspended: 0.900, // supporting arms = 0.100
} as const;

export const SEGMENT_LENGTH_FRACTIONS = {
  trunk: 0.288,
  thigh: 0.245,
  shank: 0.246,
  headComOffset: -0.091, // cranial of shoulder fulcrum
  footComOffset: 0.020, // distal of ankle
  trunkComRatio: 0.500,
  thighComRatio: 0.433,
  shankComRatio: 0.433,
} as const;

export const GRAVITY_M_S2 = 9.81;

export const AthleteAnthropometricsSchema = z.object({
  heightCm: z.number().min(130).max(230),
  weightKg: z.number().min(35).max(160),
  customTrunkCm: z.number().min(25).max(90).optional(),
  customThighCm: z.number().min(25).max(75).optional(),
  customShankCm: z.number().min(25).max(75).optional(),
});

export type AthleteAnthropometrics = z.infer<typeof AthleteAnthropometricsSchema>;

export interface ResolvedSegments {
  heightM: number;
  weightKg: number;
  massesKg: {
    headNeck: number;
    trunk: number;
    thighsPair: number;
    shanksPair: number;
    feetPair: number;
    totalSuspended: number;
  };
  lengthsM: {
    trunk: number;
    thigh: number;
    shank: number;
    headComOffset: number;
    footComOffset: number;
  };
}

export function resolveAthleteSegments(raw: AthleteAnthropometrics): ResolvedSegments {
  const input = AthleteAnthropometricsSchema.parse(raw);
  const H = input.heightCm / 100;
  const M = input.weightKg;

  return {
    heightM: H,
    weightKg: M,
    massesKg: {
      headNeck: SEGMENT_MASS_FRACTIONS.headNeck * M,
      trunk: SEGMENT_MASS_FRACTIONS.trunk * M,
      thighsPair: SEGMENT_MASS_FRACTIONS.thighsPair * M,
      shanksPair: SEGMENT_MASS_FRACTIONS.shanksPair * M,
      feetPair: SEGMENT_MASS_FRACTIONS.feetPair * M,
      totalSuspended: SEGMENT_MASS_FRACTIONS.totalSuspended * M,
    },
    lengthsM: {
      trunk: input.customTrunkCm ? input.customTrunkCm / 100 : SEGMENT_LENGTH_FRACTIONS.trunk * H,
      thigh: input.customThighCm ? input.customThighCm / 100 : SEGMENT_LENGTH_FRACTIONS.thigh * H,
      shank: input.customShankCm ? input.customShankCm / 100 : SEGMENT_LENGTH_FRACTIONS.shank * H,
      headComOffset: SEGMENT_LENGTH_FRACTIONS.headComOffset * H,
      footComOffset: SEGMENT_LENGTH_FRACTIONS.footComOffset * H,
    },
  };
}
