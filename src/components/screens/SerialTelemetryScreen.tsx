import React, { useState, useEffect, useRef } from 'react';
import { TelemetryLog } from '../../types';
import { playSonarPing, playAlarmBuzzer } from '../../utils/audio';

interface SerialTelemetryScreenProps {
  currentAngle: number;
  setCurrentAngle: React.Dispatch<React.SetStateAction<number>>;
  targetLocked: boolean;
  setTargetLocked: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SerialTelemetryScreen: React.FC<SerialTelemetryScreenProps> = ({
  currentAngle,
  setCurrentAngle,
  targetLocked,
  setTargetLocked,
}) => {
  const [filter, setFilter] = useState<'all' | 'rx' | 'tx' | 'actuator' | 'err'>('all');
  const [isFrozen, setIsFrozen] = useState(false);
  const [uptimeSeconds, setUptimeSeconds] = useState(15505); // 04:18:25
  const [rxPacketCount, setRxPacketCount] = useState(48299);
  const [detectionThreshold, setDetectionThreshold] = useState(30);
  const [requiredHits, setRequiredHits] = useState(3);
  const [stepResolution, setStepResolution] = useState(2);
  const [cmdInput, setCmdInput] = useState('');
  const [eepromSaved, setEepromSaved] = useState(false);

  const [logs, setLogs] = useState<TelemetryLog[]>([
    { id: '1', timestamp: '14:22:14.884', prefix: 'RX', message: 'INIT_SYS: CALIBRATION_CYCLE_OK | ULTRASONIC_PING: 32ms | SERVO: HOMED', colorClass: 'text-[#b9cbbc]/60' },
    { id: '2', timestamp: '14:22:14.920', prefix: 'RX', message: 'ANGLE:68 DIST:44 STATUS:SCANNING CONFIRM:0/3 RESP:OFF', colorClass: 'text-[#b9cbbc]/70' },
    { id: '3', timestamp: '14:22:14.952', prefix: 'RX', message: 'ANGLE:70 DIST:43 STATUS:SCANNING CONFIRM:0/3 RESP:OFF', colorClass: 'text-[#b9cbbc]/70' },
    { id: '4', timestamp: '14:22:15.002', prefix: 'RX', message: 'ANGLE:72 DIST:22 STATUS:TARGET CONFIRM:1/3 RESP:OFF', colorClass: 'text-[#00e38b]' },
    { id: '5', timestamp: '14:22:15.018', prefix: 'RX', message: 'ANGLE:74 DIST:22 STATUS:TARGET CONFIRM:2/3 RESP:OFF', colorClass: 'text-[#00e38b] font-bold' },
    { id: '6', timestamp: '14:22:15.034', prefix: 'RX', message: 'ANGLE:74 DIST:22 STATUS:TARGET CONFIRM:3/3 RESP:ENGAGED', colorClass: 'text-[#00ff9d] font-bold bg-[#1c2027]' },
    { id: '7', timestamp: '14:22:15.050', prefix: 'TX', message: 'CMD_ACK_TRACK_LOCK_74_DEG :: SERVO_RSP_ALIGN:74 :: STROBE_ENABLE', colorClass: 'text-[#00daf3] font-bold bg-[#181c23]' },
    { id: '8', timestamp: '14:22:15.066', prefix: 'RX', message: 'ANGLE:76 DIST:23 STATUS:TARGET CONFIRM:3/3 RESP:ON [TRACKING]', colorClass: 'text-[#f4fff3]' },
    { id: '9', timestamp: '14:22:15.082', prefix: 'RX', message: 'ANGLE:76 DIST:22 STATUS:TARGET CONFIRM:3/3 RESP:ON [TRACKING]', colorClass: 'text-[#f4fff3]' },
    { id: '10', timestamp: '14:22:15.098', prefix: 'TX', message: 'TELEMETRY_SAMPLE_HEARTBEAT :: CURRENT_SERVO_PULSE:1520us', colorClass: 'text-[#00daf3]' },
  ]);

  const terminalRef = useRef<HTMLDivElement>(null);

  // Uptime tick
  useEffect(() => {
    const timer = setInterval(() => {
      setUptimeSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format uptime string HH:MM:SS.00
  const formatUptime = (secs: number) => {
    const hrs = String(Math.floor(secs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const sc = String(secs % 60).padStart(2, '0');
    return `${hrs}:${mins}:${sc}.00`;
  };

  // Continuous RX packet generator
  useEffect(() => {
    if (isFrozen) return;
    const interval = setInterval(() => {
      setRxPacketCount((c) => c + 1);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
        now.getSeconds()
      ).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

      const roundedAngle = Math.round(currentAngle);
      const isTargetSector = roundedAngle >= 72 && roundedAngle <= 78;

      let msg = '';
      let color = 'text-[#b9cbbc]';
      let prefix: 'RX' | 'TX' = 'RX';

      if (isTargetSector) {
        msg = `ANGLE:${roundedAngle} DIST:22 STATUS:TARGET CONFIRM:3/3 RESP:ENGAGED`;
        color = 'text-[#00ff9d] font-bold bg-[#1c2027]';
      } else {
        msg = `ANGLE:${roundedAngle} DIST:42 STATUS:SCANNING CONFIRM:0/3 RESP:OFF`;
        color = 'text-[#dfe2ed]';
      }

      setLogs((prev) => [
        ...prev.slice(-45),
        { id: String(Date.now() + Math.random()), timestamp: timeStr, prefix, message: msg, colorClass: color },
      ]);
    }, 450);

    return () => clearInterval(interval);
  }, [isFrozen, currentAngle]);

  // Auto-scroll
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;

    const opcode = cmdInput.trim().toUpperCase();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        timestamp: timeStr,
        prefix: 'TX',
        message: `DISPATCH_OPCODE: ${opcode}`,
        colorClass: 'text-[#00daf3] font-bold bg-[#181c23] px-1',
      },
    ]);

    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          timestamp: timeStr,
          prefix: 'RX',
          message: `ACK: ${opcode} [EXEC_OK (4ms)]`,
          colorClass: 'text-[#00e38b] font-bold',
        },
      ]);
    }, 120);

    playSonarPing(1300, 0.05);
    setCmdInput('');
  };

  const handleMacro = (cmd: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        timestamp: timeStr,
        prefix: 'TX',
        message: `CMD_MANUAL: ${cmd}`,
        colorClass: 'text-[#00daf3] font-bold',
      },
    ]);

    if (cmd === 'CALIBRATE') {
      playSonarPing(800, 0.1);
    } else if (cmd === 'REBOOT_MCU') {
      playAlarmBuzzer(2200, 3);
    } else {
      playSonarPing(1100, 0.05);
    }

    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          timestamp: timeStr,
          prefix: 'RX',
          message: `ACK_${cmd}_EXECUTED [STATUS 200]`,
          colorClass: 'text-[#00ff9d] font-bold',
        },
      ]);
    }, 90);
  };

  const handleSaveEeprom = () => {
    setEepromSaved(true);
    playSonarPing(1600, 0.1);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

    setLogs((prev) => [
      ...prev,
      { id: String(Date.now()), timestamp: timeStr, prefix: 'TX', message: 'SYS_CMD: WRITE_EEPROM_FLASH', colorClass: 'text-[#00daf3]' },
      { id: String(Date.now() + 1), timestamp: timeStr, prefix: 'RX', message: 'EEPROM_WRITE_SUCCESS: 64 BYTES COMMITTED', colorClass: 'text-[#00e38b] font-bold' },
    ]);

    setTimeout(() => setEepromSaved(false), 2000);
  };

  const handleInjectIncursion = () => {
    setCurrentAngle(90);
    setTargetLocked(true);
    playAlarmBuzzer(2000, 2);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        timestamp: timeStr,
        prefix: 'SIM',
        message: 'INJECTING_SYNTHETIC_TARGET: ANGLE:90 DIST:20cm',
        colorClass: 'text-[#ff3366] font-bold bg-[#ff3366]/10',
      },
    ]);
  };

  const handleInjectNoise = () => {
    playSonarPing(950, 0.08);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

    setLogs((prev) => [
      ...prev,
      { id: String(Date.now()), timestamp: timeStr, prefix: 'SIM', message: 'INJECTING_WHITE_NOISE: JITTER ±15cm TRIGGERED', colorClass: 'text-[#00daf3] font-bold' },
      { id: String(Date.now() + 1), timestamp: timeStr, prefix: 'RX', message: 'KALMAN_FILTER_ENGAGED: OUTLIER REJECTED (DIST: 12cm OUT_OF_BOUNDS)', colorClass: 'text-[#00ff9d]' },
    ]);
  };

  const handleSimulateTimeout = () => {
    playAlarmBuzzer(1500, 1);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

    setLogs((prev) => [
      ...prev,
      { id: String(Date.now()), timestamp: timeStr, prefix: 'SIM', message: 'TRANSDUCER_TIMEOUT_TRIGGERED: ECHO > 38ms', colorClass: 'text-[#ff3366] font-bold' },
    ]);
  };

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + logs.map(e => `"${e.timestamp}","${e.prefix}","${e.message}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ares_x_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonContent);
    link.setAttribute("download", `ares_x_telemetry_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter logs based on chip
  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'rx') return log.prefix === 'RX';
    if (filter === 'tx') return log.prefix === 'TX';
    if (filter === 'actuator') return log.message.includes('RESP') || log.message.includes('SERVO');
    if (filter === 'err') return log.message.includes('ERR') || log.message.includes('TIMEOUT');
    return true;
  });

  return (
    <div className="w-full flex flex-col font-['JetBrains_Mono']">
      {/* Top Telemetry Protocol Strip */}
      <section className="w-full px-4 py-2 bg-[#0a0e15] border-b border-[#1c2027]">
        <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-2 items-stretch">
          {/* Port Identification & Baud Metrics */}
          <div className="xl:col-span-4 bg-[#181c23] p-2 flex flex-col justify-between border border-[#262a32] shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse"></span>
                <span className="font-['Space_Mono'] font-bold text-xs text-[#00ff9d] uppercase tracking-wider">
                  PORT: /dev/ttyACM0
                </span>
              </div>
              <span className="text-[9px] text-[#00daf3] bg-[#1c2027] px-1.5 py-0.5 font-bold uppercase tracking-wider border border-[#262a32]">
                CH340 // ATmega328P
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 pt-1 bg-[#0a0e15]/60 p-1.5 border border-[#262a32]">
              <div>
                <div className="text-[9px] text-[#b9cbbc] uppercase">BAUD RATE</div>
                <div className="text-[11px] text-[#f4fff3] font-bold">115200 8-N-1</div>
              </div>
              <div>
                <div className="text-[9px] text-[#b9cbbc] uppercase">BUFFER (1024B)</div>
                <div className="text-[11px] text-[#00daf3] font-bold">31B (3% LOAD)</div>
              </div>
              <div>
                <div className="text-[9px] text-[#b9cbbc] uppercase">FLOW CTRL</div>
                <div className="text-[11px] text-[#dfe2ed] font-bold">DTR / RTS</div>
              </div>
            </div>
          </div>

          {/* MCU Runtime Diagnostics */}
          <div className="xl:col-span-5 bg-[#181c23] p-2 flex flex-col justify-between border border-[#262a32] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-['Space_Mono'] font-bold text-xs text-[#dfe2ed] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#00e38b]">memory</span>
                EMBEDDED MCU RUNTIME STATS
              </span>
              <span className="text-[9px] text-[#00e38b] font-bold">CORE CLK: 16.000 MHz</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2 pt-1 bg-[#0a0e15]/60 p-1.5 border border-[#262a32]">
              <div>
                <div className="text-[9px] text-[#b9cbbc] uppercase">SYS UPTIME</div>
                <div className="text-[11px] text-[#00ff9d] font-bold">{formatUptime(uptimeSeconds)}</div>
              </div>
              <div>
                <div className="text-[9px] text-[#b9cbbc] uppercase">RX PACKETS</div>
                <div className="text-[11px] text-[#f4fff3] font-bold">{rxPacketCount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] text-[#b9cbbc] uppercase">CHECKSUM ERR</div>
                <div className="text-[11px] text-[#00e38b] font-bold">0 (0.00%)</div>
              </div>
              <div>
                <div className="text-[9px] text-[#b9cbbc] uppercase">FRAME DROP</div>
                <div className="text-[11px] text-[#f4fff3] font-bold">0 [NONE]</div>
              </div>
            </div>
          </div>

          {/* Buffer Status & Quick Actions */}
          <div className="xl:col-span-3 bg-[#181c23] p-2 flex flex-col justify-between border border-[#262a32] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-[#b9cbbc] uppercase tracking-widest font-bold">BUFFER STATUS</span>
              <span className="text-[9px] text-[#00ff9d] font-bold px-1.5 py-0.5 bg-[#1c2027] border border-[#00ff9d]/30">
                {isFrozen ? 'FROZEN' : 'STREAMING'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setLogs([])}
                className="flex-1 py-1 px-1.5 bg-[#1c2027] hover:bg-[#262a32] text-[#dfe2ed] text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1 border border-[#262a32] cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">delete_sweep</span> CLEAR
              </button>
              <button
                type="button"
                onClick={() => setIsFrozen(!isFrozen)}
                className={`flex-1 py-1 px-1.5 text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1 border border-[#262a32] cursor-pointer ${
                  isFrozen ? 'bg-[#00daf3] text-[#00363d] font-bold' : 'bg-[#1c2027] hover:bg-[#262a32] text-[#00daf3]'
                }`}
              >
                <span className="material-symbols-outlined text-xs">{isFrozen ? 'play_arrow' : 'pause'}</span>
                {isFrozen ? 'RESUME' : 'FREEZE'}
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex-1 py-1 px-1.5 bg-[#00ff9d] text-[#00391f] text-[10px] uppercase tracking-wider font-bold shadow-sm transition-all hover:bg-[#00e38b] flex items-center justify-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">download</span> EXPORT
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Dual-Pane Telemetry System */}
      <section className="w-full px-4 py-3 flex-1">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* Left Pane: Terminal, Parser, Oscilloscope (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* Virtual Terminal Block */}
            <div className="w-full bg-[#0a0e15] p-3 shadow-md flex flex-col border border-[#1c2027]">
              {/* Terminal Header & Filter Chips */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 bg-[#181c23] px-2 py-1.5 border border-[#262a32]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#00ff9d]">terminal</span>
                  <span className="font-['Space_Mono'] font-bold text-xs text-[#00ff9d] uppercase tracking-wider">
                    LIVE TELEMETRY STREAM
                  </span>
                  <span className="text-[9px] text-[#b9cbbc] ml-1 hidden sm:inline">[ASCII / HEX FEED]</span>
                </div>
                {/* Filter Chips */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {(['all', 'rx', 'tx', 'actuator', 'err'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`px-2 py-0.5 text-[9px] uppercase tracking-wider cursor-pointer border ${
                        filter === f
                          ? 'bg-[#00ff9d] text-[#00391f] font-bold border-[#00ff9d]'
                          : 'bg-[#1c2027] text-[#b9cbbc] border-[#262a32] hover:bg-[#262a32]'
                      }`}
                    >
                      {f === 'err' ? 'ERRORS (0)' : f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Streaming Monospace Window */}
              <div
                ref={terminalRef}
                className="relative w-full h-[320px] bg-[#0a0e15] p-2 overflow-y-auto text-[11px] space-y-1 select-text scroll-smooth border border-[#1c2027]"
              >
                {filteredLogs.map((log) => (
                  <div key={log.id} className={`${log.colorClass || 'text-[#dfe2ed]'} flex items-start gap-2 py-0.5`}>
                    <span className="text-[#849587] shrink-0 text-[10px]">[{log.timestamp}]</span>
                    <span className="text-[#00daf3] shrink-0 text-[10px] font-bold">{log.prefix}:</span>
                    <span className="font-mono text-[10px]">{log.message}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 text-[#00ff9d] pt-1">
                  <span className="w-1.5 h-3 bg-[#00ff9d] animate-pulse inline-block"></span>
                  <span className="text-[9px] text-[#b9cbbc] tracking-wider uppercase font-bold">
                    RX BUS IDLE // LISTENING ON USB_FIFO...
                  </span>
                </div>
              </div>

              {/* Fast Dispatch Macros & Interactive Prompt */}
              <div className="mt-2 pt-2 bg-[#181c23] p-2 border border-[#262a32]">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[9px] text-[#00daf3] uppercase font-bold">FAST DISPATCH MACROS:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {['CALIBRATE', 'PING_TEST', 'SWEEP_STOP', 'RESET_TARGET'].map((macro) => (
                      <button
                        key={macro}
                        type="button"
                        onClick={() => handleMacro(macro)}
                        className="px-2 py-0.5 bg-[#1c2027] hover:bg-[#00ff9d] hover:text-[#00391f] text-[#dfe2ed] text-[9px] uppercase transition-colors cursor-pointer border border-[#262a32]"
                      >
                        {macro}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleMacro('REBOOT_MCU')}
                      className="px-2 py-0.5 bg-[#ff3366]/20 hover:bg-[#ff3366] hover:text-white text-[#ff3366] text-[9px] uppercase transition-colors cursor-pointer border border-[#ff3366]/40"
                    >
                      REBOOT_MCU
                    </button>
                  </div>
                </div>

                <form onSubmit={handleCommandSubmit} className="flex items-center gap-2 bg-[#0a0e15] px-2 py-1.5 border border-[#262a32]">
                  <span className="text-[10px] text-[#00ff9d] font-bold shrink-0">SEND CMD &gt;</span>
                  <input
                    type="text"
                    value={cmdInput}
                    onChange={(e) => setCmdInput(e.target.value)}
                    placeholder="Enter MCU opcode (e.g. SET_SWEEP_MIN 10, PING, STROBE_OVERRIDE)..."
                    className="flex-1 bg-transparent border-0 outline-none text-[#f4fff3] text-[11px] placeholder:text-[#849587]/50"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-[#00ff9d] text-[#00391f] font-['Space_Mono'] font-bold text-xs uppercase tracking-wider hover:bg-[#00e38b] transition-all shrink-0 cursor-pointer"
                  >
                    EXEC
                  </button>
                </form>
              </div>
            </div>

            {/* Real-Time Packet Protocol Inspector */}
            <div className="w-full bg-[#0a0e15] p-3 shadow-md border border-[#1c2027]">
              <div className="flex items-center justify-between pb-1 mb-2 bg-[#181c23] px-2 py-1 border border-[#262a32]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#00daf3]">data_object</span>
                  <span className="font-['Space_Mono'] font-bold text-xs text-[#00daf3] uppercase tracking-wider">
                    PACKET TOKEN PARSER
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px]">
                  <span className="text-[#b9cbbc] font-bold">FRAME: $ARX</span>
                  <span className="text-[#00ff9d] bg-[#1c2027] px-1.5 py-0.5 border border-[#00ff9d]/30 font-bold">
                    SYNCHRONIZED
                  </span>
                </div>
              </div>

              {/* Token Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="bg-[#181c23] p-2 border border-[#262a32]">
                  <div className="text-[9px] text-[#b9cbbc] uppercase">HEADER</div>
                  <div className="font-['Space_Mono'] font-bold text-sm text-[#00daf3] mt-0.5">0x53 0x54</div>
                  <div className="text-[9px] text-[#00ff9d] mt-0.5">[$ST / SYN]</div>
                </div>
                <div className="bg-[#181c23] p-2 border border-[#262a32]">
                  <div className="text-[9px] text-[#b9cbbc] uppercase">AZIMUTH ANGLE</div>
                  <div className="font-['Space_Mono'] font-bold text-sm text-[#f4fff3] mt-0.5">0x4A (74°)</div>
                  <div className="text-[9px] text-[#b9cbbc] mt-0.5">SERVO_POS</div>
                </div>
                <div className="bg-[#181c23] p-2 border border-[#262a32]">
                  <div className="text-[9px] text-[#b9cbbc] uppercase">ECHO DISTANCE</div>
                  <div className="font-['Space_Mono'] font-bold text-sm text-[#00ff9d] mt-0.5">0x16 (22cm)</div>
                  <div className="text-[9px] text-[#ff3366] mt-0.5">&lt; THRESHOLD</div>
                </div>
                <div className="bg-[#181c23] p-2 border border-[#262a32]">
                  <div className="text-[9px] text-[#b9cbbc] uppercase">VALIDATION BIT</div>
                  <div className="font-['Space_Mono'] font-bold text-sm text-[#00e38b] mt-0.5">0x07 (3/3)</div>
                  <div className="text-[9px] text-[#00e38b] mt-0.5">LOCKED [ACT]</div>
                </div>
                <div className="bg-[#181c23] p-2 border border-[#262a32]">
                  <div className="text-[9px] text-[#b9cbbc] uppercase">XOR CHECKSUM</div>
                  <div className="font-['Space_Mono'] font-bold text-sm text-[#bdf4ff] mt-0.5">0xB3 [OK]</div>
                  <div className="text-[9px] text-[#00ff9d] mt-0.5">PARITY VALID</div>
                </div>
              </div>

              {/* Raw Byte Stream Hexdump */}
              <div className="mt-2 p-1.5 bg-[#1c2027] text-[10px] text-[#dfe2ed] flex items-center justify-between overflow-x-auto border border-[#262a32]">
                <span className="text-[#849587] text-[9px] tracking-wider uppercase shrink-0 font-bold">
                  RAW BYTE STREAM:
                </span>
                <span className="text-[#00ff9d] tracking-widest font-mono font-bold">
                  53 54 00 4A 00 16 03 01 B3 0D 0A
                </span>
                <span className="text-[#00daf3] text-[9px] tracking-widest shrink-0 font-mono">
                  ST..J.....\r\n
                </span>
              </div>
            </div>

            {/* Sweep Radial Dispersion Graph (Oscilloscope Vector Wave) */}
            <div className="w-full bg-[#0a0e15] p-3 shadow-md border border-[#1c2027]">
              <div className="flex items-center justify-between pb-1 mb-2 bg-[#181c23] px-2 py-1 border border-[#262a32]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#00ff9d]">show_chart</span>
                  <span className="font-['Space_Mono'] font-bold text-xs text-[#00ff9d] uppercase tracking-wider">
                    SWEEP RADIAL DISPERSION GRAPH
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[9px]">
                  <span className="text-[#b9cbbc]">DISTANCE (cm) vs AZIMUTH (0° - 180°)</span>
                  <span className="text-[#ff3366] bg-[#1c2027] px-1.5 py-0.5 font-bold border border-[#ff3366]/40">
                    LOCK: 74° / 22cm
                  </span>
                </div>
              </div>

              <div className="relative w-full h-44 bg-[#181c23] overflow-hidden border border-[#262a32]">
                <svg className="absolute inset-0 w-full h-full text-[#3b4a3f]/30" preserveAspectRatio="none" viewBox="0 0 500 150">
                  {/* Grid lines */}
                  <line x1="0" y1="30" x2="500" y2="30" stroke="currentColor" strokeDasharray="2 4" strokeWidth="1" />
                  <line x1="0" y1="75" x2="500" y2="75" stroke="currentColor" strokeDasharray="2 4" strokeWidth="1" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="currentColor" strokeDasharray="2 4" strokeWidth="1" />
                  <line x1="125" y1="0" x2="125" y2="150" stroke="currentColor" strokeDasharray="2 4" strokeWidth="1" />
                  <line x1="250" y1="0" x2="250" y2="150" stroke="currentColor" strokeDasharray="2 4" strokeWidth="1" />
                  <line x1="375" y1="0" x2="375" y2="150" stroke="currentColor" strokeDasharray="2 4" strokeWidth="1" />

                  {/* Threshold line */}
                  <line x1="0" y1="95" x2="500" y2="95" stroke="#ff3366" strokeDasharray="4 2" strokeWidth="1" opacity="0.8" />
                  <text x="8" y="90" fill="#ff3366" fontSize="9" fontFamily="Space Mono" fontWeight="bold">
                    TRIGGER THRESHOLD: {detectionThreshold} CM
                  </text>

                  {/* Echo Waveform Path */}
                  <path
                    d="M 0,40 L 40,42 L 80,45 L 120,40 L 160,44 L 180,43 L 195,41 L 205,115 L 210,122 L 215,118 L 225,44 L 270,48 L 320,52 L 380,49 L 440,45 L 500,42"
                    fill="none"
                    stroke="#00daf3"
                    strokeWidth="1.8"
                  />

                  {/* Target Lock Reticle at 74 deg (pos 210) */}
                  <circle cx="210" cy="120" r="6" fill="rgba(255, 51, 102, 0.2)" stroke="#ff3366" strokeWidth="2" />
                  <circle cx="210" cy="120" r="2" fill="#00ff9d" />
                  <line x1="210" y1="0" x2="210" y2="150" stroke="#00ff9d" strokeWidth="1" opacity="0.6" />
                </svg>

                {/* Coordinate readouts over the chart */}
                <div className="absolute bottom-1 left-2 flex items-center gap-6 text-[9px] text-[#b9cbbc]">
                  <span>0° [L-BOUND]</span>
                  <span>45°</span>
                  <span>90° [NADIR]</span>
                  <span>135°</span>
                  <span>180° [R-BOUND]</span>
                </div>
                <div className="absolute top-2 right-2 bg-[#1c2027] px-1.5 py-0.5 text-[9px] text-[#00ff9d] border border-[#262a32]">
                  ACTIVE SAMPLE FREQ: 62.5 Hz
                </div>
              </div>
            </div>
          </div>

          {/* Right Pane: Health, Calibration, Metrics (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {/* Component Diagnostics Grid */}
            <div className="w-full bg-[#0a0e15] p-3 shadow-md border border-[#1c2027]">
              <div className="flex items-center justify-between pb-1 mb-2 bg-[#181c23] px-2 py-1 border border-[#262a32]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#00e38b]">precision_manufacturing</span>
                  <span className="font-['Space_Mono'] font-bold text-xs text-[#dfe2ed] uppercase tracking-wider">
                    HARDWARE HEALTH STATUS
                  </span>
                </div>
                <span className="text-[9px] text-[#00ff9d] bg-[#1c2027] px-1.5 py-0.5 font-bold border border-[#00ff9d]/30">
                  ALL SYSTEMS NOMINAL
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="p-2 bg-[#181c23] flex items-center justify-between border border-[#262a32]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00ff9d]"></span>
                    <div>
                      <div className="text-[10px] text-[#f4fff3] font-bold">ULTRASONIC TRANSDUCER (HC-SR04)</div>
                      <div className="text-[9px] text-[#b9cbbc]">Jitter: ±0.3cm | Latency: 12ms</div>
                    </div>
                  </div>
                  <span className="text-[9px] text-[#00ff9d] bg-[#1c2027] px-2 py-0.5 font-bold border border-[#00ff9d]/30">
                    ONLINE
                  </span>
                </div>

                <div className="p-2 bg-[#181c23] flex items-center justify-between border border-[#262a32]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00ff9d]"></span>
                    <div>
                      <div className="text-[10px] text-[#f4fff3] font-bold">SWEEP SERVO (MG996R #1)</div>
                      <div className="text-[9px] text-[#b9cbbc]">Duty: 1.52ms | Pos: 74° | Temp: 34°C</div>
                    </div>
                  </div>
                  <span className="text-[9px] text-[#00ff9d] bg-[#1c2027] px-2 py-0.5 font-bold border border-[#00ff9d]/30">
                    ONLINE
                  </span>
                </div>

                <div className="p-2 bg-[#181c23] flex items-center justify-between border border-[#262a32]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00ff9d]"></span>
                    <div>
                      <div className="text-[10px] text-[#f4fff3] font-bold">RESPONSE ACTUATOR (MG996R #2)</div>
                      <div className="text-[9px] text-[#b9cbbc]">Duty: 1.52ms | Pos: 74° | Holding Torque: ACT</div>
                    </div>
                  </div>
                  <span className="text-[9px] text-[#00e38b] bg-[#1c2027] px-2 py-0.5 font-bold border border-[#00e38b]/30">
                    ENGAGED
                  </span>
                </div>

                <div className="p-2 bg-[#181c23] flex items-center justify-between border border-[#262a32]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00daf3] animate-ping"></span>
                    <div>
                      <div className="text-[10px] text-[#00daf3] font-bold">PIEZO AUDITORY ALARM (PWM)</div>
                      <div className="text-[9px] text-[#b9cbbc]">Frequency: 2400 Hz | Duty Cycle: 50%</div>
                    </div>
                  </div>
                  <span className="text-[9px] text-[#00daf3] bg-[#1c2027] px-2 py-0.5 font-bold border border-[#00daf3]/30">
                    PULSING
                  </span>
                </div>

                <div className="p-2 bg-[#181c23] flex items-center justify-between border border-[#262a32]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#ff3366] animate-pulse"></span>
                    <div>
                      <div className="text-[10px] text-[#ff3366] font-bold">HIGH-LUMEN STROBE (ALERT)</div>
                      <div className="text-[9px] text-[#b9cbbc]">Pattern: 10Hz Continuous Intermittent</div>
                    </div>
                  </div>
                  <span className="text-[9px] text-[#ff3366] bg-[#1c2027] px-2 py-0.5 font-bold border border-[#ff3366]/30">
                    FLASHING
                  </span>
                </div>

                <div className="p-2 bg-[#181c23] flex items-center justify-between border border-[#262a32]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00ff9d]"></span>
                    <div>
                      <div className="text-[10px] text-[#f4fff3] font-bold">VCC 5V POWER BUS RAIL</div>
                      <div className="text-[9px] text-[#b9cbbc]">ADC Sensing: 5.02V Regulated | Ripple: &lt;15mV</div>
                    </div>
                  </div>
                  <span className="text-[9px] text-[#00ff9d] bg-[#1c2027] px-2 py-0.5 font-bold border border-[#00ff9d]/30">
                    STABLE
                  </span>
                </div>
              </div>
            </div>

            {/* Calibration & Threshold Parameters */}
            <div className="w-full bg-[#0a0e15] p-3 shadow-md border border-[#1c2027]">
              <div className="flex items-center justify-between pb-1 mb-2 bg-[#181c23] px-2 py-1 border border-[#262a32]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#00daf3]">tune</span>
                  <span className="font-['Space_Mono'] font-bold text-xs text-[#00daf3] uppercase tracking-wider">
                    CALIBRATION & PARAMETERS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveEeprom}
                  className={`text-[9px] uppercase font-bold transition-all cursor-pointer ${
                    eepromSaved ? 'text-[#00ff9d] underline' : 'text-[#00e38b] hover:underline'
                  }`}
                >
                  {eepromSaved ? 'SAVED TO FLASH!' : 'WRITE TO EEPROM'}
                </button>
              </div>

              <div className="space-y-3">
                {/* Distance Threshold Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#dfe2ed] uppercase">DETECTION DISTANCE THRESHOLD:</span>
                    <span className="text-[#00ff9d] font-bold">{detectionThreshold} cm</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    value={detectionThreshold}
                    onChange={(e) => setDetectionThreshold(Number(e.target.value))}
                    className="w-full accent-[#00ff9d] bg-[#1c2027] h-1.5 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[9px] text-[#b9cbbc]">
                    <span>5 cm (Point Blank)</span>
                    <span>80 cm (Long Range)</span>
                  </div>
                </div>

                {/* Verification Hits Required */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#dfe2ed] uppercase">VERIFICATION HITS REQUIRED:</span>
                    <span className="text-[#00daf3] font-bold">{requiredHits} READINGS</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((hits) => (
                      <button
                        key={hits}
                        type="button"
                        onClick={() => {
                          setRequiredHits(hits);
                          playSonarPing(800 + hits * 70, 0.04);
                        }}
                        className={`py-1 text-[10px] cursor-pointer border ${
                          requiredHits === hits
                            ? 'bg-[#00ff9d] text-[#00391f] font-bold border-[#00ff9d]'
                            : 'bg-[#1c2027] text-[#b9cbbc] border-[#262a32] hover:bg-[#262a32]'
                        }`}
                      >
                        {hits}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Servo Step Increments */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#dfe2ed] uppercase">SERVO STEP RESOLUTION:</span>
                    <span className="text-[#f4fff3] font-bold">{stepResolution}° INCREMENT</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[
                      { step: 1, label: '1° HIGH-RES' },
                      { step: 2, label: '2° BALANCED' },
                      { step: 3, label: '3° RAPID' },
                      { step: 5, label: '5° SPRINT' },
                    ].map(({ step, label }) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => {
                          setStepResolution(step);
                          playSonarPing(1000, 0.04);
                        }}
                        className={`flex-1 py-1 text-[9px] uppercase cursor-pointer border ${
                          stepResolution === step
                            ? 'bg-[#00ff9d] text-[#00391f] font-bold border-[#00ff9d]'
                            : 'bg-[#1c2027] text-[#dfe2ed] border-[#262a32] hover:bg-[#262a32]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sweep Bounds & Cutoff */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-[#181c23] p-1.5 border border-[#262a32]">
                    <div className="text-[9px] text-[#b9cbbc] uppercase">SWEEP BOUNDS</div>
                    <div className="font-['Space_Mono'] font-bold text-xs text-[#f4fff3] mt-0.5">0° - 180°</div>
                    <div className="text-[9px] text-[#00e38b] mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">lock</span> HARDWARE LIMIT
                    </div>
                  </div>
                  <div className="bg-[#181c23] p-1.5 border border-[#262a32]">
                    <div className="text-[9px] text-[#b9cbbc] uppercase">ECHO TIMEOUT</div>
                    <div className="font-['Space_Mono'] font-bold text-xs text-[#f4fff3] mt-0.5">38 ms</div>
                    <div className="text-[9px] text-[#b9cbbc] mt-0.5">~400cm MAX CUTOFF</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation & Noise Rejection Metrics */}
            <div className="w-full bg-[#0a0e15] p-3 shadow-md border border-[#1c2027]">
              <div className="flex items-center justify-between pb-1 mb-2 bg-[#181c23] px-2 py-1 border border-[#262a32]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#00ff9d]">filter_alt</span>
                  <span className="font-['Space_Mono'] font-bold text-xs text-[#00ff9d] uppercase tracking-wider">
                    NOISE REJECTION METRICS
                  </span>
                </div>
                <span className="text-[9px] text-[#00e38b] font-bold">KALMAN / MOVING-AVG</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#181c23] p-2 border border-[#262a32]">
                  <div className="text-[9px] text-[#b9cbbc] uppercase">OUTLIER REJECTION</div>
                  <div className="font-['Space_Mono'] font-bold text-sm text-[#00ff9d] mt-1">2.1%</div>
                  <div className="text-[9px] text-[#00e38b] mt-0.5">FILTER ACTIVE</div>
                </div>
                <div className="bg-[#181c23] p-2 border border-[#262a32]">
                  <div className="text-[9px] text-[#b9cbbc] uppercase">AVG WINDOW</div>
                  <div className="font-['Space_Mono'] font-bold text-sm text-[#00daf3] mt-1">N = 3</div>
                  <div className="text-[9px] text-[#b9cbbc] mt-0.5">MOVING MEDIAN</div>
                </div>
                <div className="bg-[#181c23] p-2 border border-[#262a32]">
                  <div className="text-[9px] text-[#b9cbbc] uppercase">LOST PERSISTENCE</div>
                  <div className="font-['Space_Mono'] font-bold text-sm text-[#dfe2ed] mt-1">5 SCANS</div>
                  <div className="text-[9px] text-[#b9cbbc] mt-0.5">DE-BOUNCE COOLDOWN</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lower Export & Test-Bench Simulator Action Controls */}
      <section className="w-full px-4 py-2 bg-[#0a0e15] border-t border-[#1c2027]">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Data Logging Output Control */}
          <div className="lg:col-span-6 flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-[#b9cbbc] uppercase font-bold tracking-wider">
              TELEMETRY RECORDING:
            </span>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-[#1c2027] hover:bg-[#262a32] text-[#f4fff3] font-['Space_Mono'] font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm border border-[#262a32] cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-[#00ff9d]">file_download</span>
              EXPORT CSV LOG
            </button>
            <button
              type="button"
              onClick={handleExportJSON}
              className="px-3 py-1.5 bg-[#1c2027] hover:bg-[#262a32] text-[#00daf3] font-['Space_Mono'] font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm border border-[#262a32] cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-[#00daf3]">code</span>
              EXPORT JSON STREAM
            </button>
            <button
              type="button"
              onClick={() => {
                setLogs([]);
                playSonarPing(600, 0.1);
              }}
              className="px-3 py-1.5 bg-[#1c2027] hover:bg-[#262a32] text-[#b9cbbc] font-['Space_Mono'] font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm border border-[#262a32] cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">memory</span>
              DUMP RING BUFFER
            </button>
          </div>

          {/* Test Bench Simulator / Hardware Mock Injection */}
          <div className="lg:col-span-6 flex flex-wrap items-center justify-end gap-1.5">
            <div className="flex items-center gap-1.5 bg-[#181c23] px-2 py-1 border border-[#262a32]">
              <span className="text-[9px] text-[#b9cbbc] uppercase font-bold">SYNTHETIC INJECTION:</span>
              <button
                type="button"
                onClick={handleInjectIncursion}
                className="px-2 py-0.5 bg-[#1c2027] hover:bg-[#ff3366] hover:text-white text-[#ff3366] text-[9px] uppercase font-bold tracking-wider transition-colors cursor-pointer border border-[#ff3366]/40"
              >
                INJECT INCURSION (20cm @ 90°)
              </button>
              <button
                type="button"
                onClick={handleInjectNoise}
                className="px-2 py-0.5 bg-[#1c2027] hover:bg-[#00daf3] hover:text-[#00363d] text-[#00daf3] text-[9px] uppercase font-bold tracking-wider transition-colors cursor-pointer border border-[#00daf3]/40"
              >
                BURST NOISE (±15cm)
              </button>
              <button
                type="button"
                onClick={handleSimulateTimeout}
                className="px-2 py-0.5 bg-[#1c2027] hover:bg-[#262a32] text-[#b9cbbc] text-[9px] uppercase tracking-wider transition-colors cursor-pointer border border-[#262a32]"
              >
                SIMULATE TIMEOUT
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
