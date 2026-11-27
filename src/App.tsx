import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Camera,
  ClipboardList,
  Download,
  Globe,
  KeyRound,
  Lock,
  Moon,
  ShieldAlert,
  Sliders,
  Sun,
} from 'lucide-react';
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
import {
  formatPhaseLabel,
  formatPoseLabel,
  formatSkillLabel,
  LeverLang,
  loadInitialLeverLang,
  localizeBridgeStep,
  saveLeverLang,
  tr,
} from './i18n';

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

const POSE_IDS: PresetPose[] = ['tuck', 'adv_tuck', 'one_leg', 'half_lay', 'straddle', 'full', 'custom'];

export const App: React.FC = () => {
  const [daylight, setDaylight] = useState(false);
  const [activeTab, setActiveTab] = useState<'torque' | 'bridge' | 'log'>('torque');
  const [isLocalHost] = useState<boolean>(() => detectLocalHost());
  const [license, setLicense] = useState<LeverLabLicenseState>(() => loadInitialLeverLabLicense(detectLocalHost()));
  const [proOpen, setProOpen] = useState(false);
  const [lang, setLang] = useState<LeverLang>(() => loadInitialLeverLang());

  useEffect(() => {
    document.documentElement.lang = lang === 'zh-TW' ? 'zh-Hant' : 'en';
    saveLeverLang(lang);
  }, [lang]);

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

  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(70);
  const [useCustomLimbs, setUseCustomLimbs] = useState(false);
  const [customTrunkCm, setCustomTrunkCm] = useState(50.4);
  const [customThighCm, setCustomThighCm] = useState(42.9);
  const [customShankCm, setCustomShankCm] = useState(43.1);

  const [skill, setSkill] = useState<SkillType>('front_lever');
  const [pose, setPose] = useState<PresetPose>('straddle');
  const [straddleAngleDeg, setStraddleAngleDeg] = useState(90);
  const [hipAngleDeg, setHipAngleDeg] = useState(45);
  const [kneeAngleDeg, setKneeAngleDeg] = useState(45);
  const [bodyTiltDeg, setBodyTiltDeg] = useState(0);
  const [bandAssistKg, setBandAssistKg] = useState(0);
  const [ankleWeightKg, setAnkleWeightKg] = useState(0);

  const [bridgeStartPose, setBridgeStartPose] = useState<'tuck' | 'adv_tuck' | 'one_leg' | 'straddle' | 'half_lay'>('adv_tuck');
  const [bridgeHoldSec, setBridgeHoldSec] = useState(12);
  const [bridgeStepPct, setBridgeStepPct] = useState(8);

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
                {tr(lang, '街頭健身靜態力矩＆直臂肌腱負荷工作台', 'Planche & front lever shoulder torque')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <nav aria-label="LeverLab sections" className="flex items-center gap-1">
              {(
                [
                  { id: 'torque', icon: Activity, label: tr(lang, '靜態力矩儀', 'Torque Rig') },
                  { id: 'bridge', icon: Sliders, label: tr(lang, '進階微調橋接', 'Auto-Bridge') },
                  { id: 'log', icon: ClipboardList, label: tr(lang, '肌腱負荷日誌', 'Tendon Log') },
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
                    ? tr(lang, '版本：PRO', 'EDITION: PRO')
                    : 'PRO'
                  : tr(lang, '方案與授權', 'Edition & License')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLang((l) => (l === 'zh-TW' ? 'en' : 'zh-TW'))}
              aria-label="Switch interface language"
              className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-mono-telemetry border ${borderCls} cursor-pointer`}
            >
              <Globe className="w-3.5 h-3.5 text-[#84CC16]" />
              <span>{lang === 'zh-TW' ? '繁中 | EN' : 'EN | 繁中'}</span>
            </button>

            <button
              type="button"
              onClick={() => setDaylight((d) => !d)}
              aria-label="Toggle daylight or dark gym contrast mode"
              className={`p-1.5 border ${borderCls} cursor-pointer`}
            >
              {daylight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-[#F59E0B]" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        <div className={`px-4 py-2.5 border ${panelCls} text-xs ${mutedText} flex flex-wrap items-center gap-x-4 gap-y-1`}>
          <span className={`font-mono-telemetry font-semibold ${accentText}`}>
            {tr(lang, '使用步驟：', 'How to use:')}
          </span>
          <span>{tr(lang, '1. 輸入身高與體重（或捲尺實測肢段長度）。', '1. Enter height and weight (or custom limb lengths).')}</span>
          <span>{tr(lang, '2. 選擇動作姿勢與分腿／彈力帶參數，即時比較肩關節力矩。', '2. Pick a pose or angles to compare shoulder torque.')}</span>
          <span>{tr(lang, '3. 切換「進階微調橋接」安排 6%–10% 安全增幅，並用「肌腱負荷日誌」監控週訓練量。', '3. Use Auto-Bridge for smaller jumps and Tendon Log to track weekly load.')}</span>
        </div>

        {/* Summary Metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono-telemetry tabular-nums">
          <div className={`p-3.5 border ${panelCls}`}>
            <span className={`text-[10px] block ${mutedText}`}>
              {tr(lang, '雙肩總靜態力矩', 'TOTAL SHOULDER TORQUE')}
            </span>
            <span className={`text-2xl font-bold ${accentText}`}>{solution.totalTorqueNm} N·m</span>
            <span className={`text-[11px] block ${mutedText}`}>
              {tr(lang, `單側肩關節：${solution.perShoulderTorqueNm} N·m`, `Per shoulder: ${solution.perShoulderTorqueNm} N·m`)}
            </span>
          </div>
          <div className={`p-3.5 border ${panelCls}`}>
            <span className={`text-[10px] block ${mutedText}`}>
              {tr(lang, '佔全展體力矩百分比', '% OF YOUR FULL LEVER')}
            </span>
            <span className="text-2xl font-bold">{solution.percentOfFull}%</span>
            <span className={`text-[11px] block ${mutedText}`}>
              {tr(lang, `全展體基準：${solution.fullReferenceTorqueNm} N·m`, `Full ref: ${solution.fullReferenceTorqueNm} N·m`)}
            </span>
          </div>
          <div className={`p-3.5 border ${panelCls}`}>
            <span className={`text-[10px] block ${mutedText}`}>
              {tr(lang, '質心水平力臂距離 (COM)', 'COM HORIZONTAL MOMENT ARM')}
            </span>
            <span className="text-2xl font-bold text-[#F59E0B]">{solution.centerOfMassXFromShoulderCm} cm</span>
            <span className={`text-[11px] block ${mutedText}`}>
              {tr(lang, `懸空質量：${(weightKg * 0.9).toFixed(1)} kg`, `Suspended mass: ${(weightKg * 0.9).toFixed(1)} kg`)}
            </span>
          </div>
          <div className={`p-3.5 border ${panelCls}`}>
            <span className={`text-[10px] block ${mutedText}`}>
              {tr(lang, '進階團身 → 分腿力矩斷崖', 'YOUR ADV. TUCK → STRADDLE CLIFF')}
            </span>
            <span className="text-2xl font-bold text-[#F59E0B]">+{advTuckVsStraddleCliff.jumpPct}%</span>
            <span className={`text-[11px] block ${mutedText}`}>
              {advTuckVsStraddleCliff.advNm} → {advTuckVsStraddleCliff.str90Nm} N·m
            </span>
          </div>
        </section>

        {/* TAB 1: INTERACTIVE TORQUE RIG */}
        {activeTab === 'torque' && (
          <div className="space-y-5">
            <BodyRigSvg
              lang={lang}
              solution={solution}
              skill={skill}
              bandAssistKg={bandAssistKg}
              daylight={daylight}
            />

            <section className={`grid grid-cols-1 lg:grid-cols-12 border ${panelCls}`}>
              {/* Athlete Dimensions */}
              <div className={`lg:col-span-5 p-5 border-b lg:border-b-0 lg:border-r ${borderCls} space-y-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display-lab text-sm font-bold uppercase tracking-wider">
                    {tr(lang, '人體測量參數', 'Anthropometrics')}
                  </h2>
                  <div className="flex flex-wrap gap-1 text-xs font-mono-telemetry">
                    {(['front_lever', 'planche', 'back_lever'] as const).map((sk) => (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => setSkill(sk)}
                        className={`px-2 py-1 border cursor-pointer ${
                          skill === sk ? 'border-[#84CC16] bg-[#84CC16]/20 font-bold' : borderCls
                        }`}
                      >
                        {formatSkillLabel(lang, sk)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="height-cm">{tr(lang, '身高 (Stature Height)', 'Stature Height')}</label>
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
                    <label htmlFor="weight-kg">{tr(lang, '體重 (Body Mass)', 'Body Mass')}</label>
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
                    {tr(
                      lang,
                      '以捲尺實測軀幹／大腿／小腿長度覆寫標準比例',
                      'Override Drillis–Contini ratios with tape-measured limb lengths'
                    )}
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
                      <label htmlFor="c-trunk" className={`block text-[10px] ${mutedText}`}>
                        {tr(lang, '軀幹長 (cm)', 'Trunk (cm)')}
                      </label>
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
                      <label htmlFor="c-thigh" className={`block text-[10px] ${mutedText}`}>
                        {tr(lang, '大腿股骨 (cm)', 'Femur (cm)')}
                      </label>
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
                      <label htmlFor="c-shank" className={`block text-[10px] ${mutedText}`}>
                        {tr(lang, '小腿脛骨 (cm)', 'Shank (cm)')}
                      </label>
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
                  <span className={`block text-xs mb-2 ${mutedText}`}>
                    {tr(lang, '靜態退階／進階姿勢', 'Static Progression Pose')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {POSE_IDS.map((pid) => (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => setPose(pid)}
                        className={`px-2.5 py-1.5 text-xs font-mono-telemetry border cursor-pointer ${
                          pose === pid
                            ? 'border-[#84CC16] bg-[#84CC16] text-[#101317] font-bold'
                            : borderCls
                        }`}
                      >
                        {formatPoseLabel(lang, pid)}
                      </button>
                    ))}
                  </div>
                </div>

                {(pose === 'straddle' || pose === 'custom') && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="straddle-deg">
                        {tr(lang, '雙腿外展分腿張角 (φ)', 'Straddle Abduction Angle (φ)')}
                      </label>
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
                        <label htmlFor="hip-deg">{tr(lang, '髖關節屈曲角', 'Hip Flexion')}</label>
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
                        <label htmlFor="knee-deg">{tr(lang, '膝關節屈曲角', 'Knee Flexion')}</label>
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
                      <label htmlFor="tilt-deg">{tr(lang, '身體仰角／斜度 (θ)', 'Incline Body Tilt (θ)')}</label>
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
                      <label htmlFor="band-kg">{tr(lang, '骨盆彈力帶輔助', 'Hip Band Assist')}</label>
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
                      <label htmlFor="ankle-kg">{tr(lang, '腳踝負重沙袋', 'Ankle Weight')}</label>
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
                    {visionStatus ||
                      tr(
                        lang,
                        'V2 LeverLab 視覺模組：純瀏覽器本地端 MediaPipe 關節角度檢測架構已就緒。',
                        'V2 LeverLab Vision: Local browser MediaPipe Pose angle-check module ready.'
                      )}
                  </span>
                  <button
                    type="button"
                    onClick={handleCheckVisionStub}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-mono-telemetry border ${borderCls} hover:border-[#84CC16] cursor-pointer`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {tr(lang, '檢視 V2 姿態引擎', 'Inspect V2 Pose Engine')}
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
                  {tr(
                    lang,
                    '6 階自動進階微調橋接階梯（嚴格控制每次 6%–10% 肌腱安全力矩增幅）',
                    '6-Step Auto-Bridge Progression Ladder (Tendon-Safe 6%–10% Torque Steps)'
                  )}
                </h2>
                <p className={`text-xs ${mutedText}`}>
                  {tr(
                    lang,
                    `針對 ${heightCm} cm / ${weightKg} kg 體態，以精確彈力帶磅數與分腿張角收窄消除 +${advTuckVsStraddleCliff.jumpPct}% 的進階團身→分腿斷崖。`,
                    `Eliminates the +${advTuckVsStraddleCliff.jumpPct}% Adv. Tuck → Straddle cliff with exact band tension and straddle angle narrowing for ${heightCm} cm / ${weightKg} kg.`
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-mono-telemetry">
                <div>
                  <label htmlFor="b-pose" className={`block text-[10px] ${mutedText}`}>
                    {tr(lang, '目前穩定姿勢', 'Current Pose')}
                  </label>
                  <select
                    id="b-pose"
                    value={bridgeStartPose}
                    onChange={(e) =>
                      setBridgeStartPose(e.target.value as 'tuck' | 'adv_tuck' | 'one_leg' | 'straddle' | 'half_lay')
                    }
                    className={`px-2 py-1 border ${borderCls} bg-transparent`}
                  >
                    <option value="tuck" className="text-black">{formatPoseLabel(lang, 'tuck')}</option>
                    <option value="adv_tuck" className="text-black">{formatPoseLabel(lang, 'adv_tuck')}</option>
                    <option value="one_leg" className="text-black">{formatPoseLabel(lang, 'one_leg')}</option>
                    <option value="half_lay" className="text-black">{formatPoseLabel(lang, 'half_lay')}</option>
                    <option value="straddle" className="text-black">{formatPoseLabel(lang, 'straddle')} 90°</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="b-hold" className={`block text-[10px] ${mutedText}`}>
                    {tr(lang, '極限秒數 (s)', 'Max Hold (s)')}
                  </label>
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
                  <label htmlFor="b-step" className={`block text-[10px] ${mutedText}`}>
                    {tr(lang, '每階增幅 %', 'Step Jump %')}
                  </label>
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
              {bridgeLadder.map((step) => {
                const loc = localizeBridgeStep(lang, step, skill);
                return (
                  <div
                    key={step.stepNumber}
                    className={`p-3.5 border ${borderCls} flex flex-wrap items-center justify-between gap-3`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-telemetry text-[11px] px-1.5 py-0.5 bg-[#84CC16] text-[#101317] font-bold">
                          STEP {step.stepNumber}
                        </span>
                        <h3 className="text-sm font-bold">{loc.label}</h3>
                      </div>
                      <p className={`text-xs ${mutedText}`}>{loc.cue}</p>
                      <p className="text-[11px] font-mono-telemetry text-[#F59E0B]">{step.prescribedSetsAndHold}</p>
                    </div>
                    <div className="text-right font-mono-telemetry tabular-nums">
                      <span className={`block text-base font-bold ${accentText}`}>{step.targetTorqueNm} N·m</span>
                      <span className={`block text-xs ${mutedText}`}>
                        {step.percentOfFull}% Full (+{step.deltaFromPrevPct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 12-Week Periodized Straight-Arm Mesocycle */}
            <div className={`pt-4 border-t ${borderCls} space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display-lab text-sm font-bold">
                    {tr(
                      lang,
                      '12 週週期化直臂課表（內建第 4 / 8 / 12 週膠原蛋白重塑強制減量週）',
                      '12-Week Periodized Mesocycle (Includes Mandatory Wk 4 / 8 / 12 Tendon Deloads)'
                    )}
                  </h3>
                  <p className={`text-xs ${mutedText}`}>
                    {tr(
                      lang,
                      `自動對應您的 ${heightCm} cm / ${weightKg} kg 橋接階梯，每 4 週安排減量保護肱二頭肌遠端肌腱。`,
                      `Auto-mapped to your ${heightCm} cm / ${weightKg} kg Auto-Bridge targets with 60% deload weeks for collagen remodeling.`
                    )}
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
                  {license.isPro
                    ? tr(lang, '匯出 12 週課表 CSV', 'Export 12-Wk Plan CSV')
                    : tr(lang, '匯出 12 週課表 CSV (Pro)', 'Export 12-Wk CSV (Pro)')}
                </button>
              </div>
              <div className="overflow-x-auto border border-[#2A323D]/60">
                <table className="w-full text-xs font-mono-telemetry tabular-nums">
                  <thead className={`border-b ${borderCls} ${mutedText}`}>
                    <tr>
                      <th className="text-left py-2 px-3">{tr(lang, '週次', 'Wk')}</th>
                      <th className="text-left py-2 px-2">{tr(lang, '週期階段', 'Phase')}</th>
                      <th className="text-left py-2 px-2">{tr(lang, '目標動作與力矩', 'Progression Target')}</th>
                      <th className="text-left py-2 px-2">{tr(lang, '組數與秒數處方', 'Prescription')}</th>
                      <th className="text-right py-2 px-3">{tr(lang, '週當量負荷', 'Eq. Vol')}</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${borderCls}`}>
                    {mesocycle12Wk.map((wk) => {
                      const stepMatch = bridgeLadder.find((s) => s.stepNumber === wk.bridgeStepNumber);
                      const progLbl = stepMatch
                        ? localizeBridgeStep(lang, stepMatch, skill).label
                        : wk.progressionLabel;
                      return (
                        <tr key={wk.week} className={wk.phase === 'Tendon Deload' ? 'bg-[#F59E0B]/10' : ''}>
                          <td className="py-1.5 px-3 font-bold">W{wk.week}</td>
                          <td className={`py-1.5 px-2 font-sans ${wk.phase === 'Tendon Deload' ? 'text-[#F59E0B] font-semibold' : ''}`}>
                            {formatPhaseLabel(lang, wk.phase)}
                          </td>
                          <td className="py-1.5 px-2 font-sans">{progLbl} ({wk.targetTorqueNm} N·m)</td>
                          <td className="py-1.5 px-2">{wk.prescription}</td>
                          <td className="py-1.5 px-3 text-right font-semibold">{wk.weeklyEqSecTarget} eq·s</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: TENDON-SAFE VOLUME LOG */}
        {activeTab === 'log' && (
          <WorkoutLogPanel
            lang={lang}
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
            <strong>{tr(lang, '運動科學資訊與非醫療免責聲明：', 'Informational & General Fitness Disclaimer:')}</strong>{' '}
            {tr(
              lang,
              'LeverLab 依據公開發表之 Winter (2009)／de Leva (1996)／Drillis & Contini 人體生物力學文獻估算關節靜態力矩，僅供一般訓練規劃與教學參考，不構成醫療診斷或物理治療建議。若訓練時出現遠端肱二頭肌肌腱、手肘或手腕刺痛，請立即停止訓練並諮詢運動醫學專科醫師或物理治療師。',
              'LeverLab estimates static joint torque from published Winter (2009) / de Leva (1996) / Drillis & Contini anthropometric tables for educational training planning only and does not provide medical or physical therapy advice. Stop immediately if you experience sharp distal biceps, elbow, or wrist pain and consult a qualified sports physiotherapist.'
            )}
          </p>
        </div>
      </footer>
      <ProLicenseModal
        lang={lang}
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
