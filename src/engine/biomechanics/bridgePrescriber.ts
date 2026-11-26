import { z } from 'zod';
import { AthleteAnthropometrics, GRAVITY_M_S2, resolveAthleteSegments } from './anthropometrics';
import { PresetPose, solveStaticShoulderTorque } from './torqueSolver';

export const BridgePrescriptionInputSchema = z.object({
  currentPose: z.enum(['tuck', 'adv_tuck', 'one_leg', 'straddle', 'half_lay']),
  currentMaxHoldSec: z.number().min(1).max(60),
  targetSkill: z.enum(['planche', 'front_lever', 'back_lever']),
  targetStepPct: z.number().min(6).max(10).default(8),
});

export type BridgePrescriptionInput = z.infer<typeof BridgePrescriptionInputSchema>;

export interface ProgressionBridgeStep {
  stepNumber: number;
  label: string;
  pose: PresetPose;
  straddleAngleDeg: number;
  bandAssistKg: number;
  targetTorqueNm: number;
  percentOfFull: number;
  deltaFromPrevPct: number;
  prescribedSetsAndHold: string;
  cue: string;
}

/**
 * Generates a 6-step incremental torque progression table bridging the athlete's
 * current hold toward Full Lever/Planche while keeping EVERY jump strictly within
 * the tendon-safe 6%–10% torque delta window (solving the +46.9% Adv Tuck -> Straddle cliff).
 */
export function prescribeAutoBridge(
  athlete: AthleteAnthropometrics,
  rawInput: BridgePrescriptionInput
): ProgressionBridgeStep[] {
  const input = BridgePrescriptionInputSchema.parse(rawInput);
  const seg = resolveAthleteSegments(athlete);
  const hipMomentArmM = seg.lengthsM.trunk;

  const baseSol = solveStaticShoulderTorque(athlete, {
    pose: input.currentPose,
    skill: input.targetSkill,
    straddleAngleDeg: input.currentPose === 'straddle' ? 90 : 0,
  });

  const fullSol = solveStaticShoulderTorque(athlete, {
    pose: 'full',
    skill: input.targetSkill,
  });

  const straddle90Sol = solveStaticShoulderTorque(athlete, {
    pose: 'straddle',
    skill: input.targetSkill,
    straddleAngleDeg: 90,
  });

  const wideStraddle120Sol = solveStaticShoulderTorque(athlete, {
    pose: 'straddle',
    skill: input.targetSkill,
    straddleAngleDeg: 120,
  });

  const stepFactor = 1 + input.targetStepPct / 100;
  const steps: ProgressionBridgeStep[] = [];
  let prevTorque = baseSol.totalTorqueNm;

  for (let i = 1; i <= 6; i++) {
    const desiredTorque = Math.min(fullSol.totalTorqueNm, prevTorque * stepFactor);
    const actualDeltaPct = Number((((desiredTorque - prevTorque) / prevTorque) * 100).toFixed(1));
    const pctFull = Number(((desiredTorque / fullSol.totalTorqueNm) * 100).toFixed(1));

    let label: string;
    let pose: PresetPose;
    let straddleAngleDeg = 0;
    let bandAssistKg = 0;
    let cue: string;

    if (desiredTorque >= fullSol.totalTorqueNm * 0.995) {
      pose = 'full';
      const skillName =
        input.targetSkill === 'planche'
          ? 'Planche'
          : input.targetSkill === 'back_lever'
          ? 'Back Lever'
          : 'Front Lever';
      label = `Full ${skillName} (Unassisted)`;
      cue =
        input.targetSkill === 'back_lever'
          ? 'Condition supinated distal biceps tendons progressively; lock hollow body for clean 3–5s holds.'
          : 'Lock posterior pelvic tilt and depress scapulae; accumulate clean 3–5s holds.';
    } else if (desiredTorque >= wideStraddle120Sol.totalTorqueNm && desiredTorque < fullSol.totalTorqueNm) {
      // Pure geometric straddle narrowing solves torque cleanly without bands!
      pose = 'straddle';
      // Search straddle angle from 120° down to 0° for closest match
      let bestDeg = 60;
      let bestErr = Infinity;
      for (let deg = 0; deg <= 125; deg += 2) {
        const test = solveStaticShoulderTorque(athlete, {
          pose: 'straddle',
          skill: input.targetSkill,
          straddleAngleDeg: deg,
        });
        const err = Math.abs(test.totalTorqueNm - desiredTorque);
        if (err < bestErr) {
          bestErr = err;
          bestDeg = deg;
        }
      }
      straddleAngleDeg = bestDeg;
      label = bestDeg <= 12 ? `Closed-Straddle (${bestDeg}°) Hold` : `Narrowing Straddle (${bestDeg}° Abduction)`;
      cue = 'No band required: tighten leg abduction angle gradually using floor tape markers.';
    } else {
      // Bridge the Adv Tuck -> Straddle cliff using Straddle 90° + calibrated hip band assist
      pose = 'straddle';
      straddleAngleDeg = 90;
      const deficitTorque = Math.max(0, straddle90Sol.totalTorqueNm - desiredTorque);
      bandAssistKg = Number((deficitTorque / (GRAVITY_M_S2 * hipMomentArmM)).toFixed(1));
      label = `90° Straddle + ${bandAssistKg} kg Hip Band Assist`;
      cue = `Place calibrated resistance band (~${bandAssistKg} kg tension at hip) to eliminate the +47% torque cliff.`;
    }

    const targetHoldSec = Math.max(4, Math.min(12, Math.round(input.currentMaxHoldSec * 0.65)));
    steps.push({
      stepNumber: i,
      label,
      pose,
      straddleAngleDeg,
      bandAssistKg,
      targetTorqueNm: Number(desiredTorque.toFixed(1)),
      percentOfFull: pctFull,
      deltaFromPrevPct: actualDeltaPct,
      prescribedSetsAndHold: `5–6 sets × ${targetHoldSec}s (RPE 8, 3 min rest)`,
      cue,
    });

    prevTorque = desiredTorque;
    if (desiredTorque >= fullSol.totalTorqueNm * 0.995) break;
  }

  return steps;
}
