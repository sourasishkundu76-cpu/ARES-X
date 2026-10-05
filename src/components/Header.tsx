import React, { useEffect, useState } from 'react';

interface HeaderProps {
  currentTab: 'live-radar' | 'system-arch' | 'serial-telemetry';
  setCurrentTab: (tab: 'live-radar' | 'system-arch' | 'serial-telemetry') => void;
  isSimulating: boolean;
  onToggleSimulate: () => void;
  onAbort: () => void;
  isAborted: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  isSimulating,
  onToggleSimulate,
  onAbort,
  isAborted,
}) => {
  const [utcClock, setUtcClock] = useState('');
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const yr = now.getUTCFullYear();
      const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
      const da = String(now.getUTCDate()).padStart(2, '0');
      const hr = String(now.getUTCHours()).padStart(2, '0');
      const mi = String(now.getUTCMinutes()).padStart(2, '0');
      const se = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcClock(`${yr}.${mo}.${da} ${hr}:${mi}:${se} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    const nextMode = !isLightMode;
    setIsLightMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('light-mode');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light-mode');
      document.documentElement.classList.add('dark');
    }
  };

  const aresLogo = "https://lh3.googleusercontent.com/aida/AEtjO1V08Q1Tswj5cAjMgAWRzY2P6o0uTnFlUG8A_auXxcwhESDfSvQ06sNaPqsNEg9QZZaUjbu0ULFQeVaRsyrXvQVwWr9Wxm1QhpWNOPVpgvcSHQtW2_noTw03e_q7yEYhj4-EWQIE7KhXUjWOXmBs64jA3oib28WaWDW7OruCjj2Y6Oxiet3FhxbJNO0YAze9D_zHatVMZ3dlC8dG_5AbfhSj73SmuZACfWxMPrFPnJ1-qn1w-HM0EIYxAZFS";

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[#0a0e15]/95 backdrop-blur-md border-b border-[#262a32] shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
      <div className="h-20 w-full px-4 flex items-center justify-between gap-2 md:gap-4">
        {/* Brand section */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <img
              alt="ARES-X Logo"
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#00ff9d]/40 shadow-[0_0_8px_rgba(0,255,157,0.3)]"
              src={aresLogo}
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-['Space_Mono'] font-bold text-sm tracking-wider text-[#00ff9d]">
                  ARES-X
                </span>
                <span className="font-['JetBrains_Mono'] text-[9px] font-bold px-1.5 py-0.5 bg-[#1c2027] text-[#00e38b] border border-[#00e38b]/30">
                  CORE-V4
                </span>
              </div>
              <span className="font-['JetBrains_Mono'] text-[9px] text-[#b9cbbc] uppercase tracking-widest hidden sm:inline-block">
                AUTONOMOUS RADAR RESPONSE
              </span>
            </div>
          </div>

          <div className="hidden xl:flex items-center px-2 py-1 bg-[#181c23] text-[#56ffa8] font-['JetBrains_Mono'] text-[10px] border border-[#262a32]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00ff9d] mr-1.5 animate-ping"></span>
            ARES-X PROTOTYPE // EMBEDDED DEFENSE CORE
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setCurrentTab('live-radar')}
            className={`px-3 py-2 text-xs uppercase tracking-wider transition-all font-['JetBrains_Mono'] cursor-pointer ${
              currentTab === 'live-radar'
                ? 'bg-[#00ff9d] text-[#00391f] font-bold shadow-[0_0_12px_rgba(0,255,157,0.4)]'
                : 'text-[#b9cbbc] hover:bg-[#262a32] hover:text-[#dfe2ed]'
            }`}
          >
            LIVE RADAR TACTICAL DISPLAY
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('system-arch')}
            className={`px-3 py-2 text-xs uppercase tracking-wider transition-all font-['JetBrains_Mono'] cursor-pointer ${
              currentTab === 'system-arch'
                ? 'bg-[#00ff9d] text-[#00391f] font-bold shadow-[0_0_12px_rgba(0,255,157,0.4)]'
                : 'text-[#b9cbbc] hover:bg-[#262a32] hover:text-[#dfe2ed]'
            }`}
          >
            SYSTEM ARCHITECTURE & STATE MACHINE
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('serial-telemetry')}
            className={`px-3 py-2 text-xs uppercase tracking-wider transition-all font-['JetBrains_Mono'] cursor-pointer ${
              currentTab === 'serial-telemetry'
                ? 'bg-[#00ff9d] text-[#00391f] font-bold shadow-[0_0_12px_rgba(0,255,157,0.4)]'
                : 'text-[#b9cbbc] hover:bg-[#262a32] hover:text-[#dfe2ed]'
            }`}
          >
            SERIAL TELEMETRY & DIAGNOSTICS
          </button>
        </nav>

        {/* Hardware Status & Command Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex flex-col items-end text-right px-2 py-1 bg-[#181c23] border border-[#262a32]">
            <div className="font-['JetBrains_Mono'] text-[10px] text-[#00daf3] flex items-center gap-1 font-bold">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00daf3] animate-pulse"></span>
              PORT: /dev/ttyACM0 (115200 BAUD)
            </div>
            <div className="font-['JetBrains_Mono'] text-[9px] text-[#b9cbbc]">
              SYS_CLK: {utcClock || '2026.10.04 23:58:12 UTC'}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Theme Toggle */}
            <button
              aria-label="Toggle Light/Dark Theme"
              className="px-2 py-1.5 bg-[#1c2027] hover:bg-[#262a32] text-[#dfe2ed] font-['JetBrains_Mono'] text-[10px] uppercase tracking-wider flex items-center gap-1 border border-[#31353d] transition-all cursor-pointer"
              id="btn-theme-toggle"
              type="button"
              onClick={toggleTheme}
            >
              <span className="material-symbols-outlined text-xs text-[#00e38b]">
                {isLightMode ? 'dark_mode' : 'light_mode'}
              </span>
              <span>{isLightMode ? 'DARK' : 'LIGHT'}</span>
            </button>

            {/* Simulation Toggle */}
            <button
              className={`px-2.5 py-1.5 font-['JetBrains_Mono'] text-[10px] uppercase tracking-wider transition-colors cursor-pointer border ${
                isSimulating
                  ? 'bg-[#00daf3] text-[#00363d] font-bold border-[#00daf3]'
                  : 'bg-[#1c2027] text-[#00daf3] border-[#31353d] hover:bg-[#262a32]'
              }`}
              type="button"
              onClick={onToggleSimulate}
            >
              {isSimulating ? 'STREAMING' : 'SIMULATE'}
            </button>

            {/* Emergency Abort */}
            <button
              className={`px-2.5 py-1.5 font-['JetBrains_Mono'] text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                isAborted
                  ? 'bg-[#ff3366] text-white font-bold animate-pulse shadow-[0_0_16px_rgba(255,51,102,0.8)]'
                  : 'bg-[#ff3366] text-white shadow-[0_0_12px_rgba(255,51,102,0.5)] hover:bg-[#690005]'
              }`}
              type="button"
              onClick={onAbort}
            >
              {isAborted ? 'ABORTED' : 'ABORT'}
            </button>
          </div>

          <img
            alt="Profile"
            className="w-8 h-8 rounded-full object-cover shrink-0 ml-1 border border-[#31353d]"
            src={aresLogo}
          />
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="lg:hidden flex items-center justify-around bg-[#181c23] border-t border-[#262a32] px-2 py-1.5 overflow-x-auto text-nowrap">
        <button
          type="button"
          onClick={() => setCurrentTab('live-radar')}
          className={`px-2 py-1 text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider ${
            currentTab === 'live-radar'
              ? 'bg-[#00ff9d] text-[#00391f] font-bold'
              : 'text-[#b9cbbc]'
          }`}
        >
          LIVE RADAR
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('system-arch')}
          className={`px-2 py-1 text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider ${
            currentTab === 'system-arch'
              ? 'bg-[#00ff9d] text-[#00391f] font-bold'
              : 'text-[#b9cbbc]'
          }`}
        >
          STATE MACHINE
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('serial-telemetry')}
          className={`px-2 py-1 text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider ${
            currentTab === 'serial-telemetry'
              ? 'bg-[#00ff9d] text-[#00391f] font-bold'
              : 'text-[#b9cbbc]'
          }`}
        >
          DIAGNOSTICS
        </button>
      </div>
    </header>
  );
};
