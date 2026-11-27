import React, { useMemo, useState } from 'react';
import { Activity, Camera, ClipboardList, Download, KeyRound, Lock, Sliders, Sun, Moon, ShieldAlert } from 'lucide-react';
import { PresetPose, SkillType, solveStaticShoulderTorque } from './engine/biomechanics/torqueSolver';
import { prescribeAutoBridge } from './engine/biomechanics/bridgePrescriber';
import { generate12WeekMesocycle } from './engine/biomechanics/acwrAndPeriodization';
import {
  buildLocalFullLeverLabLicense,
  FREE_LEVERLAB_LICENSE,
  isLocalPreviewHost,
  LeverLabLicenseState,
  parseStoredLeverLabLicense,
  validateLeverLabKeyLocally,
} from './engine/licenseEngine';
import { BodyRigSvg } from './components/BodyRigSvg';
import { WorkoutLogPanel } from './components/WorkoutLogPanel';
import { ProLicenseModal } from './components/ProLicenseModal';

const LVLB_STORAGE_KEY = 'leverlab_license_v1';
const LVLB_LOCAL_FREE_KEY = 'leverlab_local_sim_free_v1';

function detectLocalHost(): boolean {
  try {
    return typeof window !== 'undefined' && isLocalPreviewHost(window.location.hostname);
  } catch (err) {
    console.warn('Hostname check fallback:', err);
    return false;
  }
}

function loadInitialLeverLabLicense(localHost: boolean): LeverLabLicenseState {
  try {
    const qKey = new URLSearchParams(window.location.search).get('license');
    if (qKey) {
      const check = validateLeverLabKeyLocally(qKey);
      if (check.valid && check.state) {
        window.localStorage.setItem(LVLB_STORAGE_KEY, JSON.stringify(check.state));
        window.localStorage.removeItem(LVLB_LOCAL_FREE_KEY);
        return check.state;
      }
    }
    const stored = parseStoredLeverLabLicense(window.localStorage.getItem(LVLB_STORAGE_KEY));
    if (stored.isPro) return stored;
    if (localHost && window.localStorage.getItem(LVLB_LOCAL_FREE_KEY) !== '1') {
      return buildLocalFullLeverLabLicense();
    }
    return FREE_LEVERLAB_LICENSE;
  } catch (err) {
    console.warn('LeverLab license load fallback:', err);
    return localHost ? buildLocalFullLeverLabLicense() : FREE_LEVERLAB_LICENSE;
  }
}

const POSE_OPTIONS: Array<{ id: PresetPose; label: string }> = [
  { id: 'tuck', label: 'Tuck' },
  { id: 'adv_tuck', label: 'Adv. Tuck' },
  { id: 'one_leg', label: 'One-Leg' },
  { id: 'half_lay', label: 'Half-Lay' },
  { id: 'straddle', label: 'Straddle' },
  { id: 'full', label: 'Full' },
  { id: 'custom', label: 'Custom Angles' },
];

export const App: React.FC = () => {
  const [daylight, setDaylight] = useState(false);
  const [activeTab, setActiveTab] = useState<'torque' | 'bridge' | 'log'>('torque');
  const [isLocalHost] = useState<boolean>(() => detectLocalHost());
  const [license, setLicense] = useState<LeverLabLicenseState>(() => loadInitialLeverLabLicense(detectLocalHost()));
  const [proOpen, setProOpen] = useState(false);

  const handleActivate = (next: LeverLabLicenseState): void => {
    setLicense(next);
    try {
      window.localStorage.setItem(LVLB_STORAGE_KEY, JSON.stringify(next));
      window.localStorage.removeItem(LVLB_LOCAL_FREE_KEY);
    } catch (err) {
      console.warn('LeverLab license save skipped:', err);
    }
  };

  const handleSimulateFree = (): void => {
    setLicense(FREE_LEVERLAB_LICENSE);
    setUseCustomLimbs(false);
    try {
      window.localStorage.removeItem(LVLB_STORAGE_KEY);
      if (isLocalHost) window.localStorage.setItem(LVLB_LOCAL_FREE_KEY, '1');
    } catch (err) {
      console.warn('LeverLab free sim save skipped:', err);
    }
  };

  const handleRestoreLocalFull = (): void => {
    const full = buildLocalFullLeverLabLicense();
    setLicense(full);
    try {
      window.localStorage.removeItem(LVLB_LOCAL_FREE_KEY);
      window.localStorage.removeItem(LVLB_STORAGE_KEY);
    } catch (err) {
      console.warn('LeverLab restore local full skipped:', err);
    }
  };

  // Athlete anthropometrics
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(70);
  const [useCustomLimbs, setUseCustomLimbs] = useState(false);
  const [customTrunkCm, setCustomTrunkCm] = useState(50.4);
  const [customThighCm, setCustomThighCm] = useState(42.9);
  const [customShankCm, setCustomShankCm] = useState(43.1);

  // Pose & assist
  const [skill, setSkill] = useState<SkillType>('front_lever');
  const [pose, setPose] = useState<PresetPose>('straddle');
  const [straddleAngleDeg, setStraddleAngleDeg] = useState(90);
  const [hipAngleDeg, setHipAngleDeg] = useState(45);
  const [kneeAngleDeg, setKneeAngleDeg] = useState(45);
  const [bodyTiltDeg, setBodyTiltDeg] = useState(0);
  const [bandAssistKg, setBandAssistKg] = useState(0);
  const [ankleWeightKg, setAnkleWeightKg] = useState(0);

  // Auto-Bridge controls
  const [bridgeStartPose, setBridgeStartPose] = useState<'tuck' | 'adv_tuck' | 'one_leg' | 'straddle' | 'half_lay'>('adv_tuck');
  const [bridgeHoldSec, setBridgeHoldSec] = useState(12);
  const [bridgeStepPct, setBridgeStepPct] = useState(8);

  // V2 MediaPipe lazy stub preview
  const [visionStatus, setVisionStatus] = useState<string | null>(null);

  const athlete = useMemo(
    () => ({
      heightCm,
      weightKg,
      ...(useCustomLimbs ? { customTrunkCm, customThighCm, customShankCm } : {}),
    }),
    [heightCm, weightKg, useCustomLimbs, customTrunkCm, customThighCm, customShankCm]
  );

  const solution = useMemo(
    () =>
      solveStaticShoulderTorque(athlete, {
        pose,
        skill,
        straddleAngleDeg,
        hipAngleDeg,
        kneeAngleDeg,
        bodyTiltDeg,
        bandAssistKg,
        ankleWeightKg,
      }),
    [athlete, pose, skill, straddleAngleDeg, hipAngleDeg, kneeAngleDeg, bodyTiltDeg, bandAssistKg, ankleWeightKg]
  );

  const bridgeLadder = useMemo(
    () =>
      prescribeAutoBridge(athlete, {
        currentPose: bridgeStartPose,
        currentMaxHoldSec: bridgeHoldSec,
        targetSkill: skill,
        targetStepPct: bridgeStepPct,
      }),
    [athlete, bridgeStartPose, bridgeHoldSec, skill, bridgeStepPct]
  );

  const mesocycle12Wk = useMemo(
    () => generate12WeekMesocycle(athlete, bridgeStartPose, bridgeHoldSec, skill, bridgeStepPct),
    [athlete, bridgeStartPose, bridgeHoldSec, skill, bridgeStepPct]
  );

  const exportMesocycleCsv = (): void => {
    const header = 'week,phase,bridge_step,progression,target_torque_nm,prescription,weekly_eq_sec\n';
    const rows = mesocycle12Wk
      .map(
        (w) =>
          `${w.week},${w.phase},${w.bridgeStepNumber},"${w.progressionLabel}",${w.targetTorqueNm},"${w.prescription}",${w.weeklyEqSecTarget}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leverlab-12wk-${skill}-mesocycle.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const advTuckVsStraddleCliff = useMemo(() => {
    const adv = solveStaticShoulderTorque(athlete, { pose: 'adv_tuck', skill });
    const str90 = solveStaticShoulderTorque(athlete, { pose: 'straddle', skill, straddleAngleDeg: 90 });
    return {
      advNm: adv.totalTorqueNm,
      str90Nm: str90.totalTorqueNm,
      jumpPct: (((str90.totalTorqueNm - adv.totalTorqueNm) / adv.totalTorqueNm) * 100).toFixed(1),
    };
  }, [athlete, skill]);

  const handleCheckVisionStub = async (): Promise<void> => {
    const mod = await import('./modules/poseVision');
    const st = await mod.loadPoseVisionEngineStatus();
    setVisionStatus(`${st.runtime} — ${st.privacyNote}`);
  };

  const bgMain = daylight ? 'bg-[#F5F6F3] text-[#101317]' : 'bg-[#101317] text-[#F1F5F9]';
  const panelCls = daylight ? 'bg-white border-[#CBD5E1]' : 'bg-[#171C22] border-[#2A323D]';
  const borderCls = daylight ? 'border-[#CBD5E1]' : 'border-[#2A323D]';
  const mutedText = daylight ? 'text-[#475569]' : 'text-[#94A3B8]';
  const accentText = daylight ? 'text-[#4D7C0F]' : 'text-[#84CC16]';

  return (
    <div className={`min-h-screen ${bgMain} flex flex-col transition-colors`}>
      {/* Compact Athletic Telemetry Header */}
      <header className={`border-b ${borderCls} ${daylight ? 'bg-white' : 'bg-[#171C22]'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 min-h-14 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#84CC16] text-[#101317] font-mono-telemetry text-xs font-extrabold flex items-center justify-center">
              LL
            </div>
            <div>
              <h1 className="font-display-lab text-base font-bold leading-none tracking-tight">
                LeverLab
              </h1>
              <p className={`text-[11px] ${mutedText} mt-0.5`}>
                Planche &amp; front lever shoulder torque
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <nav aria-label="LeverLab sections" className="flex items-center gap-1">
              {(
                [
                  { id: 'torque', icon: Activity, label: 'Torque Rig' },
                  { id: 'bridge', icon: Sliders, label: 'Auto-Bridge' },
                  { id: 'log', icon: ClipboardList, label: 'Tendon Log' },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={t.label}
                    title={t.label}
                    onClick={() => setActiveTab(t.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono-telemetry border cursor-pointer ${
                      activeTab === t.id
                        ? 'border-[#84CC16] bg-[#84CC16]/15 font-bold'
                        : `border-transparent ${mutedText}`
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => setProOpen(true)}
              className={`ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono-telemetry border cursor-pointer font-bold ${
                license.isPro
                  ? 'border-[#84CC16] bg-[#84CC16]/15 text-[#84CC16]'
                  : 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {license.isPro
                  ? license.mode === 'local_full'
                    ? 'EDITION: PRO'
                    : 'PRO'
                  : 'Edition & License'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDaylight((d) => !d)}
              aria-label="Toggle daylight or dark gym contrast mode"
              className={`ml-1 p-1.5 border ${borderCls} cursor-pointer`}
            >
              {daylight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-[#F59E0B]" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        <div className={`px-4 py-2.5 border ${panelCls} text-xs ${mutedText} flex flex-wrap items-center gap-x-4 gap-y-1`}>
          <span className={`font-mono-telemetry font-semibold ${accentText}`}>How to use:</span>
          <span>1. Enter height and weight (or custom limb lengths).</span>
          <span>2. Pick a pose or angles to compare shoulder torque.</span>
          <span>3. Use Auto-Bridge for smaller jumps and Tendon Log to track weekly load.</span>
        </div>

        {/* Summary Metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono-telemetry tabular-nums">
          <div className={`p-3.5 border ${panelCls}`}>
            <span className={`text-[10px] block ${mutedText}`}>TOTAL SHOULDER TORQUE</span>
            <span className={`text-2xl font-bold ${accentText}`}>{solution.totalTorqueNm} N·m</span>
            <span className={`text-[11px] block ${mutedText}`}>Per shoulder: {solution.perShoulderTorqueNm} N·m</span>
          </div>
          <div className={`p-3.5 border ${panelCls}`}>
            <span className={`text-[10px] block ${mutedText}`}>% OF YOUR FULL LEVER</span>
            <span className="text-2xl font-bold">{solution.percentOfFull}%</span>
            <span className={`text-[11px] block ${mutedText}`}>Full ref: {solution.fullReferenceTorqueNm} N·m</span>
          </div>
          <div className={`p-3.5 border ${panelCls}`}>
            <span className={`text-[10px] block ${mutedText}`}>COM HORIZONTAL MOMENT ARM</span>
            <span className="text-2xl font-bold text-[#F59E0B]">{solution.centerOfMassXFromShoulderCm} cm</span>
            <span className={`text-[11px] block ${mutedText}`}>Suspended mass: {(weightKg * 0.9).toFixed(1)} kg</span>
          </div>
          <div className={`p-3.5 border ${panelCls}`}>
            <span className={`text-[10px] block ${mutedText}`}>YOUR ADV. TUCK → STRADDLE CLIFF</span>
            <span className="text-2xl font-bold text-[#F59E0B]">+{advTuckVsStraddleCliff.jumpPct}%</span>
            <span className={`text-[11px] block ${mutedText}`}>
              {advTuckVsStraddleCliff.advNm} → {advTuckVsStraddleCliff.str90Nm} N·m
            </span>
          </div>
        </section>

        {/* TAB 1: INTERACTIVE TORQUE RIG */}
        {activeTab === 'torque' && (
          <div className="space-y-5">
            <BodyRigSvg solution={solution} skill={skill} bandAssistKg={bandAssistKg} daylight={daylight} />

            <section className={`grid grid-cols-1 lg:grid-cols-12 border ${panelCls}`}>
              {/* Athlete Dimensions */}
              <div className={`lg:col-span-5 p-5 border-b lg:border-b-0 lg:border-r ${borderCls} space-y-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display-lab text-sm font-bold uppercase tracking-wider">
                    Anthropometrics
                  </h2>
                  <div className="flex gap-1 text-xs font-mono-telemetry">
                    <button
                      type="button"
                      onClick={() => setSkill('front_lever')}
                      className={`px-2 py-1 border cursor-pointer ${
                        skill === 'front_lever' ? 'border-[#84CC16] bg-[#84CC16]/20 font-bold' : borderCls
                      }`}
                    >
                      Front Lever
                    </button>
                    <button
                      type="button"
                      onClick={() => setSkill('planche')}
                      className={`px-2 py-1 border cursor-pointer ${
                        skill === 'planche' ? 'border-[#84CC16] bg-[#84CC16]/20 font-bold' : borderCls
                      }`}
                    >
                      Planche
                    </button>
                    <button
                      type="button"
                      onClick={() => setSkill('back_lever')}
                      className={`px-2 py-1 border cursor-pointer ${
                        skill === 'back_lever' ? 'border-[#84CC16] bg-[#84CC16]/20 font-bold' : borderCls
                      }`}
                    >
                      Back Lever
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="height-cm">Stature Height</label>
                    <span className={`font-mono-telemetry font-bold ${accentText}`}>{heightCm} cm</span>
                  </div>
                  <input
                    id="height-cm"
                    type="range"
                    min={150}
                    max={205}
                    value={heightCm}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                    className="w-full accent-[#84CC16]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="weight-kg">Body Mass</label>
                    <span className={`font-mono-telemetry font-bold ${accentText}`}>{weightKg} kg</span>
                  </div>
                  <input
                    id="weight-kg"
                    type="range"
                    min={45}
                    max={115}
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="w-full accent-[#84CC16]"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={useCustomLimbs && license.isPro}
                    onChange={(e) => {
                      if (!license.isPro) {
                        setProOpen(true);
                        return;
                      }
                      setUseCustomLimbs(e.target.checked);
                    }}
                    className="accent-[#84CC16]"
                  />
                  <span>
                    Override Drillis–Contini ratios with tape-measured limb lengths
                    {!license.isPro && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-mono-telemetry text-[#F59E0B]">
                        <Lock className="w-2.5 h-2.5" /> Pro
                      </span>
                    )}
                  </span>
                </label>

                {useCustomLimbs && license.isPro && (
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono-telemetry">
                    <div>
                      <label htmlFor="c-trunk" className={`block text-[10px] ${mutedText}`}>Trunk (cm)</label>
                      <input
                        id="c-trunk"
                        type="number"
                        step={0.5}
                        value={customTrunkCm}
                        onChange={(e) => setCustomTrunkCm(Number(e.target.value) || 50)}
                        className={`w-full px-2 py-1 border ${borderCls} bg-transparent`}
                      />
                    </div>
                    <div>
                      <label htmlFor="c-thigh" className={`block text-[10px] ${mutedText}`}>Femur (cm)</label>
                      <input
                        id="c-thigh"
                        type="number"
                        step={0.5}
                        value={customThighCm}
                        onChange={(e) => setCustomThighCm(Number(e.target.value) || 43)}
                        className={`w-full px-2 py-1 border ${borderCls} bg-transparent`}
                      />
                    </div>
                    <div>
                      <label htmlFor="c-shank" className={`block text-[10px] ${mutedText}`}>Shank (cm)</label>
                      <input
                        id="c-shank"
                        type="number"
                        step={0.5}
                        value={customShankCm}
                        onChange={(e) => setCustomShankCm(Number(e.target.value) || 43)}
                        className={`w-full px-2 py-1 border ${borderCls} bg-transparent`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Pose, Straddle & Assist Controls */}
              <div className="lg:col-span-7 p-5 space-y-4">
                <div>
                  <span className={`block text-xs mb-2 ${mutedText}`}>Static Progression Pose</span>
                  <div className="flex flex-wrap gap-1.5">
                    {POSE_OPTIONS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPose(p.id)}
                        className={`px-2.5 py-1.5 text-xs font-mono-telemetry border cursor-pointer ${
                          pose === p.id
                            ? 'border-[#84CC16] bg-[#84CC16] text-[#101317] font-bold'
                            : borderCls
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(pose === 'straddle' || pose === 'custom') && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="straddle-deg">Straddle Abduction Angle (φ)</label>
                      <span className={`font-mono-telemetry font-bold ${accentText}`}>{straddleAngleDeg}°</span>
                    </div>
                    <input
                      id="straddle-deg"
                      type="range"
                      min={0}
                      max={140}
                      step={5}
                      value={straddleAngleDeg}
                      onChange={(e) => setStraddleAngleDeg(Number(e.target.value))}
                      className="w-full accent-[#84CC16]"
                    />
                  </div>
                )}

                {pose === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <label htmlFor="hip-deg">Hip Flexion</label>
                        <span className="font-mono-telemetry">{hipAngleDeg}°</span>
                      </div>
                      <input
                        id="hip-deg"
                        type="range"
                        min={0}
                        max={135}
                        value={hipAngleDeg}
                        onChange={(e) => setHipAngleDeg(Number(e.target.value))}
                        className="w-full accent-[#84CC16]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <label htmlFor="knee-deg">Knee Flexion</label>
                        <span className="font-mono-telemetry">{kneeAngleDeg}°</span>
                      </div>
                      <input
                        id="knee-deg"
                        type="range"
                        min={0}
                        max={140}
                        value={kneeAngleDeg}
                        onChange={(e) => setKneeAngleDeg(Number(e.target.value))}
                        className="w-full accent-[#84CC16]"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="tilt-deg">Incline Body Tilt (θ)</label>
                      <span className={`font-mono-telemetry font-bold ${accentText}`}>{bodyTiltDeg}°</span>
                    </div>
                    <input
                      id="tilt-deg"
                      type="range"
                      min={0}
                      max={45}
                      step={5}
                      value={bodyTiltDeg}
                      onChange={(e) => setBodyTiltDeg(Number(e.target.value))}
                      className="w-full accent-[#84CC16]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="band-kg">Hip Band Assist</label>
                      <span className="font-mono-telemetry text-[#F59E0B] font-bold">-{bandAssistKg} kg</span>
                    </div>
                    <input
                      id="band-kg"
                      type="range"
                      min={0}
                      max={35}
                      step={0.5}
                      value={bandAssistKg}
                      onChange={(e) => setBandAssistKg(Number(e.target.value))}
                      className="w-full accent-[#F59E0B]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="ankle-kg">Ankle Weight</label>
                      <span className="font-mono-telemetry font-bold">+{ankleWeightKg} kg</span>
                    </div>
                    <input
                      id="ankle-kg"
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={ankleWeightKg}
                      onChange={(e) => setAnkleWeightKg(Number(e.target.value))}
                      className="w-full accent-[#84CC16]"
                    />
                  </div>
                </div>

                {/* V2 Lazy MediaPipe WASM Module Hook */}
                <div className={`pt-3 border-t ${borderCls} flex flex-wrap items-center justify-between gap-2 text-xs`}>
                  <span className={mutedText}>
                    {visionStatus || 'V2 LeverLab Vision: Local browser MediaPipe Pose angle-check module ready.'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCheckVisionStub}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-mono-telemetry border ${borderCls} hover:border-[#84CC16] cursor-pointer`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Inspect V2 Pose Engine
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: AUTO-BRIDGE PROGRESSION LADDER */}
        {activeTab === 'bridge' && (
          <section className={`border ${panelCls} p-5 space-y-4`}>
            <div className={`flex flex-wrap items-end justify-between gap-4 border-b ${borderCls} pb-4`}>
              <div>
                <h2 className="font-display-lab text-base font-bold">
                  6-Step Auto-Bridge Progression Ladder (Tendon-Safe 6%–10% Torque Steps)
                </h2>
                <p className={`text-xs ${mutedText}`}>
                  Eliminates the +{advTuckVsStraddleCliff.jumpPct}% Adv. Tuck → Straddle cliff with exact band tension and straddle angle narrowing for {heightCm} cm / {weightKg} kg.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-mono-telemetry">
                <div>
                  <label htmlFor="b-pose" className={`block text-[10px] ${mutedText}`}>Current Pose</label>
                  <select
                    id="b-pose"
                    value={bridgeStartPose}
                    onChange={(e) =>
                      setBridgeStartPose(e.target.value as 'tuck' | 'adv_tuck' | 'one_leg' | 'straddle' | 'half_lay')
                    }
                    className={`px-2 py-1 border ${borderCls} bg-transparent`}
                  >
                    <option value="tuck" className="text-black">Tuck</option>
                    <option value="adv_tuck" className="text-black">Adv. Tuck</option>
                    <option value="one_leg" className="text-black">One-Leg</option>
                    <option value="half_lay" className="text-black">Half-Lay</option>
                    <option value="straddle" className="text-black">Straddle 90°</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="b-hold" className={`block text-[10px] ${mutedText}`}>Max Hold (s)</label>
                  <input
                    id="b-hold"
                    type="number"
                    min={3}
                    max={45}
                    value={bridgeHoldSec}
                    onChange={(e) => setBridgeHoldSec(Math.max(3, Number(e.target.value) || 10))}
                    className={`w-16 px-2 py-1 border ${borderCls} bg-transparent`}
                  />
                </div>
                <div>
                  <label htmlFor="b-step" className={`block text-[10px] ${mutedText}`}>Step Jump %</label>
                  <input
                    id="b-step"
                    type="number"
                    min={6}
                    max={10}
                    value={bridgeStepPct}
                    onChange={(e) => setBridgeStepPct(Math.min(10, Math.max(6, Number(e.target.value) || 8)))}
                    className={`w-16 px-2 py-1 border ${borderCls} bg-transparent`}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {bridgeLadder.map((step) => (
                <div
                  key={step.stepNumber}
                  className={`p-3.5 border ${borderCls} flex flex-wrap items-center justify-between gap-3`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-telemetry text-[11px] px-1.5 py-0.5 bg-[#84CC16] text-[#101317] font-bold">
                        STEP {step.stepNumber}
                      </span>
                      <h3 className="text-sm font-bold">{step.label}</h3>
                    </div>
                    <p className={`text-xs ${mutedText}`}>{step.cue}</p>
                    <p className="text-[11px] font-mono-telemetry text-[#F59E0B]">{step.prescribedSetsAndHold}</p>
                  </div>
                  <div className="text-right font-mono-telemetry tabular-nums">
                    <span className={`block text-base font-bold ${accentText}`}>{step.targetTorqueNm} N·m</span>
                    <span className={`block text-xs ${mutedText}`}>
                      {step.percentOfFull}% Full (+{step.deltaFromPrevPct}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 12-Week Periodized Straight-Arm Mesocycle (With Wk 4/8/12 Tendon Deloads) */}
            <div className={`pt-4 border-t ${borderCls} space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display-lab text-sm font-bold">
                    12-Week Periodized Mesocycle (Includes Mandatory Wk 4 / 8 / 12 Tendon Deloads)
                  </h3>
                  <p className={`text-xs ${mutedText}`}>
                    Auto-mapped to your {heightCm} cm / {weightKg} kg Auto-Bridge targets with 60% deload weeks for collagen remodeling.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!license.isPro) {
                      setProOpen(true);
                      return;
                    }
                    exportMesocycleCsv();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-telemetry border border-[#84CC16] bg-[#84CC16]/15 font-bold cursor-pointer"
                >
                  {license.isPro ? <Download className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3 text-[#F59E0B]" />}
                  {license.isPro ? 'Export 12-Wk Plan CSV' : 'Export 12-Wk CSV (Pro)'}
                </button>
              </div>
              <div className="overflow-x-auto border border-[#2A323D]/60">
                <table className="w-full text-xs font-mono-telemetry tabular-nums">
                  <thead className={`border-b ${borderCls} ${mutedText}`}>
                    <tr>
                      <th className="text-left py-2 px-3">Wk</th>
                      <th className="text-left py-2 px-2">Phase</th>
                      <th className="text-left py-2 px-2">Progression Target</th>
                      <th className="text-left py-2 px-2">Prescription</th>
                      <th className="text-right py-2 px-3">Eq. Vol</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${borderCls}`}>
                    {mesocycle12Wk.map((wk) => (
                      <tr key={wk.week} className={wk.phase === 'Tendon Deload' ? 'bg-[#F59E0B]/10' : ''}>
                        <td className="py-1.5 px-3 font-bold">W{wk.week}</td>
                        <td className={`py-1.5 px-2 font-sans ${wk.phase === 'Tendon Deload' ? 'text-[#F59E0B] font-semibold' : ''}`}>
                          {wk.phase}
                        </td>
                        <td className="py-1.5 px-2 font-sans">{wk.progressionLabel} ({wk.targetTorqueNm} N·m)</td>
                        <td className="py-1.5 px-2">{wk.prescription}</td>
                        <td className="py-1.5 px-3 text-right font-semibold">{wk.weeklyEqSecTarget} eq·s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: TENDON-SAFE VOLUME LOG */}
        {activeTab === 'log' && (
          <WorkoutLogPanel
            currentSkill={skill}
            currentPose={pose}
            currentTorqueNm={solution.totalTorqueNm}
            currentPercentOfFull={solution.percentOfFull}
            daylight={daylight}
          />
        )}
      </main>

      {/* General Fitness & Tendon Safety Disclaimer */}
      <footer className={`border-t ${borderCls} ${daylight ? 'bg-white' : 'bg-[#171C22]'} py-4 mt-6`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-start gap-2.5 text-xs">
          <ShieldAlert className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
          <p className={mutedText}>
            <strong>Informational &amp; General Fitness Disclaimer:</strong> LeverLab estimates static joint torque from published Winter (2009) / de Leva (1996) / Drillis &amp; Contini anthropometric tables for educational training planning only and does not provide medical or physical therapy advice. Stop immediately if you experience sharp distal biceps, elbow, or wrist pain and consult a qualified sports physiotherapist.
          </p>
        </div>
      </footer>
      <ProLicenseModal
        open={proOpen}
        onClose={() => setProOpen(false)}
        daylight={daylight}
        license={license}
        isLocalHost={isLocalHost}
        onActivate={handleActivate}
        onSimulateFree={handleSimulateFree}
        onRestoreLocalFull={handleRestoreLocalFull}
      />
    </div>
  );
};

export default App;
