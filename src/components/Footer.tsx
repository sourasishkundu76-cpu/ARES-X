import React from 'react';

interface FooterProps {
  currentAngle: number;
  targetCount: number;
  actuatorEngaged: boolean;
  loopLatencyMs: number;
  isLinkActive: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  currentAngle,
  targetCount,
  actuatorEngaged,
  loopLatencyMs,
  isLinkActive,
}) => {
  return (
    <footer className="fixed bottom-0 left-0 w-full z-40 bg-[#0a0e15]/95 backdrop-blur-md border-t border-[#262a32] shadow-[0_-1px_8px_rgba(0,0,0,0.5)]">
      <div className="h-11 w-full px-4 flex items-center justify-between gap-4 overflow-x-auto text-nowrap font-['JetBrains_Mono']">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#b9cbbc] uppercase">LOOP LATENCY:</span>
            <span className="text-[11px] text-[#00ff9d] font-bold">
              {loopLatencyMs}ms [NOMINAL]
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#b9cbbc] uppercase">SWEEP ANGLE:</span>
            <span className="text-[11px] text-[#00daf3] font-bold">
              {Math.round(currentAngle)}°
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#b9cbbc] uppercase">TARGET COUNT:</span>
            <span
              className={`text-[11px] font-bold px-1.5 py-0.2 border ${
                targetCount > 0
                  ? 'bg-[#262a32] text-[#ff3366] border-[#ff3366]/40'
                  : 'bg-[#181c23] text-[#b9cbbc] border-[#262a32]'
              }`}
            >
              {targetCount > 0 ? `${targetCount} LOCKED` : '0 DETECTED'}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-[10px] text-[#b9cbbc] uppercase">ACTUATOR STATE:</span>
            <span
              className={`text-[11px] font-bold ${
                actuatorEngaged ? 'text-[#00e38b]' : 'text-[#b9cbbc]'
              }`}
            >
              {actuatorEngaged
                ? `RESPONSE SERVO ENGAGED ${Math.round(currentAngle)}° / STROBE ON`
                : 'STANDBY // MOTOR UNLOCKED'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#b9cbbc] uppercase">SENSOR HEALTH:</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-[#1c2027] text-[#00ff9d] border border-[#00ff9d]/30 font-bold">
              NOMINAL [100%]
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[#b9cbbc] text-[10px]">
            <span
              className={`material-symbols-outlined text-sm ${
                isLinkActive ? 'text-[#00ff9d] animate-pulse' : 'text-gray-500'
              }`}
            >
              wifi_tethering
            </span>
            <span>TX/RX LINK ACTIVE</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
