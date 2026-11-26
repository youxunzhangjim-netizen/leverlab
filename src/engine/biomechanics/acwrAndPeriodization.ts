import { z } from 'zod';
import { AthleteAnthropometrics } from './anthropometrics';
import { prescribeAutoBridge } from './bridgePrescriber';
import { SkillType } from './torqueSolver';

export const WorkloadSampleSchema = z.object({
  weekOffset: z.number().int().min(0).max(3), // 0 = current 7d (acute), 1..3 = prior 3 weeks
  torqueVolumeEqSec: z.number().min(0),
});

export type WorkloadSample = z.infer<typeof WorkloadSampleSchema>;

export interface AcwrAssessment {
  acute7dLoad: number;
  chronic28dWeeklyAvg: number;
  acwrRatio: number;
  zone: 'detraining' | 'sweet_spot' | 'caution' | 'danger';
  zoneLabel: string;
  guidance: string;
}

/**
 * Gabbett Acute:Chronic Workload Ratio (ACWR) for Straight-Arm Tendon Safety
 *   Sweet Spot: 0.80 – 1.30 | Caution: 1.31 – 1.50 | Danger Spike: > 1.50
 */
export function evaluateAcwrTendonSafety(samples: WorkloadSample[]): AcwrAssessment {
  const validated = z.array(WorkloadSampleSchema).parse(samples);
  const weekly = [0, 0, 0, 0];
  for (const s of validated) {
    weekly[s.weekOffset] += s.torqueVolumeEqSec;
  }
  const acute7dLoad = Number(weekly[0].toFixed(1));
  const nonZeroWeeks = weekly.filter((w) => w > 0).length;
  const chronic28dWeeklyAvg =
    nonZeroWeeks > 0 ? Number((weekly.reduce((a, b) => a + b, 0) / Math.max(2, nonZeroWeeks)).toFixed(1)) : 0;

  const acwrRatio = chronic28dWeeklyAvg > 0 ? Number((acute7dLoad / chronic28dWeeklyAvg).toFixed(2)) : 1.0;

  if (acwrRatio > 1.5) {
    return {
      acute7dLoad,
      chronic28dWeeklyAvg,
      acwrRatio,
      zone: 'danger',
      zoneLabel: 'DANGER SPIKE (> 1.50)',
      guidance: 'High distal biceps / elbow tendinopathy risk. Cut straight-arm volume by 35–40% or add hip-band assistance immediately.',
    };
  }
  if (acwrRatio > 1.3) {
    return {
      acute7dLoad,
      chronic28dWeeklyAvg,
      acwrRatio,
      zone: 'caution',
      zoneLabel: 'CAUTION (1.31 – 1.50)',
      guidance: 'Upper adaptation ceiling reached. Hold current progression steady without adding extra sets this week.',
    };
  }
  if (acwrRatio >= 0.8) {
    return {
      acute7dLoad,
      chronic28dWeeklyAvg,
      acwrRatio,
      zone: 'sweet_spot',
      zoneLabel: 'SWEET SPOT (0.80 – 1.30)',
      guidance: 'Optimal progressive overload window for collagen synthesis and straight-arm strength gains.',
    };
  }
  return {
    acute7dLoad,
    chronic28dWeeklyAvg,
    acwrRatio,
    zone: 'detraining',
    zoneLabel: 'DELOAD / LOW (< 0.80)',
    guidance: 'Recovery or deload week active—great for tendon supercompensation before advancing to the next Auto-Bridge step.',
  };
}

export interface MesocycleWeek {
  week: number;
  phase: 'Accumulation' | 'Intensification' | 'Tendon Deload';
  bridgeStepNumber: number;
  progressionLabel: string;
  targetTorqueNm: number;
  sessionsPerWeek: number;
  prescription: string;
  weeklyEqSecTarget: number;
}

/**
 * Generates a 12-week (3 x 4-week blocks with mandatory Wk 4/8/12 tendon deloads)
 * periodized Straight-Arm Mesocycle linked directly to the athlete's Auto-Bridge steps.
 */
export function generate12WeekMesocycle(
  athlete: AthleteAnthropometrics,
  currentPose: 'tuck' | 'adv_tuck' | 'one_leg' | 'straddle' | 'half_lay',
  currentMaxHoldSec: number,
  targetSkill: SkillType,
  targetStepPct = 8
): MesocycleWeek[] {
  const ladder = prescribeAutoBridge(athlete, {
    currentPose,
    currentMaxHoldSec,
    targetSkill,
    targetStepPct,
  });

  const weeks: MesocycleWeek[] = [];
  for (let w = 1; w <= 12; w++) {
    const isDeload = w % 4 === 0;
    const blockIdx = Math.floor((w - 1) / 4); // 0, 1, 2
    const withinBlock = (w - 1) % 4; // 0, 1, 2, 3
    const stepIdx = Math.min(ladder.length - 1, blockIdx * 2 + (withinBlock >= 2 ? 1 : 0));
    const step = ladder[stepIdx];

    const baseHold = Math.max(4, Math.min(12, Math.round(currentMaxHoldSec * 0.65)));
    const sets = isDeload ? 3 : withinBlock === 0 ? 4 : withinBlock === 1 ? 5 : 6;
    const hold = isDeload ? Math.max(4, baseHold - 1) : baseHold + (withinBlock === 2 ? 1 : 0);
    const sessionsPerWeek = isDeload ? 2 : 3;
    const weeklyEqSecTarget = Number((sessionsPerWeek * sets * hold * (step.percentOfFull / 100)).toFixed(1));

    weeks.push({
      week: w,
      phase: isDeload ? 'Tendon Deload' : withinBlock === 2 ? 'Intensification' : 'Accumulation',
      bridgeStepNumber: step.stepNumber,
      progressionLabel: step.label,
      targetTorqueNm: step.targetTorqueNm,
      sessionsPerWeek,
      prescription: `${sessionsPerWeek}×/wk · ${sets} sets × ${hold}s (3 min rest${isDeload ? ', RPE 6' : ', RPE 8'})`,
      weeklyEqSecTarget,
    });
  }
  return weeks;
}
