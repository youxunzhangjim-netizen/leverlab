import { describe, expect, it } from 'vitest';
import { solveStaticShoulderTorque } from './torqueSolver';
import { prescribeAutoBridge } from './bridgePrescriber';
import { evaluateAcwrTendonSafety, generate12WeekMesocycle } from './acwrAndPeriodization';

describe('LeverLab Winter/de Leva Biomechanics Engine', () => {
  it('matches all mandatory 70 kg torque benchmarks across 165 cm, 175 cm, and 185 cm statures', () => {
    const cases: Array<{ h: number; tuck: number; adv: number; s90: number; full: number }> = [
      { h: 165, tuck: 138.5, adv: 158.5, s90: 232.9, full: 255.7 },
      { h: 175, tuck: 146.9, adv: 168.1, s90: 247.0, full: 271.2 },
      { h: 185, tuck: 155.3, adv: 177.7, s90: 261.1, full: 286.7 },
    ];

    for (const c of cases) {
      const ath = { heightCm: c.h, weightKg: 70 };
      expect(solveStaticShoulderTorque(ath, { pose: 'tuck' }).totalTorqueNm).toBeCloseTo(c.tuck, 0);
      expect(solveStaticShoulderTorque(ath, { pose: 'adv_tuck' }).totalTorqueNm).toBeCloseTo(c.adv, 0);
      expect(solveStaticShoulderTorque(ath, { pose: 'straddle', straddleAngleDeg: 90 }).totalTorqueNm).toBeCloseTo(c.s90, 0);
      expect(solveStaticShoulderTorque(ath, { pose: 'full' }).totalTorqueNm).toBeCloseTo(c.full, 0);
    }
  });

  it('matches BMI-matched lever-arm penalty ratio (185 cm / 80 kg vs 165 cm / 62 kg -> 1.45x)', () => {
    const tall = solveStaticShoulderTorque({ heightCm: 185, weightKg: 80 }, { pose: 'full' });
    const compact = solveStaticShoulderTorque({ heightCm: 165, weightKg: 62 }, { pose: 'full' });
    expect(tall.totalTorqueNm).toBeCloseTo(327.6, 0);
    expect(compact.totalTorqueNm).toBeCloseTo(226.5, 0);
    expect(Number((tall.totalTorqueNm / compact.totalTorqueNm).toFixed(2))).toBe(1.45);
  });

  it('applies hip band assist and custom limb overrides cleanly', () => {
    const unassisted = solveStaticShoulderTorque({ heightCm: 175, weightKg: 70 }, { pose: 'straddle', straddleAngleDeg: 90 });
    const assisted = solveStaticShoulderTorque(
      { heightCm: 175, weightKg: 70 },
      { pose: 'straddle', straddleAngleDeg: 90, bandAssistKg: 10 }
    );
    expect(assisted.totalTorqueNm).toBeLessThan(unassisted.totalTorqueNm);

    const longFemur = solveStaticShoulderTorque(
      { heightCm: 175, weightKg: 70, customThighCm: 50 },
      { pose: 'full' }
    );
    expect(longFemur.totalTorqueNm).toBeGreaterThan(271.2);
  });

  it('generates tendon-safe Auto-Bridge steps keeping every increment within 6%–10%', () => {
    const ladder = prescribeAutoBridge(
      { heightCm: 175, weightKg: 70 },
      {
        currentPose: 'adv_tuck',
        currentMaxHoldSec: 12,
        targetSkill: 'front_lever',
        targetStepPct: 8,
      }
    );
    expect(ladder.length).toBe(6);
    for (const step of ladder) {
      expect(step.deltaFromPrevPct).toBeGreaterThanOrEqual(5.5);
      expect(step.deltaFromPrevPct).toBeLessThanOrEqual(10.5);
    }
  });

  it('scales Back Lever & incline tilt by cos(tiltDeg), detects ACWR >1.50 danger spikes, and builds 12-week mesocycle with deloads', () => {
    const flat = solveStaticShoulderTorque({ heightCm: 175, weightKg: 70 }, { pose: 'full', skill: 'back_lever', bodyTiltDeg: 0 });
    const tilt30 = solveStaticShoulderTorque({ heightCm: 175, weightKg: 70 }, { pose: 'full', skill: 'back_lever', bodyTiltDeg: 30 });
    expect(tilt30.totalTorqueNm / flat.totalTorqueNm).toBeCloseTo(Math.cos((30 * Math.PI) / 180), 2);

    const sweet = evaluateAcwrTendonSafety([
      { weekOffset: 0, torqueVolumeEqSec: 110 },
      { weekOffset: 1, torqueVolumeEqSec: 100 },
      { weekOffset: 2, torqueVolumeEqSec: 100 },
      { weekOffset: 3, torqueVolumeEqSec: 95 },
    ]);
    expect(sweet.zone).toBe('sweet_spot');

    const spike = evaluateAcwrTendonSafety([
      { weekOffset: 0, torqueVolumeEqSec: 220 },
      { weekOffset: 1, torqueVolumeEqSec: 80 },
      { weekOffset: 2, torqueVolumeEqSec: 80 },
      { weekOffset: 3, torqueVolumeEqSec: 80 },
    ]);
    expect(spike.zone).toBe('danger');
    expect(spike.acwrRatio).toBeGreaterThan(1.5);

    const plan = generate12WeekMesocycle({ heightCm: 175, weightKg: 70 }, 'adv_tuck', 12, 'back_lever', 8);
    expect(plan).toHaveLength(12);
    expect(plan[3].phase).toBe('Tendon Deload');
    expect(plan[7].phase).toBe('Tendon Deload');
    expect(plan[11].phase).toBe('Tendon Deload');
  });
});
