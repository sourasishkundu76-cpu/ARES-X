import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LiveRadarTacticalScreen } from './components/screens/LiveRadarTacticalScreen';
import { SerialTelemetryScreen } from './components/screens/SerialTelemetryScreen';
import { SystemArchitectureScreen } from './components/screens/SystemArchitectureScreen';
import { Obstacle } from './types';
import { playAlarmBuzzer } from './utils/audio';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'live-radar' | 'system-arch' | 'serial-telemetry'>('live-radar');
  const [currentAngle, setCurrentAngle] = useState<number>(74);
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);
  const [sweepDirection, setSweepDirection] = useState<number>(1);
  const [targetLocked, setTargetLocked] = useState<boolean>(true);
  const [isAborted, setIsAborted] = useState<boolean>(false);

  // Default Obstacles matching the prompt specifications
  const [obstacles, setObstacles] = useState<Obstacle[]>([
    {
      id: 'A',
      name: 'TGT-01',
      angleDeg: 74,
      distanceCm: 22.4,
      color: '#ff3366',
      isThreat: true,
      locked: true,
    },
    {
      id: 'B',
      name: 'TGT-02',
      angleDeg: 135,
      distanceCm: 32.0,
      color: '#00daf3',
      isThreat: false,
    },
    {
      id: 'C',
      name: 'TGT-03',
      angleDeg: 35,
      distanceCm: 18.0,
      color: '#00daf3',
      isThreat: false,
    },
  ]);

  // Main Simulation Loop
  useEffect(() => {
    if (!isSimRunning || isAborted) return;

    const interval = setInterval(() => {
      setCurrentAngle((prevAngle) => {
        let nextAngle = prevAngle + sweepDirection * 0.9;
        let nextDir = sweepDirection;

        if (nextAngle >= 180) {
          nextAngle = 180;
          nextDir = -1;
          setSweepDirection(-1);
        } else if (nextAngle <= 0) {
          nextAngle = 0;
          nextDir = 1;
          setSweepDirection(1);
        }

        // Check if any obstacle is in beam path (within ±5 degrees) and <= 30cm
        const hit = obstacles.find((ob) => Math.abs(ob.angleDeg - nextAngle) <= 5.5 && ob.distanceCm <= 30.0);
        setTargetLocked(!!hit);

        return nextAngle;
      });
    }, 35);

    return () => clearInterval(interval);
  }, [isSimRunning, sweepDirection, obstacles, isAborted]);

  const handleToggleSimulate = () => {
    setIsSimRunning(!isSimRunning);
  };

  const handleAbort = () => {
    if (isAborted) {
      setIsAborted(false);
      setIsSimRunning(true);
    } else {
      setIsAborted(true);
      setIsSimRunning(false);
      setTargetLocked(false);
      playAlarmBuzzer(2800, 4);
    }
  };

  return (
    <div className="min-h-screen bg-[#10131b] text-[#dfe2ed] flex flex-col font-['JetBrains_Mono'] select-none">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isSimulating={isSimRunning}
        onToggleSimulate={handleToggleSimulate}
        onAbort={handleAbort}
        isAborted={isAborted}
      />

      {/* Main Content Area */}
      <main className="w-full pt-20 pb-14 flex-1 flex flex-col">
        {isAborted && (
          <div className="w-full bg-[#ff3366] text-white px-4 py-2 text-center text-xs font-['Space_Mono'] font-bold flex items-center justify-center gap-2 animate-pulse shadow-lg z-30">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>EMERGENCY ABORT ENGAGED: ACTUATORS SAFED // HIGH-VOLTAGE RAILS DISCONNECTED // RE-PRESS ABORT TO RESET</span>
          </div>
        )}

        {currentTab === 'live-radar' && (
          <LiveRadarTacticalScreen
            currentAngle={currentAngle}
            setCurrentAngle={setCurrentAngle}
            isSimRunning={isSimRunning}
            setIsSimRunning={setIsSimRunning}
            sweepDirection={sweepDirection}
            setSweepDirection={setSweepDirection}
            targetLocked={targetLocked}
            setTargetLocked={setTargetLocked}
            obstacles={obstacles}
            setObstacles={setObstacles}
          />
        )}

        {currentTab === 'system-arch' && <SystemArchitectureScreen />}

        {currentTab === 'serial-telemetry' && (
          <SerialTelemetryScreen
            currentAngle={currentAngle}
            setCurrentAngle={setCurrentAngle}
            targetLocked={targetLocked}
            setTargetLocked={setTargetLocked}
          />
        )}
      </main>

      {/* Fixed Bottom Footer */}
      <Footer
        currentAngle={currentAngle}
        targetCount={targetLocked ? 1 : 0}
        actuatorEngaged={targetLocked}
        loopLatencyMs={14}
        isLinkActive={!isAborted}
      />
    </div>
  );
}
