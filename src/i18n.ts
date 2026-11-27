import { ProgressionBridgeStep } from './engine/biomechanics/bridgePrescriber';
import { PresetPose, SkillType } from './engine/biomechanics/torqueSolver';

export type LeverLang = 'zh-TW' | 'en';

const LVLB_LANG_KEY = 'leverlab_lang_v1';

export function loadInitialLeverLang(): LeverLang {
  try {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('lang');
      if (q === 'en' || q === 'zh-TW') return q;
      const saved = window.localStorage.getItem(LVLB_LANG_KEY);
      if (saved === 'en' || saved === 'zh-TW') return saved;
    }
  } catch (err) {
    console.warn('LeverLab language load fallback:', err);
  }
  return 'zh-TW';
}

export function saveLeverLang(lang: LeverLang): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LVLB_LANG_KEY, lang);
    }
  } catch (err) {
    console.warn('LeverLab language save fallback:', err);
  }
}

export function tr(lang: LeverLang, zh: string, en: string): string {
  return lang === 'zh-TW' ? zh : en;
}

export function formatSkillLabel(lang: LeverLang, skill: SkillType): string {
  if (lang === 'en') {
    return skill === 'planche' ? 'Planche' : skill === 'back_lever' ? 'Back Lever' : 'Front Lever';
  }
  return skill === 'planche'
    ? '俄式挺身 Planche'
    : skill === 'back_lever'
    ? '後水平 Back Lever'
    : '前水平 Front Lever';
}

export function formatPoseLabel(lang: LeverLang, pose: string): string {
  const mapZh: Record<string, string> = {
    tuck: '團身 Tuck',
    adv_tuck: '進階團身 Adv. Tuck',
    one_leg: '單腿伸展 One-Leg',
    half_lay: '半展體 Half-Lay',
    straddle: '分腿 Straddle',
    full: '全展體 Full',
    custom: '自訂關節角 Custom',
  };
  const mapEn: Record<string, string> = {
    tuck: 'Tuck',
    adv_tuck: 'Adv. Tuck',
    one_leg: 'One-Leg',
    half_lay: 'Half-Lay',
    straddle: 'Straddle',
    full: 'Full',
    custom: 'Custom Angles',
  };
  return (lang === 'zh-TW' ? mapZh[pose as PresetPose] : mapEn[pose as PresetPose]) ?? pose;
}

export function localizeBridgeStep(
  lang: LeverLang,
  step: ProgressionBridgeStep,
  skill: SkillType
): { label: string; cue: string } {
  if (lang === 'en') {
    return { label: step.label, cue: step.cue };
  }
  if (step.pose === 'full') {
    const sk = formatSkillLabel('zh-TW', skill);
    return {
      label: `全展體無輔助支撐（${sk}）`,
      cue:
        skill === 'back_lever'
          ? '循序強化反握肱二頭肌遠端肌腱耐受度，收緊核心維持 3–5 秒標準水平靜止。'
          : '鎖定骨盆後傾（PPT）並壓低前引肩胛，累積高品質 3–5 秒標準水平靜止。',
    };
  }
  if (step.bandAssistKg > 0) {
    return {
      label: `90° 分腿 ＋ 骨盆彈力帶輔助 ${step.bandAssistKg} kg`,
      cue: `於髖關節懸掛約 ${step.bandAssistKg} kg 拉力之彈力帶，安全跨越進階團身至分腿的 +47% 力矩斷崖。`,
    };
  }
  return {
    label:
      step.straddleAngleDeg <= 12
        ? `窄分腿併攏過渡（張角 ${step.straddleAngleDeg}°）`
        : `漸進收窄分腿張角（φ = ${step.straddleAngleDeg}°）`,
    cue: '無須彈力帶：透過地面膠帶標記逐步縮小雙腿外展角度，精確控制每次力矩增幅。',
  };
}

export function formatPhaseLabel(
  lang: LeverLang,
  phase: 'Accumulation' | 'Intensification' | 'Tendon Deload'
): string {
  if (lang === 'en') return phase;
  if (phase === 'Tendon Deload') return '肌腱減量週 (Deload)';
  if (phase === 'Intensification') return '強度提升期';
  return '容量累積期';
}
