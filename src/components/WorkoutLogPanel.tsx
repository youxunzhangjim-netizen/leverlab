import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Pause, Play, Plus, RotateCcw, Timer, Trash2, Upload } from 'lucide-react';
import { z } from 'zod';
import { PresetPose, SkillType } from '../engine/biomechanics/torqueSolver';
import { evaluateAcwrTendonSafety } from '../engine/biomechanics/acwrAndPeriodization';
import { formatPoseLabel, formatSkillLabel, LeverLang, tr } from '../i18n';

const LogEntrySchema = z.object({
  id: z.string(),
  dateIso: z.string(),
  weekBucket: z.enum(['current', 'previous']),
  skill: z.enum(['planche', 'front_lever', 'back_lever']),
  pose: z.string(),
  sets: z.number().int().min(1).max(20),
  holdSec: z.number().min(1).max(120),
  percentOfFull: z.number().min(10).max(150),
  torqueNm: z.number().min(10).max(800),
});

export type WorkoutEntry = z.infer<typeof LogEntrySchema>;

const STORAGE_KEY = 'leverlab_workout_log_v1';

const SEED_ENTRIES: WorkoutEntry[] = [
  {
    id: 'seed-prev-1',
    dateIso: 'Last Week — Mon',
    weekBucket: 'previous',
    skill: 'front_lever',
    pose: 'adv_tuck',
    sets: 5,
    holdSec: 10,
    percentOfFull: 62.0,
    torqueNm: 168.1,
  },
  {
    id: 'seed-prev-2',
    dateIso: 'Last Week — Thu',
    weekBucket: 'previous',
    skill: 'front_lever',
    pose: 'adv_tuck',
    sets: 5,
    holdSec: 10,
    percentOfFull: 62.0,
    torqueNm: 168.1,
  },
  {
    id: 'seed-curr-1',
    dateIso: 'This Week — Mon',
    weekBucket: 'current',
    skill: 'front_lever',
    pose: 'straddle',
    sets: 5,
    holdSec: 8,
    percentOfFull: 91.1,
    torqueNm: 247.0,
  },
];

function loadEntries(): WorkoutEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_ENTRIES;
    const parsed = z.array(LogEntrySchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : SEED_ENTRIES;
  } catch (err) {
    console.warn('Failed to parse workout log:', err);
    return SEED_ENTRIES;
  }
}

interface Props {
  lang?: LeverLang;
  currentSkill: SkillType;
  currentPose: PresetPose;
  currentTorqueNm: number;
  currentPercentOfFull: number;
  daylight: boolean;
}

export const WorkoutLogPanel: React.FC<Props> = ({
  lang = 'zh-TW',
  currentSkill,
  currentPose,
  currentTorqueNm,
  currentPercentOfFull,
  daylight,
}) => {
  const [entries, setEntries] = useState<WorkoutEntry[]>(() => loadEntries());
  const [sets, setSets] = useState(5);
  const [holdSec, setHoldSec] = useState(8);
  const [spikeThresholdPct, setSpikeThresholdPct] = useState(20);
  const [importError, setImportError] = useState<string | null>(null);

  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchTenths, setStopwatchTenths] = useState(0);
  const [restSecLeft, setRestSecLeft] = useState(0);

  useEffect(() => {
    if (!stopwatchRunning) return;
    const id = window.setInterval(() => setStopwatchTenths((t) => t + 1), 100);
    return () => window.clearInterval(id);
  }, [stopwatchRunning]);

  useEffect(() => {
    if (restSecLeft <= 0) return;
    const id = window.setInterval(() => setRestSecLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [restSecLeft]);

  const persist = (next: WorkoutEntry[]): void => {
    setEntries(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('Could not persist workout log:', err);
    }
  };

  const addCurrentSet = (): void => {
    const next: WorkoutEntry = {
      id: `log-${Date.now()}`,
      dateIso: new Date().toISOString().slice(0, 10),
      weekBucket: 'current',
      skill: currentSkill,
      pose: currentPose,
      sets,
      holdSec,
      percentOfFull: currentPercentOfFull,
      torqueNm: currentTorqueNm,
    };
    persist([next, ...entries]);
  };

  const deleteEntry = (id: string): void => {
    persist(entries.filter((e) => e.id !== id));
  };

  const stats = useMemo(() => {
    const vol = (bucket: 'current' | 'previous') =>
      entries
        .filter((e) => e.weekBucket === bucket)
        .reduce((acc, e) => acc + e.sets * e.holdSec * (e.percentOfFull / 100), 0);

    const prevVol = vol('previous');
    const currVol = vol('current');
    const wowPct = prevVol > 0 ? ((currVol - prevVol) / prevVol) * 100 : 0;
    const acwr = evaluateAcwrTendonSafety([
      { weekOffset: 0, torqueVolumeEqSec: currVol },
      { weekOffset: 1, torqueVolumeEqSec: prevVol },
      { weekOffset: 2, torqueVolumeEqSec: prevVol * 0.95 },
      { weekOffset: 3, torqueVolumeEqSec: prevVol * 0.9 },
    ]);
    return {
      prevVol: Number(prevVol.toFixed(1)),
      currVol: Number(currVol.toFixed(1)),
      wowPct: Number(wowPct.toFixed(1)),
      isSpike: prevVol > 0 && wowPct > spikeThresholdPct,
      acwr,
    };
  }, [entries, spikeThresholdPct]);

  const exportJson = (): void => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leverlab-straight-arm-log.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = (): void => {
    const header = 'date,week,skill,pose,sets,hold_sec,percent_full,torque_nm,weighted_torque_sec\n';
    const rows = entries
      .map(
        (e) =>
          `${e.dateIso},${e.weekBucket},${e.skill},${e.pose},${e.sets},${e.holdSec},${e.percentOfFull},${e.torqueNm},${(
            e.sets *
            e.holdSec *
            (e.percentOfFull / 100)
          ).toFixed(1)}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leverlab-straight-arm-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = z.array(LogEntrySchema).safeParse(JSON.parse(String(reader.result)));
        if (!parsed.success) {
          setImportError(tr(lang, 'JSON 備份檔格式驗證失敗。', 'Invalid LeverLab JSON backup schema.'));
          return;
        }
        setImportError(null);
        persist(parsed.data);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const borderCls = daylight ? 'border-[#CBD5E1]' : 'border-[#2A323D]';
  const cardCls = daylight ? 'bg-white' : 'bg-[#171C22]';
  const subCls = daylight ? 'bg-[#F8FAFC]' : 'bg-[#101317]';
  const mutedText = daylight ? 'text-[#475569]' : 'text-[#94A3B8]';

  const zoneLabelLocalized =
    lang === 'en'
      ? stats.acwr.zoneLabel
      : stats.acwr.zone === 'danger'
      ? '危險暴增 (> 1.50)'
      : stats.acwr.zone === 'caution'
      ? '警戒上限 (1.31 – 1.50)'
      : stats.acwr.zone === 'sweet_spot'
      ? '最佳適應區間 (0.80 – 1.30)'
      : '減量恢復期 (< 0.80)';

  return (
    <section className={`border ${borderCls} ${cardCls} p-5 space-y-4`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b ${borderCls} pb-3`}>
        <div>
          <h2 className="font-display-lab text-base font-bold">
            {tr(
              lang,
              '直臂肌腱安全負荷日誌（100% 離線儲存於瀏覽器 LocalStorage）',
              'Straight-Arm Tendon-Safe Volume Log (Offline LocalStorage)'
            )}
          </h2>
          <p className={`text-xs ${mutedText}`}>
            {tr(
              lang,
              `自動統計每週直臂加權力矩秒數（組數 × 秒數 × %全展體），當單週暴增超過 ${spikeThresholdPct}% 時發出肌腱過載警示。`,
              `Tracks weekly Straight-Arm Torque-Volume (sets × sec × %Full) and alerts on sudden >${spikeThresholdPct}% tendon-load spikes.`
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-telemetry">
          <button
            type="button"
            onClick={exportCsv}
            className={`inline-flex items-center gap-1 px-2.5 py-1 border ${borderCls} cursor-pointer`}
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={exportJson}
            className={`inline-flex items-center gap-1 px-2.5 py-1 border ${borderCls} cursor-pointer`}
          >
            <Download className="w-3.5 h-3.5" /> {tr(lang, 'JSON 備份', 'JSON Backup')}
          </button>
          <label className={`inline-flex items-center gap-1 px-2.5 py-1 border ${borderCls} cursor-pointer`}>
            <Upload className="w-3.5 h-3.5" /> {tr(lang, '匯入還原', 'Restore')}
            <input type="file" accept=".json" onChange={importJson} className="hidden" />
          </label>
        </div>
      </div>

      {importError && <p className="text-xs text-[#DC2626]">{importError}</p>}

      {/* Weekly KPIs + ACWR Tendon Safety Gauge */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono-telemetry tabular-nums">
        <div className={`p-3 border ${borderCls} ${subCls}`}>
          <span className={`text-[10px] block ${mutedText}`}>
            {tr(lang, '上週直臂力矩總量', 'PRIOR WEEK TORQUE-VOL')}
          </span>
          <span className="text-xl font-bold">{stats.prevVol} eq·s</span>
        </div>
        <div className={`p-3 border ${borderCls} ${subCls}`}>
          <span className={`text-[10px] block ${mutedText}`}>
            {tr(lang, '本週直臂力矩總量', 'CURRENT WEEK TORQUE-VOL')}
          </span>
          <span className="text-xl font-bold">{stats.currVol} eq·s</span>
        </div>
        <div
          className={`p-3 border ${
            stats.isSpike ? 'border-[#DC2626] bg-[#DC2626]/15' : `${borderCls} ${subCls}`
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] ${mutedText}`}>
              {tr(lang, '週對週增減率', 'WEEK-OVER-WEEK DELTA')}
            </span>
            <label className="text-[10px] flex items-center gap-1">
              {tr(lang, '警戒線:', 'Cap:')}
              <input
                type="number"
                min={10}
                max={40}
                value={spikeThresholdPct}
                onChange={(e) => setSpikeThresholdPct(Math.max(10, Number(e.target.value) || 20))}
                className={`w-10 px-1 border ${borderCls} bg-transparent text-right`}
              />
              %
            </label>
          </div>
          <span className={`text-xl font-bold ${stats.isSpike ? 'text-[#EF4444]' : 'text-[#84CC16]'}`}>
            {stats.wowPct > 0 ? '+' : ''}
            {stats.wowPct}%
          </span>
        </div>
        <div
          className={`p-3 border ${
            stats.acwr.zone === 'danger'
              ? 'border-[#DC2626] bg-[#DC2626]/15'
              : stats.acwr.zone === 'caution'
              ? 'border-[#F59E0B] bg-[#F59E0B]/15'
              : `${borderCls} ${subCls}`
          }`}
        >
          <span className={`text-[10px] block ${mutedText}`}>
            {tr(lang, '急慢性負荷比 ACWR', 'ACWR (ACUTE:CHRONIC)')}
          </span>
          <span
            className={`text-xl font-bold ${
              stats.acwr.zone === 'danger'
                ? 'text-[#EF4444]'
                : stats.acwr.zone === 'caution'
                ? 'text-[#F59E0B]'
                : 'text-[#84CC16]'
            }`}
          >
            {stats.acwr.acwrRatio.toFixed(2)}×
          </span>
          <span className={`text-[10px] block ${mutedText}`}>{zoneLabelLocalized}</span>
        </div>
      </div>

      {/* Live Gym-Floor Isometric Stopwatch + 3-Min Straight-Arm Rest Timer */}
      <div className={`p-3.5 border ${borderCls} ${subCls} flex flex-wrap items-center justify-between gap-3 font-mono-telemetry tabular-nums`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <Timer className="w-4 h-4 text-[#84CC16]" />
          <div>
            <span className={`text-[10px] block ${mutedText}`}>
              {tr(lang, '等長靜態支撐碼錶', 'ISOMETRIC HOLD STOPWATCH')}
            </span>
            <strong className="text-lg text-[#84CC16]">{(stopwatchTenths / 10).toFixed(1)} s</strong>
          </div>
          <button
            type="button"
            onClick={() => setStopwatchRunning((r) => !r)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-[#84CC16] bg-[#84CC16]/15 font-semibold cursor-pointer"
          >
            {stopwatchRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {stopwatchRunning ? tr(lang, '暫停', 'Stop') : tr(lang, '開始計時', 'Start Hold')}
          </button>
          <button
            type="button"
            onClick={() => {
              setStopwatchRunning(false);
              if (stopwatchTenths >= 10) setHoldSec(Math.round(stopwatchTenths / 10));
            }}
            className={`px-2 py-1 text-xs border ${borderCls} cursor-pointer`}
          >
            {tr(lang, `帶入秒數 (${Math.max(1, Math.round(stopwatchTenths / 10))}s)`, `Use Hold (${Math.max(1, Math.round(stopwatchTenths / 10))}s)`)}
          </button>
          <button
            type="button"
            aria-label="Reset stopwatch"
            onClick={() => {
              setStopwatchRunning(false);
              setStopwatchTenths(0);
            }}
            className={`p-1 border ${borderCls} cursor-pointer`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={mutedText}>{tr(lang, '組間磷酸肌酸恢復：', 'ATP-PC Rest:')}</span>
          <strong className="text-sm text-[#F59E0B]">
            {Math.floor(restSecLeft / 60)}:{String(restSecLeft % 60).padStart(2, '0')}
          </strong>
          <button
            type="button"
            onClick={() => setRestSecLeft(180)}
            className={`px-2 py-1 border ${borderCls} hover:border-[#F59E0B] cursor-pointer`}
          >
            {tr(lang, '啟動 3:00 倒數', 'Start 3:00 Rest')}
          </button>
        </div>
      </div>

      {stats.isSpike && (
        <div className="p-3 border border-[#DC2626] bg-[#DC2626]/10 flex items-start gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
          <span>
            <strong>
              {tr(
                lang,
                `肌腱過載暴增警告 (+${stats.wowPct}%)：`,
                `Tendon Overload Spike Warning (+${stats.wowPct}%):`
              )}
            </strong>{' '}
            {tr(
              lang,
              `本週直臂等長力矩訓練量較上週激增超過 ${spikeThresholdPct}%。肱二頭肌遠端與手肘肌腱之膠原蛋白重塑速率遠慢於肌纖維，建議減少 1–2 組或增加骨盆彈力帶輔助以預防肌腱炎。`,
              `Your weekly Straight-Arm isometric torque-volume jumped more than ${spikeThresholdPct}% over last week. Biceps/brachialis tendons adapt slower than muscle—consider trimming 1–2 sets or adding hip band assistance.`
            )}
          </span>
        </div>
      )}

      {/* Quick Log Bar */}
      <div className={`p-3 border ${borderCls} ${subCls} flex flex-wrap items-end gap-3`}>
        <div className="text-xs font-mono-telemetry">
          <span className={`block text-[10px] ${mutedText}`}>
            {tr(lang, '目前計算器選定姿勢', 'ACTIVE CALCULATOR POSE')}
          </span>
          <strong>
            {formatSkillLabel(lang, currentSkill)} · {formatPoseLabel(lang, currentPose)} ({currentTorqueNm} N·m · {currentPercentOfFull}%)
          </strong>
        </div>
        <div>
          <label htmlFor="log-sets" className={`block text-[10px] ${mutedText}`}>
            {tr(lang, '組數 Sets', 'Sets')}
          </label>
          <input
            id="log-sets"
            type="number"
            min={1}
            max={15}
            value={sets}
            onChange={(e) => setSets(Math.max(1, Number(e.target.value) || 1))}
            className={`w-16 px-2 py-1 border ${borderCls} ${cardCls} font-mono-telemetry text-xs`}
          />
        </div>
        <div>
          <label htmlFor="log-sec" className={`block text-[10px] ${mutedText}`}>
            {tr(lang, '支撐秒數 (s)', 'Hold (s)')}
          </label>
          <input
            id="log-sec"
            type="number"
            min={1}
            max={60}
            value={holdSec}
            onChange={(e) => setHoldSec(Math.max(1, Number(e.target.value) || 1))}
            className={`w-16 px-2 py-1 border ${borderCls} ${cardCls} font-mono-telemetry text-xs`}
          />
        </div>
        <button
          type="button"
          onClick={addCurrentSet}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#84CC16] text-[#101317] text-xs font-bold hover:bg-[#A3E635] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {tr(lang, '記錄直臂訓練組', 'Log Straight-Arm Work')}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className={`border-b ${borderCls} ${mutedText}`}>
            <tr>
              <th className="text-left py-2">{tr(lang, '日期／週次', 'Date / Bucket')}</th>
              <th className="text-left py-2">{tr(lang, '動作與姿勢', 'Skill & Pose')}</th>
              <th className="text-right py-2">{tr(lang, '組數 × 秒數', 'Sets × Hold')}</th>
              <th className="text-right py-2">{tr(lang, '肩關節力矩', 'Torque')}</th>
              <th className="text-right py-2">{tr(lang, '加權當量秒數', 'Eq. Volume')}</th>
              <th className="text-right py-2"></th>
            </tr>
          </thead>
          <tbody className={`divide-y ${borderCls} font-mono-telemetry tabular-nums`}>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="py-2 font-sans">{entry.dateIso}</td>
                <td className="py-2">
                  {formatSkillLabel(lang, entry.skill)} · {formatPoseLabel(lang, entry.pose)}
                </td>
                <td className="py-2 text-right">{entry.sets} × {entry.holdSec}s</td>
                <td className="py-2 text-right">{entry.torqueNm} N·m ({entry.percentOfFull}%)</td>
                <td className="py-2 text-right font-semibold">
                  {(entry.sets * entry.holdSec * (entry.percentOfFull / 100)).toFixed(1)} eq·s
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    aria-label={`Delete log entry ${entry.id}`}
                    onClick={() => deleteEntry(entry.id)}
                    className="p-1 text-[#94A3B8] hover:text-[#EF4444] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
