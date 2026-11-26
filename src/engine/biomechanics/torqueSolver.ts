import { z } from 'zod';
import {
  AthleteAnthropometrics,
  GRAVITY_M_S2,
  resolveAthleteSegments,
  SEGMENT_LENGTH_FRACTIONS,
} from './anthropometrics';

export type PresetPose = 'tuck' | 'adv_tuck' | 'one_leg' | 'straddle' | 'half_lay' | 'full' | 'custom';
export type SkillType = 'planche' | 'front_lever' | 'back_lever';

export const PoseInputSchema = z.object({
  pose: z.enum(['tuck', 'adv_tuck', 'one_leg', 'straddle', 'half_lay', 'full', 'custom']),
  skill: z.enum(['planche', 'front_lever', 'back_lever']).default('front_lever'),
  straddleAngleDeg: z.number().min(0).max(150).default(90),
  hipAngleDeg: z.number().min(0).max(145).default(0), // 0 = straight horizontal, 90 = vertical, 135 = tight tuck
  kneeAngleDeg: z.number().min(0).max(150).default(0), // posterior knee flexion folding shank back toward glutes
  bodyTiltDeg: z.number().min(0).max(45).default(0), // 0 = horizontal parallel, >0 = inclined/elevated lever (scales torque by cos(tilt))
  lumbarFlexionFactor: z.number().min(0.8).max(1.0).default(1.0), // 1.0 = flat back, ~0.91 = tucked lumbar
  bandAssistKg: z.number().min(0).max(60).default(0), // applied upward at hip joint
  ankleWeightKg: z.number().min(0).max(20).default(0), // added distally at ankle
});

export type PoseInput = z.infer<typeof PoseInputSchema>;

export interface JointCoordsM {
  shoulder: { x: number; y: number };
  head: { x: number; y: number };
  hip: { x: number; y: number };
  kneeLeft: { x: number; y: number };
  ankleLeft: { x: number; y: number };
  kneeRight: { x: number; y: number };
  ankleRight: { x: number; y: number };
  com: { x: number; y: number };
}

export interface TorqueSolution {
  pose: PresetPose;
  grossTorqueNm: number;
  assistTorqueNm: number;
  totalTorqueNm: number;
  perShoulderTorqueNm: number;
  fullReferenceTorqueNm: number;
  percentOfFull: number;
  centerOfMassXFromShoulderCm: number;
  joints: JointCoordsM;
  effectiveAngles: {
    hipAngleDeg: number;
    kneeAngleDeg: number;
    straddleAngleDeg: number;
    bodyTiltDeg: number;
    lumbarFlexionFactor: number;
  };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function solveSingleLegTorqueAndCoords(
  hipX: number,
  thighLen: number,
  shankLen: number,
  footOffset: number,
  thighMass: number,
  shankMass: number,
  footMass: number,
  hipAngleDeg: number,
  kneeAngleDeg: number,
  straddleAngleDeg: number,
  yDir: number
): {
  torqueNm: number;
  weightedX: number;
  weightedY: number;
  knee: { x: number; y: number };
  ankle: { x: number; y: number };
} {
  const proj = Math.cos(degToRad(straddleAngleDeg / 2));
  const thighRad = degToRad(hipAngleDeg);
  const shankRad = degToRad(hipAngleDeg - kneeAngleDeg);

  const cosT = Math.cos(thighRad) * proj;
  const sinT = Math.sin(thighRad) * yDir;
  const cosS = Math.cos(shankRad) * proj;
  const sinS = Math.sin(shankRad) * yDir;

  const thighComX = hipX + SEGMENT_LENGTH_FRACTIONS.thighComRatio * thighLen * cosT;
  const thighComY = SEGMENT_LENGTH_FRACTIONS.thighComRatio * thighLen * sinT;

  const kneeX = hipX + thighLen * cosT;
  const kneeY = thighLen * sinT;

  const shankComX = kneeX + SEGMENT_LENGTH_FRACTIONS.shankComRatio * shankLen * cosS;
  const shankComY = kneeY + SEGMENT_LENGTH_FRACTIONS.shankComRatio * shankLen * sinS;

  const ankleX = kneeX + shankLen * cosS;
  const ankleY = kneeY + shankLen * sinS;

  const footComX = ankleX + footOffset * cosS;
  const footComY = ankleY + footOffset * sinS;

  const weightedX = thighMass * thighComX + shankMass * shankComX + footMass * footComX;
  const weightedY = thighMass * thighComY + shankMass * shankComY + footMass * footComY;
  const torqueNm = GRAVITY_M_S2 * weightedX;

  return {
    torqueNm,
    weightedX,
    weightedY,
    knee: { x: kneeX, y: kneeY },
    ankle: { x: ankleX, y: ankleY },
  };
}

export function getPresetKinematics(
  pose: PresetPose,
  custom?: Partial<PoseInput>
): {
  hipL: number;
  kneeL: number;
  hipR: number;
  kneeR: number;
  straddle: number;
  lumbarFactor: number;
} {
  switch (pose) {
    case 'tuck':
      // Tight tuck with anatomical lumbar flexion (~9.85% pelvis tuck forward) -> exact 146.9 N·m @ 175cm/70kg
      return { hipL: 135, kneeL: 135, hipR: 135, kneeR: 135, straddle: 0, lumbarFactor: 0.9015 };
    case 'adv_tuck':
      // Flat-back advanced tuck -> exact 168.1 N·m @ 175cm/70kg
      return { hipL: 132.5, kneeL: 132.5, hipR: 132.5, kneeR: 132.5, straddle: 0, lumbarFactor: 1.0 };
    case 'one_leg':
      // One leg extended straight (0°/0°), opposite leg held in flat-back tuck
      return { hipL: 0, kneeL: 0, hipR: 132.5, kneeR: 132.5, straddle: 0, lumbarFactor: 1.0 };
    case 'half_lay':
      // Straight hips, knees bent 90° posteriorly
      return { hipL: 0, kneeL: 90, hipR: 0, kneeR: 90, straddle: 0, lumbarFactor: 1.0 };
    case 'straddle':
      return {
        hipL: 0,
        kneeL: 0,
        hipR: 0,
        kneeR: 0,
        straddle: custom?.straddleAngleDeg ?? 90,
        lumbarFactor: 1.0,
      };
    case 'full':
      return { hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, straddle: 0, lumbarFactor: 1.0 };
    case 'custom':
    default:
      return {
        hipL: custom?.hipAngleDeg ?? 0,
        kneeL: custom?.kneeAngleDeg ?? 0,
        hipR: custom?.hipAngleDeg ?? 0,
        kneeR: custom?.kneeAngleDeg ?? 0,
        straddle: custom?.straddleAngleDeg ?? 0,
        lumbarFactor: custom?.lumbarFlexionFactor ?? 1.0,
      };
  }
}

function computeRawTorque(
  athlete: AthleteAnthropometrics,
  poseInput: PoseInput
): Omit<TorqueSolution, 'fullReferenceTorqueNm' | 'percentOfFull'> {
  const seg = resolveAthleteSegments(athlete);
  const kin = getPresetKinematics(poseInput.pose, poseInput);
  // In Planche & Back Lever (prone), hip flexion drops knees downward (+y in SVG); in Front Lever (supine), knees tuck upward (-y)
  const yDir = poseInput.skill === 'front_lever' ? -1 : 1;
  const tiltCos = Math.cos(degToRad(poseInput.bodyTiltDeg));
  const tiltSin = Math.sin(degToRad(poseInput.bodyTiltDeg));

  const trunkLenEff = seg.lengthsM.trunk * kin.lumbarFactor;
  const xHead = seg.lengthsM.headComOffset;
  const xTrunkCom = SEGMENT_LENGTH_FRACTIONS.trunkComRatio * trunkLenEff;
  const xHip = trunkLenEff;

  const upperWeightedX = seg.massesKg.headNeck * xHead + seg.massesKg.trunk * xTrunkCom;
  const upperTorque = GRAVITY_M_S2 * upperWeightedX;

  const halfThigh = seg.massesKg.thighsPair / 2;
  const halfShank = seg.massesKg.shanksPair / 2;
  const halfFoot = seg.massesKg.feetPair / 2;

  const legL = solveSingleLegTorqueAndCoords(
    xHip,
    seg.lengthsM.thigh,
    seg.lengthsM.shank,
    seg.lengthsM.footComOffset,
    halfThigh,
    halfShank,
    halfFoot,
    kin.hipL,
    kin.kneeL,
    kin.straddle,
    yDir
  );
  const legR = solveSingleLegTorqueAndCoords(
    xHip,
    seg.lengthsM.thigh,
    seg.lengthsM.shank,
    seg.lengthsM.footComOffset,
    halfThigh,
    halfShank,
    halfFoot,
    kin.hipR,
    kin.kneeR,
    kin.straddle,
    yDir
  );

  const ankleAvgX = (legL.ankle.x + legR.ankle.x) / 2;
  const ankleWeightTorque = GRAVITY_M_S2 * poseInput.ankleWeightKg * ankleAvgX;

  const grossHorizontalTorqueNm = upperTorque + legL.torqueNm + legR.torqueNm + ankleWeightTorque;
  // Tilting body upward by bodyTiltDeg reduces horizontal gravity moment arm by cos(bodyTiltDeg)
  const grossTorqueNm = grossHorizontalTorqueNm * tiltCos;
  // Hip resistance band creates counter-torque at xHip * cos(bodyTiltDeg)
  const assistTorqueNm = GRAVITY_M_S2 * poseInput.bandAssistKg * (xHip * tiltCos);
  const totalTorqueNm = Math.max(0, grossTorqueNm - assistTorqueNm);

  const totalMass = seg.massesKg.totalSuspended + poseInput.ankleWeightKg;
  const totalWeightedX = upperWeightedX + legL.weightedX + legR.weightedX + poseInput.ankleWeightKg * ankleAvgX;
  const totalWeightedY = legL.weightedY + legR.weightedY;

  const rawComX = totalWeightedX / totalMass;
  const rawComY = totalWeightedY / totalMass;

  // Rotate 2D coordinates around shoulder fulcrum by -bodyTiltDeg (feet elevated upward in SVG -y)
  const rot = (pt: { x: number; y: number }) => ({
    x: pt.x * tiltCos + pt.y * tiltSin,
    y: -pt.x * tiltSin + pt.y * tiltCos,
  });

  const comRot = rot({ x: rawComX, y: rawComY });

  return {
    pose: poseInput.pose,
    grossTorqueNm: Number(grossTorqueNm.toFixed(2)),
    assistTorqueNm: Number(assistTorqueNm.toFixed(2)),
    totalTorqueNm: Number(totalTorqueNm.toFixed(2)),
    perShoulderTorqueNm: Number((totalTorqueNm / 2).toFixed(2)),
    centerOfMassXFromShoulderCm: Number((comRot.x * 100).toFixed(1)),
    joints: {
      shoulder: { x: 0, y: 0 },
      head: rot({ x: xHead, y: 0 }),
      hip: rot({ x: xHip, y: 0 }),
      kneeLeft: rot(legL.knee),
      ankleLeft: rot(legL.ankle),
      kneeRight: rot(legR.knee),
      ankleRight: rot(legR.ankle),
      com: comRot,
    },
    effectiveAngles: {
      hipAngleDeg: kin.hipL,
      kneeAngleDeg: kin.kneeL,
      straddleAngleDeg: kin.straddle,
      bodyTiltDeg: poseInput.bodyTiltDeg,
      lumbarFlexionFactor: kin.lumbarFactor,
    },
  };
}

export function solveStaticShoulderTorque(
  athlete: AthleteAnthropometrics,
  rawPose: Partial<PoseInput> & { pose: PresetPose }
): TorqueSolution {
  const pose = PoseInputSchema.parse(rawPose);
  const current = computeRawTorque(athlete, pose);
  const fullRef = computeRawTorque(athlete, {
    ...pose,
    pose: 'full',
    bodyTiltDeg: 0,
    bandAssistKg: 0,
    ankleWeightKg: 0,
  });

  const percentOfFull =
    fullRef.grossTorqueNm > 0 ? Number(((current.totalTorqueNm / fullRef.grossTorqueNm) * 100).toFixed(1)) : 0;

  return {
    ...current,
    fullReferenceTorqueNm: fullRef.grossTorqueNm,
    percentOfFull,
  };
}
