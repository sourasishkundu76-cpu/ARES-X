import React, { useState, useEffect, useRef } from 'react';
import { ThreeCanvas } from '../ThreeCanvas';
import { RadarScope } from '../RadarScope';
import { Obstacle, SystemState, TelemetryLog } from '../../types';
import { WORKFLOW_STEPS } from '../../data/workflowSteps';
import { playSonarPing, playAlarmBuzzer, playServoCalibChirp } from '../../utils/audio';

interface LiveRadarTacticalScreenProps {
  currentAngle: number;
  setCurrentAngle: React.Dispatch<React.SetStateAction<number>>;
  isSimRunning: boolean;
  setIsSimRunning: React.Dispatch<React.SetStateAction<boolean>>;
  sweepDirection: number;
  setSweepDirection: React.Dispatch<React.SetStateAction<number>>;
  targetLocked: boolean;
  setTargetLocked: React.Dispatch<React.SetStateAction<boolean>>;
  obstacles: Obstacle[];
  setObstacles: React.Dispatch<React.SetStateAction<Obstacle[]>>;
}

export const LiveRadarTacticalScreen: React.FC<LiveRadarTacticalScreenProps> = ({
  currentAngle,
  setCurrentAngle,
  isSimRunning,
  setIsSimRunning,
  sweepDirection,
  setSweepDirection,
  targetLocked,
  setTargetLocked,
  obstacles,
  setObstacles,
}) => {
  const [viewMode, setViewMode] = useState<'3d' | 'split' | 'radar'>('split');
  const [cameraPreset, setCameraPreset] = useState<string>('OVERVIEW');
  const [showExplain, setShowExplain] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(8); // Step 09 Respond
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newAngle, setNewAngle] = useState<number>(90);
  const [newDistance, setNewDistance] = useState<number>(25);
  const [activeTab, setActiveTab] = useState<'specs' | 'packet'>('packet');
  const [isDemoRunning, setIsDemoRunning] = useState<boolean>(false);
  const [strobeTesting, setStrobeTesting] = useState<boolean>(false);

  // Serial Terminal Logs
  const [terminalLogs, setTerminalLogs] = useState<TelemetryLog[]>([
    { id: '1', timestamp: '00:00:14.202', prefix: 'RX', message: 'SYS_INIT: ATmega328P 16.000MHz OK' },
    { id: '2', timestamp: '00:00:14.218', prefix: 'RX', message: 'SONAR: HC-SR04 PULSE CALIBRATED' },
    { id: '3', timestamp: '00:00:14.234', prefix: 'RX', message: 'SWEEP_SERVO: HOMING 0° -> 180°' },
    { id: '4', timestamp: '00:00:14.540', prefix: 'RX', message: 'PING: θ=72° d=22.6cm CONFIRM=1/3', colorClass: 'text-[#00daf3]' },
    { id: '5', timestamp: '00:00:14.556', prefix: 'RX', message: 'PING: θ=73° d=22.5cm CONFIRM=2/3', colorClass: 'text-[#00daf3]' },
    { id: '6', timestamp: '00:00:14.572', prefix: 'RX', message: 'TARGET_LOCK: θ=74° d=22.4cm CONFIRM=3/3', colorClass: 'text-[#00ff9d] font-bold' },
    { id: '7', timestamp: '00:00:14.588', prefix: 'TX', message: 'RESPOND: SERVO_ALIGN=74° STROBE_ENABLE=1', colorClass: 'text-[#00e38b]' },
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Current detected obstacle (Object A by default)
  const lockedTarget = obstacles.find((o) => o.id === 'A') || obstacles[0] || null;

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // Periodic terminal updates matching sweep angle
  useEffect(() => {
    if (!isSimRunning) return;
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(
        now.getMilliseconds()
      ).padStart(3, '0')}`;

      const rounded = Math.round(currentAngle);
      const isNearLock = Math.abs(rounded - 74) < 3;

      const newLog: TelemetryLog = {
        id: String(Date.now() + Math.random()),
        timestamp: timeStr,
        prefix: isNearLock ? 'TX' : 'RX',
        message: isNearLock
          ? `TGT_DETECT: θ=${rounded}° d=22.4cm [ENGAGED SAFE STROBE]`
          : `SWEEP_POS: θ=${rounded}° d=38.5cm NOMINAL`,
        colorClass: isNearLock ? 'text-[#00ff9d] font-bold' : 'text-[#b9cbbc]',
      };

      setTerminalLogs((prev) => [...prev.slice(-30), newLog]);
    }, 900);

    return () => clearInterval(interval);
  }, [isSimRunning, currentAngle]);

  // Automated Professor Demo Sequence
  const handleStartDemo = () => {
    if (isDemoRunning) return;
    setIsDemoRunning(true);
    setIsSimRunning(true);

    const stages = [
      { stepIdx: 0, delay: 1000 },
      { stepIdx: 1, delay: 2200 },
      { stepIdx: 2, delay: 3500 },
      { stepIdx: 3, delay: 4800 },
      { stepIdx: 5, delay: 6200 },
      { stepIdx: 6, delay: 7500 },
      { stepIdx: 8, delay: 9000 },
      { stepIdx: 9, delay: 10500 },
      { stepIdx: 10, delay: 12000 },
      { stepIdx: 11, delay: 13500 },
    ];

    stages.forEach(({ stepIdx, delay }) => {
      setTimeout(() => {
        setActiveStepIndex(stepIdx);
        playSonarPing(700 + stepIdx * 60, 0.08);
      }, delay);
    });

    setTimeout(() => {
      setIsDemoRunning(false);
      setActiveStepIndex(8); // Reset to Respond step
    }, 14500);
  };

  const handleAddObstacle = (e: React.FormEvent) => {
    e.preventDefault();
    const newOb: Obstacle = {
      id: `CUSTOM_${Date.now()}`,
      name: `OBJ-${String.fromCharCode(65 + obstacles.length)}`,
      angleDeg: Number(newAngle),
      distanceCm: Number(newDistance),
      color: '#00daf3',
    };
    setObstacles((prev) => [...prev, newOb]);
    setShowAddModal(false);
    playSonarPing(1400, 0.1);
  };

  const handleStrobeTest = () => {
    setStrobeTesting(true);
    playAlarmBuzzer(1800, 3);
    setTimeout(() => setStrobeTesting(false), 800);
  };

  const handleBuzzerTest = () => {
    playAlarmBuzzer(2400, 2);
  };

  const handleServoCalib = () => {
    playServoCalibChirp();
  };

  const activeStep = WORKFLOW_STEPS[activeStepIndex] || WORKFLOW_STEPS[8];

  return (
    <div className="w-full flex flex-col font-['JetBrains_Mono']">
      {/* Viewport Toolbar */}
      <div className="w-full bg-[#0a0e15] px-4 py-2 flex flex-col gap-1.5 border-b border-[#1c2027] shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-['Space_Mono'] font-bold text-sm text-[#f4fff3] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#00e38b] text-base">memory</span>
              ARES-X LAB BENCH
            </span>
            <span className="text-[10px] text-[#b9cbbc] hidden sm:inline-block">
              // EMBEDDED SYSTEM PROTOTYPE v4.2
            </span>
            <div className="px-2 py-0.5 bg-[#00ff9d]/15 text-[#00ff9d] text-[10px] font-bold flex items-center gap-1 border border-[#00ff9d]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] animate-pulse"></span>
              <span>{isSimRunning ? 'SCANNING' : 'PAUSED'}</span>
            </div>
            <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 bg-[#1c2027] text-[#b9cbbc] text-[10px] border border-[#262a32]">
              <span>LOOP:</span>
              <span className="text-[#00daf3] font-bold">14.2ms</span>
              <span>| TOF:</span>
              <span className="text-[#00e38b] font-bold">1,306 µs</span>
            </div>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Switcher */}
            <div className="flex items-center bg-[#181c23] p-0.5 border border-[#262a32]">
              <button
                type="button"
                onClick={() => setViewMode('3d')}
                className={`px-2.5 py-1 text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === '3d'
                    ? 'bg-[#00e38b] text-[#00391f] font-bold shadow-sm'
                    : 'text-[#b9cbbc] hover:text-[#dfe2ed]'
                }`}
              >
                3D HARDWARE
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-[#00e38b] text-[#00391f] font-bold shadow-sm'
                    : 'text-[#b9cbbc] hover:text-[#dfe2ed]'
                }`}
              >
                SPLIT (DEMO)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('radar')}
                className={`px-2.5 py-1 text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'radar'
                    ? 'bg-[#00e38b] text-[#00391f] font-bold shadow-sm'
                    : 'text-[#b9cbbc] hover:text-[#dfe2ed]'
                }`}
              >
                RADAR SCOPE
              </button>
            </div>

            {/* Camera Presets */}
            <div className="hidden md:flex items-center bg-[#181c23] p-0.5 border border-[#262a32]">
              {(['OVERVIEW', 'TOP', 'FRONT', 'SIDE'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCameraPreset(preset)}
                  className={`px-2 py-0.5 text-[9px] uppercase transition-colors cursor-pointer ${
                    cameraPreset === preset ? 'text-[#00daf3] font-bold' : 'text-[#b9cbbc] hover:text-[#dfe2ed]'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCameraPreset('RESET')}
                title="Reset Camera"
                className="px-1.5 py-0.5 text-[#b9cbbc] hover:text-[#00e38b] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">restart_alt</span>
              </button>
            </div>

            {/* Explain Toggle */}
            <button
              type="button"
              onClick={() => setShowExplain(!showExplain)}
              className={`px-2.5 py-1 text-[10px] uppercase tracking-wider flex items-center gap-1 border border-[#31353d] transition-all cursor-pointer ${
                showExplain
                  ? 'bg-[#00daf3] text-[#00363d] font-bold'
                  : 'bg-[#1c2027] text-[#00daf3] hover:bg-[#262a32]'
              }`}
            >
              <span className="material-symbols-outlined text-xs">school</span>
              <span>EXPLAIN</span>
            </button>

            {/* Automated Demo Trigger */}
            <button
              type="button"
              onClick={handleStartDemo}
              className={`px-3 py-1 bg-[#00ff9d] text-[#00391f] font-['Space_Mono'] font-bold text-xs uppercase flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,157,0.35)] transition-all cursor-pointer ${
                isDemoRunning ? 'animate-pulse bg-[#00daf3]' : 'hover:scale-105 active:scale-95'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {isDemoRunning ? 'hourglass_top' : 'play_circle'}
              </span>
              <span>{isDemoRunning ? 'RUNNING DEMO...' : 'START DEMO'}</span>
            </button>
          </div>
        </div>

        {/* Pipeline banner */}
        <div className="flex items-center justify-between text-[#b9cbbc] text-[9px] bg-[#1c2027]/50 px-2 py-0.5 border border-[#262a32]/40 overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-3">
            <span className="text-[#00e38b] font-bold">PIPELINE:</span>
            <span className="text-[#dfe2ed]">
              SENSE → PROCESS → DECIDE → RESPOND → VERIFY → RESCAN → REPEAT
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#00daf3]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00daf3]"></span>
            <span>ATmega328P 16MHz • HC-SR04 SONAR • DUAL MG996R ACTUATORS</span>
          </div>
        </div>
      </div>

      {/* Educational Explain Mode Drawer */}
      {showExplain && (
        <div className="w-full bg-[#262a32] px-4 py-3 border-b border-[#3b4a3f] shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-[#0a0e15] border border-[#1c2027]">
              <div className="font-['Space_Mono'] font-bold text-xs text-[#00e38b] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-sm">timer</span>
                TIME OF FLIGHT (ToF) PHYSICS
              </div>
              <p className="text-[#b9cbbc] text-[11px] mb-2 leading-relaxed">
                Ultrasonic distance is measured via acoustic round-trip velocity at 20°C ambient (343.2 m/s):
              </p>
              <div className="p-1.5 bg-[#1c2027] text-[10px] text-[#00daf3] font-mono border border-[#262a32]">
                Distance = (High_Time_µs × 0.03432 cm/µs) / 2
              </div>
            </div>

            <div className="p-3 bg-[#0a0e15] border border-[#1c2027]">
              <div className="font-['Space_Mono'] font-bold text-xs text-[#00daf3] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-sm">filter_alt</span>
                MULTI-PING DE-BOUNCE ALGORITHM
              </div>
              <p className="text-[#b9cbbc] text-[11px] mb-2 leading-relaxed">
                Prevents atmospheric multipath reflections, temperature jitter, and stray sonic artifacts.
              </p>
              <div className="p-1.5 bg-[#1c2027] text-[10px] text-[#dfe2ed] font-mono border border-[#262a32]">
                Requires 3 consecutive range matches within ±2.5cm before transitioning to TARGET_CONFIRMED.
              </div>
            </div>

            <div className="p-3 bg-[#0a0e15] border border-[#1c2027]">
              <div className="font-['Space_Mono'] font-bold text-xs text-[#00ff9d] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-sm">shield</span>
                CLOSED-LOOP SAFETY DIRECTIVE
              </div>
              <p className="text-[#b9cbbc] text-[11px] mb-2 leading-relaxed">
                100% Non-projectile architecture strictly adhering to university lab and spectator safety regulations.
              </p>
              <div className="p-1.5 bg-[#1c2027] text-[10px] text-[#00e38b] font-mono border border-[#262a32]">
                Response servo locks bearing + 10Hz visual warning strobe beacon + continuous presence verification.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Dual Stage Viewport */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 min-h-[580px] bg-[#0a0e15]">
        {/* Left Pane: 3D Simulator */}
        {(viewMode === '3d' || viewMode === 'split') && (
          <div
            className={`relative h-[480px] lg:h-[600px] bg-[#0a0e15] overflow-hidden flex flex-col border-r border-[#1c2027] ${
              viewMode === '3d' ? 'lg:col-span-12' : 'lg:col-span-7'
            }`}
          >
            <ThreeCanvas
              currentAngle={currentAngle}
              obstacles={obstacles}
              targetLocked={targetLocked}
              lockedTarget={lockedTarget}
              cameraPreset={cameraPreset}
            />

            {/* 3D Viewport Header Overlay */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2 pointer-events-none">
              <div className="px-2 py-0.5 bg-[#0a0e15]/90 backdrop-blur-md text-[#00ff9d] text-[10px] flex items-center gap-1 border border-[#262a32]">
                <span className="material-symbols-outlined text-xs">view_in_ar</span>
                <span>THREE.JS REAL-TIME TWIN</span>
              </div>
              <div className="px-2 py-0.5 bg-[#0a0e15]/80 backdrop-blur-md text-[#b9cbbc] text-[10px] border border-[#262a32]">
                FRAME: <span className="text-[#00daf3]">60 FPS</span>
              </div>
            </div>

            {/* Angle & Distance Floating Readout HUD */}
            <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 pointer-events-none font-['JetBrains_Mono']">
              <div className="p-2.5 bg-[#0a0e15]/90 backdrop-blur-md border border-[#262a32] shadow-md min-w-[190px]">
                <div className="flex items-center justify-between text-[#b9cbbc] text-[9px] mb-0.5">
                  <span>SCAN ANGLE (θ)</span>
                  <span className="text-[#00e38b] font-bold">
                    {sweepDirection > 0 ? 'FORWARD' : 'REVERSE'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-['Space_Mono'] text-2xl font-bold text-[#f4fff3]">
                    {String(Math.round(currentAngle)).padStart(3, '0')}°
                  </span>
                  <span className="text-[9px] text-[#b9cbbc]">RANGE: 0° - 180°</span>
                </div>
                {/* Radial Mini Bar */}
                <div className="w-full bg-[#1c2027] h-1.5 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00e38b] to-[#00daf3] transition-all duration-75"
                    style={{ width: `${(currentAngle / 180) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-2 bg-[#0a0e15]/90 backdrop-blur-md border border-[#262a32] shadow-md min-w-[190px]">
                <div className="flex items-center justify-between text-[#b9cbbc] text-[9px]">
                  <span>PING TOF</span>
                  <span className="text-[#00daf3] font-bold">
                    {targetLocked ? '1,306 µs' : '2,244 µs'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#b9cbbc] text-[9px] mt-0.5">
                  <span>CALC DISTANCE</span>
                  <span className="text-[#00ff9d] font-bold font-['Space_Mono'] text-sm">
                    {targetLocked ? '22.4 cm' : '38.5 cm'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hardware Component Legend */}
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end pointer-events-none">
              <span className="px-2 py-0.5 bg-[#0a0e15]/85 backdrop-blur-md text-[9px] text-[#00e38b] flex items-center gap-1 border border-[#262a32]">
                <span className="w-1.5 h-1.5 bg-[#00e38b] rounded-full"></span>
                HC-SR04 ULTRASONIC TRANSDUCER
              </span>
              <span className="px-2 py-0.5 bg-[#0a0e15]/85 backdrop-blur-md text-[9px] text-[#00daf3] flex items-center gap-1 border border-[#262a32]">
                <span className="w-1.5 h-1.5 bg-[#00daf3] rounded-full"></span>
                SWEEP SERVO (MG996R METAL GEAR)
              </span>
              <span className="px-2 py-0.5 bg-[#0a0e15]/85 backdrop-blur-md text-[9px] text-[#b9cbbc] flex items-center gap-1 border border-[#262a32]">
                <span className="w-1.5 h-1.5 bg-[#b9cbbc] rounded-full"></span>
                ATMEGA328P R3 ARCHITECTURE
              </span>
              <span className="px-2 py-0.5 bg-[#0a0e15]/85 backdrop-blur-md text-[9px] text-[#00ff9d] flex items-center gap-1 border border-[#262a32]">
                <span className="w-1.5 h-1.5 bg-[#00ff9d] rounded-full"></span>
                RESPONSE SERVO + BEACON STROBE
              </span>
            </div>

            {/* Add Target Object Button & Modal */}
            <div className="absolute bottom-4 right-4 z-10">
              <button
                type="button"
                onClick={() => setShowAddModal(!showAddModal)}
                className="px-2.5 py-1.5 bg-[#262a32] hover:bg-[#353941] text-[#00daf3] text-[10px] flex items-center gap-1 shadow-md border border-[#3b4a3f] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add_box</span>
                <span>ADD TARGET OBJECT</span>
              </button>

              {showAddModal && (
                <form
                  onSubmit={handleAddObstacle}
                  className="absolute bottom-10 right-0 w-64 p-3 bg-[#0a0e15]/95 backdrop-blur-lg border border-[#262a32] shadow-2xl z-20 flex flex-col gap-2 font-['JetBrains_Mono']"
                >
                  <div className="font-['Space_Mono'] font-bold text-xs text-[#f4fff3] flex items-center justify-between">
                    <span>SIMULATE OBSTACLE</span>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="text-[#b9cbbc] hover:text-white"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-0.5 text-[9px] text-[#b9cbbc]">
                    <div className="flex justify-between">
                      <span>AZIMUTH ANGLE (θ):</span>
                      <span className="text-[#00daf3] font-bold">{newAngle}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      value={newAngle}
                      onChange={(e) => setNewAngle(Number(e.target.value))}
                      className="w-full accent-[#00daf3]"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 text-[9px] text-[#b9cbbc]">
                    <div className="flex justify-between">
                      <span>RADIAL DISTANCE (r):</span>
                      <span className="text-[#00e38b] font-bold">{newDistance} cm</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="45"
                      value={newDistance}
                      onChange={(e) => setNewDistance(Number(e.target.value))}
                      className="w-full accent-[#00e38b]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="mt-1 w-full py-1 bg-[#00e38b] text-[#00391f] font-['Space_Mono'] font-bold text-[10px] uppercase tracking-wider hover:bg-[#00ff9d] transition-all cursor-pointer"
                  >
                    INJECT INTO MATRIX
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Right Pane: Tactical Polar Radar Scope */}
        {(viewMode === 'radar' || viewMode === 'split') && (
          <div
            className={`relative h-[480px] lg:h-[600px] bg-[#181c23] flex flex-col p-2 ${
              viewMode === 'radar' ? 'lg:col-span-12' : 'lg:col-span-5'
            }`}
          >
            <RadarScope
              currentAngle={currentAngle}
              obstacles={obstacles}
              targetLocked={targetLocked}
              lockedTarget={lockedTarget}
              onSelectTarget={(ob) => {
                setCurrentAngle(ob.angleDeg);
                setTargetLocked(true);
                playSonarPing(1100, 0.08);
              }}
              confirmHits={targetLocked ? 3 : 1}
              requiredHits={3}
              confidence={targetLocked ? 94.8 : 28.5}
            />
          </div>
        )}
      </div>

      {/* 12-Stage Deterministic Closed-Loop Engine */}
      <div className="w-full bg-[#181c23] px-4 py-2 border-t border-b border-[#262a32]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-['Space_Mono'] font-bold text-xs text-[#f4fff3] flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-[#00e38b]">chevron_forward</span>
              12-STAGE DETERMINISTIC CLOSED-LOOP ENGINE
            </span>
            <span className="text-[10px] text-[#b9cbbc] hidden md:inline-block">
              // CLICK ANY STEP FOR SYSTEM SPECIFICATION
            </span>
          </div>
          <div className="text-[10px] text-[#00e38b] flex items-center gap-1">
            <span>CURRENT PHASE:</span>
            <span className="font-bold uppercase px-1.5 py-0.5 bg-[#1c2027] border border-[#262a32]">
              {activeStep.code} {activeStep.title} ({activeStepIndex === 8 ? 'SAFE STROBE & SERVO' : 'ACTIVE'})
            </span>
          </div>
        </div>

        {/* Sequence Pills Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isActive = idx === activeStepIndex;
            return (
              <button
                key={step.code}
                type="button"
                onClick={() => {
                  setActiveStepIndex(idx);
                  playSonarPing(600 + idx * 50, 0.05);
                }}
                className={`p-1 text-left transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[#00e38b] text-[#00391f] font-bold border-[#00ff9d] shadow-[0_0_8px_rgba(0,255,157,0.4)]'
                    : 'bg-[#1c2027] text-[#dfe2ed] border-[#262a32] hover:bg-[#262a32]'
                }`}
              >
                <div className={`text-[9px] ${isActive ? 'opacity-80' : 'text-[#b9cbbc]'}`}>
                  {step.code}
                </div>
                <div className="text-[10px] truncate">{step.title}</div>
              </button>
            );
          })}
        </div>

        {/* Step Engineering Detail Box */}
        <div className="mt-2 p-2 bg-[#0a0e15] grid grid-cols-1 md:grid-cols-5 gap-3 text-[10px] border border-[#262a32]">
          <div className="flex flex-col">
            <span className="text-[#b9cbbc] text-[9px] uppercase">STEP & PURPOSE:</span>
            <span className="text-[#00e38b] font-bold font-['Space_Mono'] text-xs">
              {activeStep.code} {activeStep.title}
            </span>
            <span className="text-[#dfe2ed] text-[10px] mt-0.5">{activeStep.purpose}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[#b9cbbc] text-[9px] uppercase">INPUT DATA:</span>
            <span className="text-[#00daf3] font-mono text-[10px]">{activeStep.input}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[#b9cbbc] text-[9px] uppercase">MICRO-PROCESS:</span>
            <span className="text-[#dfe2ed] text-[10px]">{activeStep.process}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[#b9cbbc] text-[9px] uppercase">OUTPUT TELEMETRY:</span>
            <span className="text-[#00ff9d] font-mono text-[10px]">{activeStep.output}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[#b9cbbc] text-[9px] uppercase">ENGINEERING PRINCIPLE:</span>
            <span className="text-[#bdf4ff] text-[10px]">{activeStep.principle}</span>
          </div>
        </div>
      </div>

      {/* Lower Control Console Deck */}
      <div className="w-full bg-[#0a0e15] p-3 grid grid-cols-1 xl:grid-cols-12 gap-3 border-b border-[#262a32]">
        {/* Motor Controls (4 Cols) */}
        <div className="xl:col-span-4 flex flex-col gap-2 bg-[#181c23] p-2 border border-[#262a32]">
          <div className="flex items-center justify-between pb-1 bg-[#1c2027] px-2 py-1 border border-[#262a32]">
            <div className="font-['Space_Mono'] font-bold text-xs text-[#00daf3] flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">tune</span>
              SWEEP MOTOR CONTROLS
            </div>
            <div className="text-[9px] text-[#b9cbbc]">PWM PIN D9</div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setIsSimRunning(!isSimRunning)}
              className="py-1.5 px-2 bg-[#00e38b] text-[#00391f] font-['Space_Mono'] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 hover:bg-[#00ff9d] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {isSimRunning ? 'pause' : 'play_arrow'}
              </span>
              <span>{isSimRunning ? 'PAUSE' : 'RESUME'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSweepDirection((d) => d * -1)}
              className="py-1.5 px-2 bg-[#262a32] hover:bg-[#353941] text-[#dfe2ed] font-['Space_Mono'] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer border border-[#3b4a3f]"
            >
              <span className="material-symbols-outlined text-sm">swap_horiz</span>
              <span>REVERSE</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentAngle(0);
                setSweepDirection(1);
              }}
              className="py-1.5 px-2 bg-[#262a32] hover:bg-[#353941] text-[#dfe2ed] font-['Space_Mono'] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer border border-[#3b4a3f]"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              <span>RESET</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setIsSimRunning(false);
                setCurrentAngle((a) => Math.max(0, a - 1));
              }}
              className="flex-1 py-1 bg-[#1c2027] hover:bg-[#262a32] text-[#dfe2ed] text-[10px] border border-[#262a32] cursor-pointer"
            >
              ◀ STEP -1°
            </button>
            <div className="px-3 py-1 bg-[#0a0e15] text-center text-[10px] text-[#00e38b] font-bold border border-[#262a32]">
              POS: {Math.round(currentAngle)}°
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSimRunning(false);
                setCurrentAngle((a) => Math.min(180, a + 1));
              }}
              className="flex-1 py-1 bg-[#1c2027] hover:bg-[#262a32] text-[#dfe2ed] text-[10px] border border-[#262a32] cursor-pointer"
            >
              STEP +1° ▶
            </button>
          </div>

          <div className="flex items-center justify-between text-[#b9cbbc] text-[9px] pt-1">
            <span>SWEEP RATE:</span>
            <div className="flex items-center gap-1">
              {[0.5, 1.0, 2.0, 3.0].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSpeedMultiplier(rate)}
                  className={`px-2 py-0.5 text-[9px] transition-colors cursor-pointer border ${
                    speedMultiplier === rate
                      ? 'bg-[#00e38b] text-[#00391f] font-bold border-[#00ff9d]'
                      : 'bg-[#1c2027] text-[#dfe2ed] border-[#262a32] hover:bg-[#262a32]'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Safe Non-Projectile Monitor (4 Cols) */}
        <div className="xl:col-span-4 flex flex-col gap-2 bg-[#181c23] p-2 border border-[#262a32]">
          <div className="flex items-center justify-between pb-1 bg-[#1c2027] px-2 py-1 border border-[#262a32]">
            <div className="font-['Space_Mono'] font-bold text-xs text-[#00e38b] flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              SAFE RESPONSE MONITOR
            </div>
            <div className="px-1.5 py-0.5 bg-[#00ff9d] text-[#00391f] text-[9px] font-bold">
              ENGAGED
            </div>
          </div>

          <div className="p-2 bg-[#0a0e15] border border-[#262a32]">
            <div className="flex items-center gap-1 text-[#00ff9d] mb-0.5 font-['Space_Mono'] font-bold text-[10px]">
              <span className="material-symbols-outlined text-xs text-[#00e38b]">check_circle</span>
              100% NON-PROJECTILE SAFETY DIRECTIVE
            </div>
            <p className="text-[#b9cbbc] text-[9px] leading-relaxed">
              Strictly compliant with University Laboratory Protocol: Physical response is restricted to an optical strobe indicator (Pin D13) and auxiliary direction tracking servo (Pin D10). Zero ballistics or kinetic hazards.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={handleStrobeTest}
              className="py-1 px-1 bg-[#1c2027] hover:bg-[#262a32] text-[#dfe2ed] text-[9px] uppercase flex flex-col items-center justify-center gap-0.5 border border-[#262a32] cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-[#00ff9d]">flare</span>
              <span>TEST STROBE</span>
            </button>
            <button
              type="button"
              onClick={handleBuzzerTest}
              className="py-1 px-1 bg-[#1c2027] hover:bg-[#262a32] text-[#dfe2ed] text-[9px] uppercase flex flex-col items-center justify-center gap-0.5 border border-[#262a32] cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-[#00daf3]">volume_up</span>
              <span>PIEZO BEEP</span>
            </button>
            <button
              type="button"
              onClick={handleServoCalib}
              className="py-1 px-1 bg-[#1c2027] hover:bg-[#262a32] text-[#dfe2ed] text-[9px] uppercase flex flex-col items-center justify-center gap-0.5 border border-[#262a32] cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-[#00e38b]">settings_backup_restore</span>
              <span>CALIB SERVO</span>
            </button>
          </div>

          <div className="flex items-center justify-between px-2 py-1 bg-[#0a0e15] border border-[#262a32]">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  strobeTesting ? 'bg-white shadow-[0_0_12px_#ffffff]' : 'bg-[#00ff9d] shadow-[0_0_8px_#00ff9d] animate-ping'
                }`}
              />
              <span className="text-[9px] text-[#dfe2ed]">WARNING STROBE (10Hz)</span>
            </div>
            <span className="text-[9px] text-[#00e38b] font-bold">ACTIVE LOCK</span>
          </div>
        </div>

        {/* Live Hardware Telemetry & Serial Console (4 Cols) */}
        <div className="xl:col-span-4 flex flex-col gap-2 bg-[#181c23] p-2 border border-[#262a32]">
          <div className="flex items-center justify-between pb-1 bg-[#1c2027] px-2 py-1 border border-[#262a32]">
            <div className="font-['Space_Mono'] font-bold text-xs text-[#00daf3] flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">terminal</span>
              SERIAL TELEMETRY (115200 BAUD)
            </div>
            <div className="flex items-center gap-1 text-[#b9cbbc] text-[9px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] animate-pulse"></span>
              <span>UART RX/TX</span>
            </div>
          </div>

          <div className="h-28 w-full bg-[#0a0e15] p-2 font-mono text-[10px] overflow-y-auto text-[#dfe2ed] flex flex-col gap-0.5 border border-[#262a32]">
            {terminalLogs.map((log) => (
              <div key={log.id} className={log.colorClass || 'text-[#b9cbbc]'}>
                <span className="text-[#849587]">[{log.timestamp}]</span>{' '}
                <span className="font-bold">{log.prefix}:</span> {log.message}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>

          <div className="grid grid-cols-4 gap-1 text-center text-[9px]">
            <div className="p-1 bg-[#0a0e15] border border-[#262a32]">
              <div className="text-[#849587]">CORE CLK</div>
              <div className="text-[#dfe2ed] font-bold">16.0 MHz</div>
            </div>
            <div className="p-1 bg-[#0a0e15] border border-[#262a32]">
              <div className="text-[#849587]">VCC VOLT</div>
              <div className="text-[#00daf3] font-bold">5.02 V</div>
            </div>
            <div className="p-1 bg-[#0a0e15] border border-[#262a32]">
              <div className="text-[#849587]">SAMP RATE</div>
              <div className="text-[#dfe2ed] font-bold">62.5 Hz</div>
            </div>
            <div className="p-1 bg-[#0a0e15] border border-[#262a32]">
              <div className="text-[#849587]">SRAM FREE</div>
              <div className="text-[#00e38b] font-bold">1,482 B</div>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture & Packet Flow Drawer */}
      <div className="w-full bg-[#181c23] px-4 py-2 border-b border-[#262a32]">
        <div className="flex items-center justify-between pb-1 mb-2 bg-[#1c2027] px-2 py-1 border border-[#262a32]">
          <div className="font-['Space_Mono'] font-bold text-xs text-[#f4fff3] flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-[#00daf3]">account_tree</span>
            EMBEDDED HARDWARE ARCHITECTURE & PACKET FLOW
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('specs')}
              className={`px-2.5 py-0.5 text-[10px] uppercase transition-all cursor-pointer border ${
                activeTab === 'specs'
                  ? 'bg-[#00e38b] text-[#00391f] font-bold border-[#00ff9d]'
                  : 'bg-[#1c2027] text-[#dfe2ed] border-[#262a32] hover:bg-[#262a32]'
              }`}
            >
              HARDWARE SPECS
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('packet')}
              className={`px-2.5 py-0.5 text-[10px] uppercase transition-all cursor-pointer border ${
                activeTab === 'packet'
                  ? 'bg-[#00e38b] text-[#00391f] font-bold border-[#00ff9d]'
                  : 'bg-[#1c2027] text-[#dfe2ed] border-[#262a32] hover:bg-[#262a32]'
              }`}
            >
              DATA PIPELINE
            </button>
          </div>
        </div>

        {activeTab === 'specs' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-[#0a0e15] border border-[#262a32]">
              <div className="font-['Space_Mono'] font-bold text-xs text-[#00e38b] mb-1">
                HC-SR04 SENSOR MODULE
              </div>
              <ul className="text-[#b9cbbc] text-[10px] space-y-1">
                <li>• Operating Voltage: 5V DC</li>
                <li>• Quiescent Current: &lt; 2mA</li>
                <li>• Ultrasonic Frequency: 40 kHz Soundwave</li>
                <li>• Max Range: 400 cm | Min: 2 cm</li>
                <li>• Measuring Angle: 15 degrees cone</li>
                <li>• Trigger Pulse: 10µs TTL pulse input</li>
              </ul>
            </div>
            <div className="p-3 bg-[#0a0e15] border border-[#262a32]">
              <div className="font-['Space_Mono'] font-bold text-xs text-[#00daf3] mb-1">
                TOWER PRO MG996R SERVOS
              </div>
              <ul className="text-[#b9cbbc] text-[10px] space-y-1">
                <li>• Gear Type: Full Metal Brass Gearbox</li>
                <li>• Stall Torque: 10.0 kg-cm at 4.8V</li>
                <li>• Operating Speed: 0.20 sec/60° at 4.8V</li>
                <li>• Rotation: Sweep 0-180° (Dual Independent Axes)</li>
                <li>• Pulse Cycle: 20ms (50Hz PWM signal)</li>
                <li>• Decoupling: Dual 100µF Low-ESR Electrolytics</li>
              </ul>
            </div>
            <div className="p-3 bg-[#0a0e15] border border-[#262a32]">
              <div className="font-['Space_Mono'] font-bold text-xs text-[#f4fff3] mb-1">
                ATMEGA328P MICROCONTROLLER
              </div>
              <ul className="text-[#b9cbbc] text-[10px] space-y-1">
                <li>• Architecture: 8-bit AVR RISC Harvard</li>
                <li>• Flash Memory: 32 KB (0.5KB for bootloader)</li>
                <li>• SRAM: 2 KB internal static RAM</li>
                <li>• Hardware Timers: Timer1 16-bit ICP1 Input Capture</li>
                <li>• Interrupt Latency: 4 clock cycles (250ns)</li>
                <li>• Serial Baud: 115,200 bps (0.7% error rate at 16MHz)</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[10px]">
            <div className="p-2 bg-[#0a0e15] flex flex-col justify-between border border-[#262a32]">
              <div>
                <div className="text-[#00e38b] font-bold">1. TRANSDUCER EMIT</div>
                <div className="text-[#b9cbbc] mt-1 text-[9px] leading-relaxed">
                  10µs TRIG pulse triggers 8-cycle 40kHz sonic burst. Echo pin goes HIGH.
                </div>
              </div>
              <div className="mt-2 text-[#dfe2ed] font-mono text-[9px]">PULSE: 40,000 Hz</div>
            </div>

            <div className="p-2 bg-[#0a0e15] flex flex-col justify-between border border-[#262a32]">
              <div>
                <div className="text-[#00daf3] font-bold">2. TIMER1 CAPTURE</div>
                <div className="text-[#b9cbbc] mt-1 text-[9px] leading-relaxed">
                  ICP1 pin interrupt fires on Echo falling edge. ToF duration locked with 0.5µs resolution.
                </div>
              </div>
              <div className="mt-2 text-[#00daf3] font-mono text-[9px]">DURATION: 1,306 µs</div>
            </div>

            <div className="p-2 bg-[#0a0e15] flex flex-col justify-between border border-[#262a32]">
              <div>
                <div className="text-[#00ff9d] font-bold">3. RANGE ENGINE</div>
                <div className="text-[#b9cbbc] mt-1 text-[9px] leading-relaxed">
                  Calculates Distance: 22.4 cm. Checks boundary threshold (&lt;30cm) + 3-ping tolerance filter.
                </div>
              </div>
              <div className="mt-2 text-[#00ff9d] font-mono text-[9px]">CONFIDENCE: 94.8%</div>
            </div>

            <div className="p-2 bg-[#0a0e15] flex flex-col justify-between border border-[#262a32]">
              <div>
                <div className="text-[#bdf4ff] font-bold">4. ACTION DISPATCH</div>
                <div className="text-[#b9cbbc] mt-1 text-[9px] leading-relaxed">
                  MCU asserts Pin D10 (Response Servo PWM) to 74° and drives Pin D13 (Strobe Beacon) at 10Hz.
                </div>
              </div>
              <div className="mt-2 text-[#bdf4ff] font-mono text-[9px]">RESPONSE: SAFE LOCK</div>
            </div>

            <div className="p-2 bg-[#0a0e15] flex flex-col justify-between border border-[#262a32]">
              <div>
                <div className="text-[#00e38b] font-bold">5. TELEMETRY FRAME</div>
                <div className="text-[#b9cbbc] mt-1 text-[9px] leading-relaxed">
                  ASCII packet emitted via USART TX register to Workstation Tactical Scope at 115200 baud.
                </div>
              </div>
              <div className="mt-2 text-[#00e38b] font-mono text-[9px]">FRAME: 14.2ms LATENCY</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
