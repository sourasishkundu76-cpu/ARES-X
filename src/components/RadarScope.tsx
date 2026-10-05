import React, { useState } from 'react';
import { Obstacle } from '../types';
import { playSonarPing, setAudioEnabled, isAudioEnabled } from '../utils/audio';

interface RadarScopeProps {
  currentAngle: number;
  obstacles: Obstacle[];
  targetLocked: boolean;
  lockedTarget: Obstacle | null;
  onSelectTarget: (ob: Obstacle) => void;
  confirmHits: number;
  requiredHits: number;
  confidence: number;
}

export const RadarScope: React.FC<RadarScopeProps> = ({
  currentAngle,
  obstacles,
  targetLocked,
  lockedTarget,
  onSelectTarget,
  confirmHits,
  requiredHits,
  confidence,
}) => {
  const [showGrid, setShowGrid] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [audioActive, setAudioActive] = useState(isAudioEnabled());

  const handleAudioToggle = (checked: boolean) => {
    setAudioActive(checked);
    setAudioEnabled(checked);
    if (checked) {
      playSonarPing(1200, 0.08);
    }
  };

  // Convert Polar (angleDeg, distanceCm) to SVG coordinates (origin at x:250, y:260)
  // Max range is 40cm -> radius in SVG is 230px
  const getSvgCoordinates = (angleDeg: number, distanceCm: number) => {
    const r = (Math.min(distanceCm, 40) / 40) * 230;
    const rad = (angleDeg * Math.PI) / 180;
    const x = 250 + r * Math.cos(rad);
    const y = 260 - r * Math.sin(rad);
    return { x, y };
  };

  // Active locked cartesian coordinates
  const activeAngle = lockedTarget ? lockedTarget.angleDeg : currentAngle;
  const activeDist = lockedTarget ? lockedTarget.distanceCm : 22.4;
  const rad = (activeAngle * Math.PI) / 180;
  const cartX = (activeDist * Math.cos(rad)).toFixed(2);
  const cartY = (activeDist * Math.sin(rad)).toFixed(2);

  // SVG sweep beam rotation around pivot (250, 260)
  // Baseline is bottom, 90 deg is straight up (0 deg rotation)
  const sweepRotation = currentAngle - 90;

  return (
    <div className="relative flex-1 w-full flex flex-col justify-between overflow-hidden bg-[#0a0e15] p-2 border border-[#1c2027]">
      {/* Scope Header Strip */}
      <div className="flex items-center justify-between pb-1 mb-1 bg-[#181c23] px-2 py-1 border border-[#262a32]">
        <div className="flex items-center gap-2">
          <span className="font-['Space_Mono'] font-bold text-xs text-[#00ff9d] flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">radar</span>
            POLAR RADAR SCOPE
          </span>
          <span className="font-['JetBrains_Mono'] text-[9px] text-[#b9cbbc]">
            [180° AZIMUTH / 40CM RANGE]
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`font-['JetBrains_Mono'] text-[9px] px-1.5 py-0.5 font-bold border ${
              targetLocked
                ? 'bg-[#ff3366]/20 text-[#ff3366] border-[#ff3366]/50 animate-pulse'
                : 'bg-[#00ff9d]/20 text-[#00ff9d] border-[#00ff9d]/40'
            }`}
          >
            {targetLocked ? '1 TARGET LOCKED' : 'STANDBY / SCANNING'}
          </span>
        </div>
      </div>

      {/* SVG Radar Display Viewport */}
      <div className="relative flex-1 w-full flex items-center justify-center min-h-[300px]">
        <svg className="w-full h-full max-h-[380px]" viewBox="0 0 500 280">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="beamGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00ff9d" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#00ff9d" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Outer baseline */}
          <line x1="20" y1="260" x2="480" y2="260" stroke="#262a32" strokeWidth="2" />

          {/* Trigger Zone Shade (under 30cm) */}
          <path
            d="M 77.5 260 A 172.5 172.5 0 0 1 422.5 260 Z"
            fill="#00ff9d"
            fillOpacity="0.03"
          />

          {showGrid && (
            <g className="grid-layer">
              {/* Concentric Arcs */}
              {/* 10cm -> r = 57.5px */}
              <path
                d="M 192.5 260 A 57.5 57.5 0 0 1 307.5 260"
                fill="none"
                stroke="#262a32"
                strokeDasharray="2,2"
                strokeWidth="1"
              />
              <text x="250" y="198" fill="#849587" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">
                10cm
              </text>

              {/* 20cm -> r = 115px */}
              <path
                d="M 135 260 A 115 115 0 0 1 365 260"
                fill="none"
                stroke="#262a32"
                strokeDasharray="3,3"
                strokeWidth="1"
              />
              <text x="250" y="142" fill="#849587" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">
                20cm
              </text>

              {/* 30cm [TRIGGER ZONE] -> r = 172.5px */}
              <path
                d="M 77.5 260 A 172.5 172.5 0 0 1 422.5 260"
                fill="none"
                stroke="#ff3366"
                strokeOpacity="0.7"
                strokeWidth="1.2"
              />
              <text x="250" y="84" fill="#ff3366" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">
                30cm [TRIGGER ZONE]
              </text>

              {/* 40cm MAX -> r = 230px */}
              <path
                d="M 20 260 A 230 230 0 0 1 480 260"
                fill="none"
                stroke="#00e38b"
                strokeOpacity="0.6"
                strokeWidth="1.5"
              />
              <text x="250" y="24" fill="#00e38b" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">
                40cm MAX
              </text>

              {/* Radial spokes */}
              {/* 30 deg */}
              <line x1="250" y1="260" x2="449" y2="145" stroke="#262a32" strokeDasharray="2,2" strokeWidth="1" />
              <text x="460" y="145" fill="#849587" fontSize="8" fontFamily="JetBrains Mono">
                30°
              </text>

              {/* 60 deg */}
              <line x1="250" y1="260" x2="365" y2="61" stroke="#262a32" strokeDasharray="2,2" strokeWidth="1" />
              <text x="375" y="55" fill="#849587" fontSize="8" fontFamily="JetBrains Mono">
                60°
              </text>

              {/* 90 deg */}
              <line x1="250" y1="260" x2="250" y2="30" stroke="#3b4a3f" strokeWidth="1.2" />
              <text x="250" y="18" fill="#00e38b" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">
                90°
              </text>

              {/* 120 deg */}
              <line x1="250" y1="260" x2="135" y2="61" stroke="#262a32" strokeDasharray="2,2" strokeWidth="1" />
              <text x="115" y="55" fill="#849587" fontSize="8" fontFamily="JetBrains Mono">
                120°
              </text>

              {/* 150 deg */}
              <line x1="250" y1="260" x2="51" y2="145" stroke="#262a32" strokeDasharray="2,2" strokeWidth="1" />
              <text x="30" y="145" fill="#849587" fontSize="8" fontFamily="JetBrains Mono">
                150°
              </text>
            </g>
          )}

          {/* Dynamic Radar Sweep Beam */}
          <g transform={`rotate(${sweepRotation}, 250, 260)`}>
            {showTrail && (
              <path
                d="M 250 260 L 205 32 A 230 230 0 0 1 250 30 Z"
                fill="#00ff9d"
                fillOpacity="0.22"
              />
            )}
            <line
              x1="250"
              y1="260"
              x2="250"
              y2="30"
              stroke="#00ff9d"
              strokeWidth="2"
              filter="url(#glow)"
            />
          </g>

          {/* Target Blips */}
          {obstacles.map((ob) => {
            const { x, y } = getSvgCoordinates(ob.angleDeg, ob.distanceCm);
            const isTarget = targetLocked && lockedTarget?.id === ob.id;

            return (
              <g
                key={ob.id}
                className="cursor-pointer transition-transform hover:scale-110"
                onClick={() => onSelectTarget(ob)}
              >
                {isTarget ? (
                  <>
                    <circle cx={x} cy={y} r="14" fill="#ff3366" fillOpacity="0.2" className="animate-ping" />
                    <circle cx={x} cy={y} r="6" fill="#ff3366" stroke="#ffffff" strokeWidth="1.5" filter="url(#glow)" />
                    <circle cx={x} cy={y} r="2" fill="#ffffff" />
                    <rect
                      x={x - 8}
                      y={y - 8}
                      width="16"
                      height="16"
                      fill="none"
                      stroke="#00ff9d"
                      strokeDasharray="2,2"
                      strokeWidth="1"
                    />
                    <text
                      x={x + 12}
                      y={y - 2}
                      fill="#00ff9d"
                      fontSize="8"
                      fontFamily="Space Mono"
                      fontWeight="bold"
                    >
                      {ob.name} [LOCKED]
                    </text>
                    <text
                      x={x + 12}
                      y={y + 8}
                      fill="#dfe2ed"
                      fontSize="7"
                      fontFamily="JetBrains Mono"
                    >
                      {ob.angleDeg}° // {ob.distanceCm.toFixed(1)}cm
                    </text>
                  </>
                ) : (
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#00daf3"
                      stroke="#bdf4ff"
                      strokeWidth="1"
                      className="opacity-80 hover:opacity-100"
                    />
                    <text
                      x={x > 250 ? x + 6 : x - 55}
                      y={y}
                      fill="#00daf3"
                      fontSize="7"
                      fontFamily="JetBrains Mono"
                    >
                      {ob.name} ({ob.distanceCm.toFixed(1)}cm)
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Central Pivot Hub */}
          <circle cx="250" cy="260" r="5" fill="#00ff9d" />
          <circle cx="250" cy="260" r="1.8" fill="#0a0e15" />
        </svg>

        {/* Floating Cartesian Conversion Readout */}
        <div className="absolute bottom-2 left-2 p-1.5 bg-[#0a0e15]/90 backdrop-blur-md border border-[#262a32] shadow-sm font-['JetBrains_Mono']">
          <div className="text-[9px] text-[#b9cbbc] uppercase">CARTESIAN CONVERSION</div>
          <div className="flex items-center gap-3 text-[11px]">
            <div>
              X: <span className="text-[#00daf3] font-bold">{Number(cartX) >= 0 ? '+' : ''}{cartX} cm</span>
            </div>
            <div>
              Y: <span className="text-[#00ff9d] font-bold">+{cartY} cm</span>
            </div>
          </div>
        </div>

        {/* Verification Counter & Confidence Meter */}
        <div className="absolute bottom-2 right-2 p-1.5 bg-[#0a0e15]/90 backdrop-blur-md border border-[#262a32] shadow-sm flex flex-col items-end gap-1 font-['JetBrains_Mono']">
          <div className="flex items-center gap-1 text-[9px]">
            <span className="text-[#b9cbbc]">MULTI-PING CONFIRM:</span>
            <span
              className={`px-1 font-bold ${
                confirmHits >= requiredHits
                  ? 'bg-[#00ff9d] text-[#00391f]'
                  : 'bg-[#262a32] text-[#00daf3]'
              }`}
            >
              {confirmHits} / {requiredHits} PASS
            </span>
          </div>
          <div className="flex items-center gap-1 text-[9px]">
            <span className="text-[#b9cbbc]">CONFIDENCE:</span>
            <span className="text-[#00ff9d] font-bold">{confidence.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Layer Toggles & Antenna Aperture footer */}
      <div className="flex items-center justify-between pt-1 text-[#b9cbbc] font-['JetBrains_Mono'] text-[9px] border-t border-[#1c2027]">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="accent-[#00ff9d]"
            />
            <span>GRID</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showTrail}
              onChange={(e) => setShowTrail(e.target.checked)}
              className="accent-[#00ff9d]"
            />
            <span>PHOSPHOR TRAIL</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={audioActive}
              onChange={(e) => handleAudioToggle(e.target.checked)}
              className="accent-[#00daf3]"
            />
            <span>PULSE SONIC</span>
          </label>
        </div>
        <div className="text-[#00e38b]">
          ANTENNA APERTURE: 15°
        </div>
      </div>
    </div>
  );
};
