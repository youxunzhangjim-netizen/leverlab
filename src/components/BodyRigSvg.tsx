import React from 'react';
import { SkillType, TorqueSolution } from '../engine/biomechanics/torqueSolver';

interface BodyRigSvgProps {
  solution: TorqueSolution;
  skill: SkillType;
  bandAssistKg: number;
  daylight: boolean;
}

export const BodyRigSvg: React.FC<BodyRigSvgProps> = ({
  solution,
  skill,
  bandAssistKg,
  daylight,
}) => {
  const { joints, effectiveAngles } = solution;

  // Side view coordinate mapping: shoulder fulcrum at (110, 120), 1 meter = 200 px
  const ox = 115;
  const oy = skill === 'planche' ? 112 : 128;
  const pxPerM = 195;

  const sx = (xM: number) => ox + xM * pxPerM;
  const sy = (yM: number) => oy + yM * pxPerM;

  const strokePrimary = daylight ? '#101317' : '#F1F5F9';
  const strokeMuted = daylight ? '#64748B' : '#94A3B8';
  const gridStroke = daylight ? '#E2E8F0' : '#232B35';
  const accentLime = daylight ? '#4D7C0F' : '#84CC16';
  const bgFill = daylight ? '#FFFFFF' : '#13181F';

  // Top-view straddle geometry (right box)
  const topOx = 60;
  const topOy = 115;
  const halfStraddleRad = ((effectiveAngles.straddleAngleDeg / 2) * Math.PI) / 180;
  const legLenTop = 86;
  const hipTopX = topOx + 54;
  const leftFootTopX = hipTopX + legLenTop * Math.cos(halfStraddleRad);
  const leftFootTopY = topOy - legLenTop * Math.sin(halfStraddleRad);
  const rightFootTopX = hipTopX + legLenTop * Math.cos(halfStraddleRad);
  const rightFootTopY = topOy + legLenTop * Math.sin(halfStraddleRad);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
      {/* Side-view biomechanical lever rig */}
      <div className={`md:col-span-8 border ${daylight ? 'border-[#CBD5E1] bg-white' : 'border-[#2A323D] bg-[#13181F]'} p-3`}>
        <div className="flex items-center justify-between text-[11px] font-mono-telemetry mb-1.5">
          <span className={daylight ? 'text-[#475569]' : 'text-[#94A3B8]'}>
            SIDE-VIEW LEVER MODEL ({skill === 'front_lever' ? 'FRONT LEVER' : skill === 'back_lever' ? 'BACK LEVER' : 'PLANCHE'}
            {effectiveAngles.bodyTiltDeg > 0 ? ` · ${effectiveAngles.bodyTiltDeg}° INCLINE` : ''})
          </span>
          <span style={{ color: accentLime }}>
            COM r_x = {solution.centerOfMassXFromShoulderCm} cm
          </span>
        </div>

        <svg
          viewBox="0 0 460 220"
          className="w-full h-auto block"
          role="img"
          aria-label="2D side-view biomechanical skeleton showing shoulder fulcrum and center of mass"
        >
          <rect x="0" y="0" width="460" height="220" fill={bgFill} />
          {/* Background metric grid */}
          {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5].map((m) => (
            <g key={m}>
              <line x1={sx(m)} y1="12" x2={sx(m)} y2="196" stroke={gridStroke} strokeWidth="1" />
              <text x={sx(m)} y="210" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" fill={strokeMuted}>
                +{Math.round(m * 100)}cm
              </text>
            </g>
          ))}

          {/* Support Bar / Parallettes & Supporting Arm */}
          {skill === 'front_lever' || skill === 'back_lever' ? (
            <>
              <line x1="70" y1="36" x2="160" y2="36" stroke={strokeMuted} strokeWidth="4" strokeLinecap="round" />
              <line x1={sx(0)} y1="36" x2={sx(0)} y2={sy(0)} stroke={strokeMuted} strokeWidth="5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <line x1="70" y1="192" x2="160" y2="192" stroke={strokeMuted} strokeWidth="4" strokeLinecap="round" />
              <line x1={sx(0)} y1={sy(0)} x2={sx(0) - 10} y2="192" stroke={strokeMuted} strokeWidth="5" strokeLinecap="round" />
            </>
          )}

          {/* Horizontal lever arm bar from shoulder to COM */}
          <line
            x1={sx(0)}
            y1={sy(0) + (skill === 'planche' ? -54 : 54)}
            x2={sx(joints.com.x)}
            y2={sy(0) + (skill === 'planche' ? -54 : 54)}
            stroke={accentLime}
            strokeWidth="2"
          />

          {/* Hip Band Assist Vector */}
          {bandAssistKg > 0 && (
            <g>
              <line
                x1={sx(joints.hip.x)}
                y1={sy(joints.hip.y)}
                x2={sx(joints.hip.x)}
                y2="24"
                stroke="#F59E0B"
                strokeWidth="2.2"
                strokeDasharray="5 3"
              />
              <text
                x={sx(joints.hip.x) + 6}
                y="34"
                fontSize="9.5"
                fontFamily="JetBrains Mono, monospace"
                fill="#F59E0B"
              >
                Band -{bandAssistKg}kg
              </text>
            </g>
          )}

          {/* Far leg (Right) slightly translucent for one-leg clarity */}
          <line
            x1={sx(joints.hip.x)}
            y1={sy(joints.hip.y)}
            x2={sx(joints.kneeRight.x)}
            y2={sy(joints.kneeRight.y)}
            stroke={strokeMuted}
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.65"
          />
          <line
            x1={sx(joints.kneeRight.x)}
            y1={sy(joints.kneeRight.y)}
            x2={sx(joints.ankleRight.x)}
            y2={sy(joints.ankleRight.y)}
            stroke={strokeMuted}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.65"
          />

          {/* Head + Trunk + Near Leg */}
          <circle cx={sx(joints.head.x)} cy={sy(joints.head.y)} r="13" fill="none" stroke={strokePrimary} strokeWidth="3.5" />
          <line x1={sx(0)} y1={sy(0)} x2={sx(joints.hip.x)} y2={sy(joints.hip.y)} stroke={strokePrimary} strokeWidth="7" strokeLinecap="round" />
          <line x1={sx(joints.hip.x)} y1={sy(joints.hip.y)} x2={sx(joints.kneeLeft.x)} y2={sy(joints.kneeLeft.y)} stroke={strokePrimary} strokeWidth="5.5" strokeLinecap="round" />
          <line x1={sx(joints.kneeLeft.x)} y1={sy(joints.kneeLeft.y)} x2={sx(joints.ankleLeft.x)} y2={sy(joints.ankleLeft.y)} stroke={strokePrimary} strokeWidth="4.5" strokeLinecap="round" />

          {/* Shoulder Fulcrum */}
          <circle cx={sx(0)} cy={sy(0)} r="6" fill={accentLime} stroke={bgFill} strokeWidth="1.5" />
          <text x={sx(0) - 34} y={sy(0) + 22} fontSize="9" fontFamily="JetBrains Mono, monospace" fill={accentLime}>
            FULCRUM
          </text>

          {/* Center of Mass Plumb Line & Crosshair */}
          <line
            x1={sx(joints.com.x)}
            y1="16"
            x2={sx(joints.com.x)}
            y2="196"
            stroke="#F59E0B"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />
          <circle cx={sx(joints.com.x)} cy={sy(joints.com.y)} r="6.5" fill="#F59E0B" stroke={bgFill} strokeWidth="1.5" />
          <text
            x={sx(joints.com.x) + 8}
            y={sy(joints.com.y) - 8}
            fontSize="9.5"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="700"
            fill="#F59E0B"
          >
            COM
          </text>
        </svg>
      </div>

      {/* Top-view Straddle Abduction Diagram */}
      <div className={`md:col-span-4 border ${daylight ? 'border-[#CBD5E1] bg-white' : 'border-[#2A323D] bg-[#13181F]'} p-3`}>
        <div className="flex items-center justify-between text-[11px] font-mono-telemetry mb-1.5">
          <span className={daylight ? 'text-[#475569]' : 'text-[#94A3B8]'}>TOP-VIEW STRADDLE</span>
          <span style={{ color: accentLime }}>φ = {effectiveAngles.straddleAngleDeg}°</span>
        </div>

        <svg
          viewBox="0 0 220 220"
          className="w-full h-auto block"
          role="img"
          aria-label="Top-view leg abduction straddle angle diagram"
        >
          <rect x="0" y="0" width="220" height="220" fill={bgFill} />
          <line x1="20" y1={topOy} x2="205" y2={topOy} stroke={gridStroke} strokeDasharray="3 3" />
          {/* Shoulders & Torso */}
          <line x1={topOx} y1={topOy - 22} x2={topOx} y2={topOy + 22} stroke={strokeMuted} strokeWidth="5" strokeLinecap="round" />
          <line x1={topOx} y1={topOy} x2={hipTopX} y2={topOy} stroke={strokePrimary} strokeWidth="7" strokeLinecap="round" />
          {/* Abducted legs */}
          <line x1={hipTopX} y1={topOy} x2={leftFootTopX} y2={leftFootTopY} stroke={accentLime} strokeWidth="5" strokeLinecap="round" />
          <line x1={hipTopX} y1={topOy} x2={rightFootTopX} y2={rightFootTopY} stroke={accentLime} strokeWidth="5" strokeLinecap="round" />
          <circle cx={topOx} cy={topOy} r="5" fill={accentLime} />
          <circle cx={hipTopX} cy={topOy} r="4.5" fill={strokePrimary} />
          <text x="110" y="205" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill={strokeMuted}>
            cos(φ/2) = {Math.cos(halfStraddleRad).toFixed(3)}
          </text>
        </svg>
      </div>
    </div>
  );
};
