import React, { useState } from 'react';
import { Check, ExternalLink, KeyRound, ShieldCheck, X } from 'lucide-react';
import {
  LEVERLAB_DEMO_KEYS,
  LeverLabLicenseState,
  validateLeverLabKeyLocally,
} from '../engine/licenseEngine';

interface Props {
  open: boolean;
  onClose: () => void;
  daylight: boolean;
  license: LeverLabLicenseState;
  isLocalHost: boolean;
  onActivate: (next: LeverLabLicenseState) => void;
  onSimulateFree: () => void;
  onRestoreLocalFull: () => void;
}

const ENV = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const ATHLETE_CHECKOUT = ENV.VITE_LVLB_CHECKOUT_ATHLETE || '';
const COACH_CHECKOUT = ENV.VITE_LVLB_CHECKOUT_COACH || '';

export const ProLicenseModal: React.FC<Props> = ({
  open,
  onClose,
  daylight,
  license,
  isLocalHost,
  onActivate,
  onSimulateFree,
  onRestoreLocalFull,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checkoutHint, setCheckoutHint] = useState<string | null>(null);

  if (!open) return null;

  const surface = daylight ? 'bg-white text-[#101317] border-[#CBD5E1]' : 'bg-[#171C22] text-[#F1F5F9] border-[#2A323D]';
  const subSurface = daylight ? 'bg-[#F5F6F3] border-[#CBD5E1]' : 'bg-[#101317] border-[#2A323D]';
  const muted = daylight ? 'text-[#475569]' : 'text-[#94A3B8]';

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const check = validateLeverLabKeyLocally(keyInput);
    if (!check.valid || !check.state) {
      setMsg({ ok: false, text: 'Invalid key format (expected LVLB-XXXX-XXXX-XXXX).' });
      return;
    }
    onActivate(check.state);
    setMsg({ ok: true, text: `Activated ${check.state.planId.replace('_', ' ').toUpperCase()}.` });
    setKeyInput('');
  };

  const handleCheckout = (tier: 'athlete' | 'coach'): void => {
    const url = tier === 'coach' ? COACH_CHECKOUT : ATHLETE_CHECKOUT;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setCheckoutHint(
      tier === 'coach'
        ? 'Set VITE_LVLB_CHECKOUT_COACH (Lemon Squeezy US$99/yr Coach Roster link) in Cloudflare Pages to go live.'
        : 'Set VITE_LVLB_CHECKOUT_ATHLETE (Lemon Squeezy US$29 Lifetime One-Time link) in Cloudflare Pages to go live.'
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="LeverLab Pro Athlete & Coach Licensing"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className={`max-w-3xl w-full border ${surface} max-h-[92vh] overflow-y-auto`}>
        <div className="px-5 py-4 border-b border-[#2A323D] bg-[#101317] text-[#F1F5F9] flex items-start justify-between gap-3">
          <div>
            <p className="font-mono-telemetry text-[10.5px] uppercase tracking-widest text-[#84CC16]">
              LeverLab PWA · Offline-First Biomechanics License
            </p>
            <h2 className="font-display-lab text-lg font-bold mt-0.5">
              Athlete Lifetime Pro &amp; Coach Roster License
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close LeverLab Pro dialog"
            className="p-1 text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {license.isPro && (
            <div className="p-3.5 border border-[#84CC16] bg-[#84CC16]/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#84CC16] shrink-0" />
                <div>
                  <strong className="block">
                    Active: {license.mode === 'local_full' ? 'Local Full Pro Edition' : license.planId.toUpperCase()} ({license.keyMasked})
                  </strong>
                  {license.mode === 'local_full' && (
                    <span className={`text-[11px] ${muted}`}>
                      Localhost runs complete Pro mode automatically; public visitors start on Free Tier.
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSimulateFree();
                  setMsg(null);
                }}
                className="px-2.5 py-1 border border-[#F59E0B] text-[#F59E0B] font-mono-telemetry text-[11px] cursor-pointer"
              >
                {isLocalHost ? 'Simulate Free Athlete' : 'Remove Key'}
              </button>
            </div>
          )}

          {!license.isPro && isLocalHost && (
            <div className={`p-3 border ${subSurface} flex flex-wrap items-center justify-between gap-2 text-xs`}>
              <span>Previewing public Free Athlete mode on localhost.</span>
              <button
                type="button"
                onClick={() => {
                  onRestoreLocalFull();
                  setMsg(null);
                }}
                className="px-2.5 py-1 bg-[#84CC16] text-[#101317] font-mono-telemetry text-[11px] font-bold cursor-pointer"
              >
                Restore Local Full Edition
              </button>
            </div>
          )}

          <div className={`p-3 border ${subSurface} text-xs ${muted}`}>
            <strong className={daylight ? 'text-[#101317]' : 'text-[#F1F5F9]'}>Free Athlete Tier:</strong> Full interactive shoulder torque calculator (standard Winter/de Leva ratios), 6-step Auto-Bridge ladder, and local ACWR tendon log. Pro unlocks custom tape-measured limb overrides and 12-week periodized CSV plans.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`p-4 border border-[#84CC16] ${subSurface} flex flex-col justify-between gap-3`}>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display-lab text-base font-bold">Athlete Lifetime Pro</h3>
                  <div className="text-right font-mono-telemetry tabular-nums">
                    <span className="text-lg font-bold text-[#84CC16] block">US$29</span>
                    <span className={`text-[10px] ${muted}`}>One-time · CA$39 · NT$950</span>
                  </div>
                </div>
                <ul className="space-y-1 text-xs">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#84CC16]" /> Tape-measured custom trunk/femur/shank overrides</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#84CC16]" /> Export 12-week mesocycle CSV (with deload weeks)</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#84CC16]" /> 100% offline PWA + V2 MediaPipe Pose early access</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => handleCheckout('athlete')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#84CC16] text-[#101317] text-xs font-bold hover:bg-[#A3E635] cursor-pointer"
              >
                Buy Lifetime Pro (US$29) <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className={`p-4 border ${subSurface} flex flex-col justify-between gap-3`}>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display-lab text-base font-bold">Calisthenics Coach</h3>
                  <div className="text-right font-mono-telemetry tabular-nums">
                    <span className="text-lg font-bold text-[#F59E0B] block">US$99/yr</span>
                    <span className={`text-[10px] ${muted}`}>CA$135/yr · NT$3,200/yr</span>
                  </div>
                </div>
                <ul className="space-y-1 text-xs">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F59E0B]" /> Unlimited client anthropometric profiles &amp; CSV plans</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F59E0B]" /> Custom tendon-spike thresholds per athlete</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F59E0B]" /> Commercial coaching invoice via Lemon Squeezy</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => handleCheckout('coach')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-[#F59E0B] text-[#F59E0B] text-xs font-bold hover:bg-[#F59E0B] hover:text-[#101317] cursor-pointer"
              >
                Buy Coach License (US$99/yr) <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {checkoutHint && (
            <div className="p-3 border border-[#F59E0B]/50 bg-[#F59E0B]/10 text-xs text-[#F59E0B]">
              {checkoutHint}
            </div>
          )}

          <form onSubmit={handleSubmit} className={`p-3.5 border ${subSurface} space-y-2`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="lvlb-key-input" className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <KeyRound className="w-3.5 h-3.5 text-[#84CC16]" />
                Activate License Key
              </label>
              {!license.isPro && (
                <button
                  type="button"
                  onClick={() => {
                    const check = validateLeverLabKeyLocally(LEVERLAB_DEMO_KEYS.athleteLifetime);
                    if (check.valid && check.state) {
                      onActivate(check.state);
                      setMsg({ ok: true, text: 'Demo Athlete Pro key activated.' });
                    }
                  }}
                  className="text-[11px] font-mono-telemetry text-[#84CC16] underline cursor-pointer"
                >
                  Try Demo Key ({LEVERLAB_DEMO_KEYS.athleteLifetime})
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                id="lvlb-key-input"
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="LVLB-XXXX-XXXX-XXXX"
                className={`flex-1 border px-3 py-1.5 font-mono-telemetry text-xs uppercase ${surface}`}
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#84CC16] text-[#101317] text-xs font-bold hover:bg-[#A3E635] cursor-pointer"
              >
                Activate
              </button>
            </div>
            {msg && (
              <p className={`text-xs font-medium ${msg.ok ? 'text-[#84CC16]' : 'text-[#F87171]'}`}>
                {msg.text}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
