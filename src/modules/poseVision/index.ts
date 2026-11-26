/**
 * V2-Ready Modular Lazy-Loaded Client-Side Video Pose Vision Stub
 * Typed cleanly against @mediapipe/pose WorldLandmark indices so V2 WASM
 * client-side side-view video analysis drops in without refactoring core LeverLab.
 */
export interface PoseLandmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export const MEDIAPIPE_LANDMARK_INDEX = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export interface ExtractedHoldFormMetrics {
  hipAngleDeg: number;
  kneeAngleDeg: number;
  hipSagPikeDeg: number;
  confidence: number;
}

function angleBetween(a: PoseLandmark3D, b: PoseLandmark3D, c: PoseLandmark3D): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return 180;
  const clamped = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/**
 * Pure landmark-to-angle extractor ready for MediaPipe PoseLandmarker output frames.
 */
export function extractSideViewPoseAngles(landmarks: PoseLandmark3D[]): ExtractedHoldFormMetrics | null {
  if (landmarks.length < 29) return null;
  const shoulder = landmarks[MEDIAPIPE_LANDMARK_INDEX.LEFT_SHOULDER];
  const hip = landmarks[MEDIAPIPE_LANDMARK_INDEX.LEFT_HIP];
  const knee = landmarks[MEDIAPIPE_LANDMARK_INDEX.LEFT_KNEE];
  const ankle = landmarks[MEDIAPIPE_LANDMARK_INDEX.LEFT_ANKLE];

  const rawHip = angleBetween(shoulder, hip, knee);
  const rawKnee = angleBetween(hip, knee, ankle);
  const hipSagPikeDeg = Number((180 - rawHip).toFixed(1));

  return {
    hipAngleDeg: Number(Math.max(0, 180 - rawHip).toFixed(1)),
    kneeAngleDeg: Number(Math.max(0, 180 - rawKnee).toFixed(1)),
    hipSagPikeDeg,
    confidence: Number(
      (((shoulder.visibility ?? 0.9) + (hip.visibility ?? 0.9) + (knee.visibility ?? 0.9)) / 3).toFixed(2)
    ),
  };
}

export async function loadPoseVisionEngineStatus(): Promise<{
  ready: boolean;
  runtime: string;
  privacyNote: string;
}> {
  return {
    ready: false,
    runtime: '@mediapipe/tasks-vision PoseLandmarker (WASM — V2 PRO Module)',
    privacyNote: '100% browser-local WebAssembly inference — zero video frames ever leave your device.',
  };
}
