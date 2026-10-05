import React, { useState } from 'react';
import { playSonarPing, playAlarmBuzzer } from '../../utils/audio';

interface StateNode {
  id: string;
  code: string;
  name: string;
  category: 'SETUP' | 'ACQUISITION' | 'ANALYSIS' | 'RESPONSE' | 'SUPERVISION';
  entryAction: string;
  duringAction: string;
  exitGuard: string;
  isrBinding: string;
  timeoutMs: number;
}

const FSM_STATES: StateNode[] = [
  {
    id: 'boot',
    code: 'S01',
    name: 'BOOT_INIT',
    category: 'SETUP',
    entryAction: 'Init DDRB/DDRD register bitmasks; configure USART0 at 115200 baud 8-N-1.',
    duringAction: 'Allocate Timer1 registers, enable global interrupts (sei), power-on self test.',
    exitGuard: 'RAM_CHECK == OK && UART_READY == 1',
    isrBinding: 'RESET_vect',
    timeoutMs: 50,
  },
  {
    id: 'calibrate',
    code: 'S02',
    name: 'CALIBRATE_HOMING',
    category: 'SETUP',
    entryAction: 'Assert OC1A PWM to 0° pulse (1000µs), dwell 300ms, then step to 180° (2000µs).',
    duringAction: 'Verify mechanical limit stops, sample ADC0 ambient baseline temperature.',
    exitGuard: 'HOMING_COMPLETE == 1 && CURRENT_DRAW < 1.2A',
    isrBinding: 'TIMER1_COMPA_vect',
    timeoutMs: 800,
  },
  {
    id: 'sweep',
    code: 'S03',
    name: 'SECTOR_SWEEP',
    category: 'ACQUISITION',
    entryAction: 'Increment OCR1A by current step resolution (default 2° = +11.1µs PWM duty).',
    duringAction: 'Hold servo position for 4.0ms acoustic mechanical dampening.',
    exitGuard: 'SERVO_SETTLED == 1',
    isrBinding: 'TIMER1_OVF_vect',
    timeoutMs: 14,
  },
  {
    id: 'ping',
    code: 'S04',
    name: 'TOF_ULTRASONIC_PING',
    category: 'ACQUISITION',
    entryAction: 'Assert PORTB4 (Trig) HIGH for 10µs, arm Timer1 Input Capture Noise Canceler.',
    duringAction: 'Timer1 ICP1 captures rising edge, switches edge detector to falling edge.',
    exitGuard: 'ECHO_FALLING_EDGE_CAPTURED || TOF_TIMEOUT > 38ms',
    isrBinding: 'TIMER1_CAPT_vect',
    timeoutMs: 38,
  },
  {
    id: 'validate',
    code: 'S05',
    name: 'SIGNAL_GATE_VALIDATION',
    category: 'ANALYSIS',
    entryAction: 'Compute distance = (ICR1_ticks × 0.5µs × 0.03432 cm/µs) / 2.',
    duringAction: 'Apply boundary gating (reject distance < 2cm and distance > 400cm).',
    exitGuard: 'DISTANCE >= 2.0 && DISTANCE <= 400.0',
    isrBinding: 'SYNCHRONOUS_EXEC',
    timeoutMs: 1,
  },
  {
    id: 'threshold',
    code: 'S06',
    name: 'PERIMETER_CHECK (<30cm)',
    category: 'ANALYSIS',
    entryAction: 'Compare validated distance against active EEPROM perimeter threshold (30.0cm).',
    duringAction: 'If distance <= 30.0cm: push sample to Ring Buffer FIFO, increment candidate count.',
    exitGuard: 'DISTANCE <= THRESHOLD ? GOTO CONFIRM : GOTO RESCAN',
    isrBinding: 'SYNCHRONOUS_EXEC',
    timeoutMs: 1,
  },
  {
    id: 'confirm',
    code: 'S07',
    name: 'MULTI_PING_DEBOUNCE',
    category: 'ANALYSIS',
    entryAction: 'Evaluate consecutive readings inside sector for variance <= ±2.5cm.',
    duringAction: 'Prevent false alarms from air turbulence, stray multipath, and RF noise bursts.',
    exitGuard: 'CONSECUTIVE_HITS >= 3',
    isrBinding: 'SYNCHRONOUS_EXEC',
    timeoutMs: 45,
  },
  {
    id: 'lock',
    code: 'S08',
    name: 'TARGET_LOCK_ACQUIRED',
    category: 'RESPONSE',
    entryAction: 'Lock Azimuth angle θ and Radial distance r into SRAM TARGET_STRUCT.',
    duringAction: 'Compute Cartesian coordinates: X = r·cos(θ), Y = r·sin(θ); generate $ARX frame.',
    exitGuard: 'LOCK_FLAG_ASSERTED == 1',
    isrBinding: 'USART_TX_vect',
    timeoutMs: 2,
  },
  {
    id: 'respond',
    code: 'S09',
    name: 'SAFE_RESPONSE_ENGAGED',
    category: 'RESPONSE',
    entryAction: 'Align Response Servo (OC1B) bearing to θ; drive Optocoupled 10Hz Strobe (PB5).',
    duringAction: '100% Non-projectile deterrence strictly adhering to lab human-proximity protocols.',
    exitGuard: 'RESPONSE_ACTUATOR_ALIGNED && OPTICAL_WARNING_ACTIVE',
    isrBinding: 'TIMER2_COMPA_vect (10Hz PWM)',
    timeoutMs: 100,
  },
  {
    id: 'watchdog',
    code: 'S10',
    name: 'PERSISTENCE_WATCHDOG',
    category: 'SUPERVISION',
    entryAction: 'Perform continuous stationary ToF interrogation at locked azimuth θ.',
    duringAction: 'Decrement persistence decay counter if target returns echo > threshold.',
    exitGuard: 'TARGET_PERSISTENT == TRUE',
    isrBinding: 'WDT_vect',
    timeoutMs: 250,
  },
  {
    id: 'disengage',
    code: 'S11',
    name: 'TARGET_LOST_DISENGAGE',
    category: 'SUPERVISION',
    entryAction: 'Disable 10Hz Optical Strobe, return Response Servo to neutral park position.',
    duringAction: 'Reset hit verification counter (0/3), emit TARGET_EVACUATED telemetry log.',
    exitGuard: 'ACTUATORS_SAFED == 1',
    isrBinding: 'SYNCHRONOUS_EXEC',
    timeoutMs: 15,
  },
  {
    id: 'rescan',
    code: 'S12',
    name: 'CONTINUOUS_RESCAN_LOOP',
    category: 'SUPERVISION',
    entryAction: 'Resume sector sweep stepping towards opposite angular bound (0° ↔ 180°).',
    duringAction: 'Maintain deterministic 14.2ms superloop execution latency.',
    exitGuard: 'NEXT_CYCLE_PENDING == 1',
    isrBinding: 'TIMER0_COMPA_vect',
    timeoutMs: 14,
  },
];

const PINOUT_DATA = [
  { pin: 'D8 (PB0)', type: 'INPUT', function: 'TIMER1 ICP1', connected: 'HC-SR04 Echo Pin', specs: 'Input Capture, 0.5µs clock resolution, Schmitt trigger noise canceler' },
  { pin: 'D12 (PB4)', type: 'OUTPUT', function: 'GPIO OUT', connected: 'HC-SR04 Trig Pin', specs: '10µs TTL pulse initiation, high-drive CMOS buffer' },
  { pin: 'D9 (PB1)', type: 'OUTPUT', function: 'TIMER1 OC1A', connected: 'Sweep Servo MG996R #1', specs: '50Hz Hardware PWM, 1.0ms to 2.0ms duty cycle, 16-bit register' },
  { pin: 'D10 (PB2)', type: 'OUTPUT', function: 'TIMER1 OC1B', connected: 'Response Actuator MG996R #2', specs: '50Hz Hardware PWM, target bearing alignment, optocoupled control' },
  { pin: 'D13 (PB5)', type: 'OUTPUT', function: 'TIMER2 OC2A', connected: 'High-Intensity Optical Strobe', specs: '10Hz strobe rate, 4N35 optoisolator into IRLZ44N Logic-Level N-MOSFET' },
  { pin: 'D11 (PB3)', type: 'OUTPUT', function: 'TIMER2 OC2B', connected: 'Piezo Buzzer Audible Alarm', specs: '2.4 kHz resonant frequency tone generator, 50% duty square wave' },
  { pin: 'A0 (PC0)', type: 'INPUT', function: 'ADC CHANNEL 0', connected: 'VCC 5V Rail Sensing', specs: '10-bit Successive Approximation ADC, 1.1V internal bandgap reference' },
  { pin: 'D0 / D1', type: 'I/O', function: 'USART0 RX/TX', connected: 'CH340 USB-UART Bridge', specs: '115200 Baud 8-N-1, DMA FIFO simulation, 0.7% clock skew tolerance' },
];

export const SystemArchitectureScreen: React.FC = () => {
  const [selectedStateId, setSelectedStateId] = useState<string>('respond');
  const [activeTab, setActiveTab] = useState<'fsm' | 'pinout' | 'timing'>('fsm');

  const selectedState = FSM_STATES.find((s) => s.id === selectedStateId) || FSM_STATES[8];

  const handleStateClick = (state: StateNode) => {
    setSelectedStateId(state.id);
    playSonarPing(800, 0.05);
  };

  return (
    <div className="w-full flex flex-col font-['JetBrains_Mono']">
      {/* Header Banner */}
      <div className="w-full bg-[#0a0e15] px-4 py-2 border-b border-[#1c2027] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-['Space_Mono'] font-bold text-xs text-[#00ff9d] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">schema</span>
            ARES-X EMBEDDED SYSTEM ARCHITECTURE & FINITE STATE MACHINE
          </span>
          <span className="text-[10px] text-[#b9cbbc] hidden md:inline-block">
            // DETERMINISTIC CLOSED-LOOP DEFENSE PROTOCOL
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('fsm')}
            className={`px-3 py-1 text-[10px] uppercase font-bold transition-all cursor-pointer border ${
              activeTab === 'fsm'
                ? 'bg-[#00ff9d] text-[#00391f] border-[#00ff9d]'
                : 'bg-[#181c23] text-[#b9cbbc] border-[#262a32] hover:bg-[#262a32]'
            }`}
          >
            FSM STATE GRAPH
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pinout')}
            className={`px-3 py-1 text-[10px] uppercase font-bold transition-all cursor-pointer border ${
              activeTab === 'pinout'
                ? 'bg-[#00ff9d] text-[#00391f] border-[#00ff9d]'
                : 'bg-[#181c23] text-[#b9cbbc] border-[#262a32] hover:bg-[#262a32]'
            }`}
          >
            HARDWARE PINOUT & INTERCONNECTS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timing')}
            className={`px-3 py-1 text-[10px] uppercase font-bold transition-all cursor-pointer border ${
              activeTab === 'timing'
                ? 'bg-[#00ff9d] text-[#00391f] border-[#00ff9d]'
                : 'bg-[#181c23] text-[#b9cbbc] border-[#262a32] hover:bg-[#262a32]'
            }`}
          >
            14.2ms SUPERLOOP TIMELINE
          </button>
        </div>
      </div>

      {activeTab === 'fsm' && (
        <div className="w-full px-4 py-3 flex flex-col gap-3">
          {/* FSM Graph Node Grid */}
          <div className="p-3 bg-[#0a0e15] border border-[#1c2027] shadow-md">
            <div className="flex items-center justify-between pb-1 mb-3 bg-[#181c23] px-2 py-1 border border-[#262a32]">
              <span className="font-['Space_Mono'] font-bold text-xs text-[#00daf3] uppercase">
                HIERARCHICAL STATE TRANSITION GRAPH (SELECT ANY NODE TO INSPECT)
              </span>
              <span className="text-[9px] text-[#00e38b] font-bold">12 FORMAL STATES</span>
            </div>

            {/* Interactive Grid of State Nodes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {FSM_STATES.map((state) => {
                const isSelected = state.id === selectedStateId;
                const isCurrentActive = state.id === 'respond';

                return (
                  <div
                    key={state.id}
                    onClick={() => handleStateClick(state)}
                    className={`p-2.5 flex flex-col justify-between transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#1c2027] border-[#00ff9d] shadow-[0_0_12px_rgba(0,255,157,0.3)] ring-1 ring-[#00ff9d]'
                        : 'bg-[#181c23] border-[#262a32] hover:border-[#00daf3]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#849587] font-bold">{state.code}</span>
                        <span
                          className={`text-[8px] font-bold px-1 py-0.2 border ${
                            state.category === 'RESPONSE'
                              ? 'bg-[#ff3366]/20 text-[#ff3366] border-[#ff3366]/40'
                              : state.category === 'ACQUISITION'
                              ? 'bg-[#00daf3]/20 text-[#00daf3] border-[#00daf3]/40'
                              : 'bg-[#1c2027] text-[#b9cbbc] border-[#262a32]'
                          }`}
                        >
                          {state.category}
                        </span>
                      </div>
                      <div className="font-['Space_Mono'] font-bold text-[11px] text-[#dfe2ed] mt-1 truncate">
                        {state.name}
                      </div>
                    </div>

                    <div className="mt-2 pt-1 border-t border-[#262a32] flex items-center justify-between text-[8px]">
                      <span className="text-[#849587]">ISR: {state.isrBinding.split('_')[0]}</span>
                      {isCurrentActive && (
                        <span className="text-[#00ff9d] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] animate-ping"></span>
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deep-Dive State Inspector */}
          <div className="p-3 bg-[#0a0e15] border border-[#1c2027] shadow-md grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4 bg-[#181c23] p-3 border border-[#262a32] flex flex-col justify-between">
              <div>
                <div className="text-[9px] text-[#00daf3] uppercase font-bold">STATE INSPECTION DETAILS</div>
                <div className="font-['Space_Mono'] font-bold text-base text-[#00ff9d] mt-1">
                  {selectedState.code} {selectedState.name}
                </div>
                <div className="text-[10px] text-[#b9cbbc] mt-1">
                  CLASSIFICATION: <span className="text-[#f4fff3] font-bold">{selectedState.category}</span>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-[#262a32] space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-[#849587]">HARDWARE ISR:</span>
                  <span className="text-[#00daf3] font-mono">{selectedState.isrBinding}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#849587]">WATCHDOG TIMEOUT:</span>
                  <span className="text-[#00e38b] font-mono">{selectedState.timeoutMs} ms</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 bg-[#181c23] p-3 border border-[#262a32] flex flex-col justify-between space-y-2">
              <div className="space-y-2 text-[10px]">
                <div>
                  <div className="text-[#00ff9d] font-bold text-[9px] uppercase">ENTRY ACTION:</div>
                  <div className="text-[#dfe2ed] bg-[#0a0e15] p-1.5 border border-[#262a32] mt-0.5 leading-relaxed">
                    {selectedState.entryAction}
                  </div>
                </div>

                <div>
                  <div className="text-[#00daf3] font-bold text-[9px] uppercase">DURING ACTION (STATE INVARIANT):</div>
                  <div className="text-[#dfe2ed] bg-[#0a0e15] p-1.5 border border-[#262a32] mt-0.5 leading-relaxed">
                    {selectedState.duringAction}
                  </div>
                </div>

                <div>
                  <div className="text-[#ff3366] font-bold text-[9px] uppercase">EXIT GUARD & TRANSITION CRITERIA:</div>
                  <div className="text-[#dfe2ed] bg-[#0a0e15] p-1.5 border border-[#262a32] mt-0.5 leading-relaxed font-mono">
                    {selectedState.exitGuard}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pinout' && (
        <div className="w-full px-4 py-3 flex flex-col gap-3">
          <div className="p-3 bg-[#0a0e15] border border-[#1c2027] shadow-md">
            <div className="flex items-center justify-between pb-1 mb-3 bg-[#181c23] px-2 py-1 border border-[#262a32]">
              <span className="font-['Space_Mono'] font-bold text-xs text-[#00daf3] uppercase">
                ATMEGA328P R3 MICROCONTROLLER HARDWARE PIN MAPPING & INTERCONNECTS
              </span>
              <span className="text-[9px] text-[#00ff9d] font-bold">16.000 MHz EXTERNAL CRYSTAL</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-[#181c23] text-[#b9cbbc] border-b border-[#262a32]">
                    <th className="p-2">MCU PIN</th>
                    <th className="p-2">DIRECTION</th>
                    <th className="p-2">SPECIAL FUNCTION</th>
                    <th className="p-2">EXTERNAL HARDWARE PERIPHERAL</th>
                    <th className="p-2">ELECTRICAL & TIMING CHARACTERISTICS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2027]">
                  {PINOUT_DATA.map((row) => (
                    <tr key={row.pin} className="hover:bg-[#181c23]/50 transition-colors">
                      <td className="p-2 font-bold font-mono text-[#00ff9d]">{row.pin}</td>
                      <td className="p-2">
                        <span
                          className={`px-1.5 py-0.5 text-[8px] font-bold border ${
                            row.type === 'INPUT'
                              ? 'bg-[#00daf3]/20 text-[#00daf3] border-[#00daf3]/40'
                              : 'bg-[#00e38b]/20 text-[#00e38b] border-[#00e38b]/40'
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-[#00daf3]">{row.function}</td>
                      <td className="p-2 text-[#dfe2ed] font-bold">{row.connected}</td>
                      <td className="p-2 text-[#b9cbbc]">{row.specs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'timing' && (
        <div className="w-full px-4 py-3 flex flex-col gap-3">
          <div className="p-3 bg-[#0a0e15] border border-[#1c2027] shadow-md">
            <div className="flex items-center justify-between pb-1 mb-3 bg-[#181c23] px-2 py-1 border border-[#262a32]">
              <span className="font-['Space_Mono'] font-bold text-xs text-[#00ff9d] uppercase">
                DETERMINISTIC 14.2ms SUPERLOOP TIMING BUDGET (70.4 Hz SAMPLE RATE)
              </span>
              <span className="text-[9px] text-[#00daf3] font-bold">JITTER: &lt; 0.4ms</span>
            </div>

            {/* Visual Timeline Segments */}
            <div className="space-y-3">
              <div className="w-full h-8 bg-[#181c23] flex overflow-hidden border border-[#262a32]">
                <div style={{ width: '1%' }} className="bg-[#ff3366] h-full" title="Trig Pulse: 10µs" />
                <div style={{ width: '9%' }} className="bg-[#00daf3] h-full flex items-center justify-center text-[8px] font-bold text-black" title="ToF Echo Return: 1.306ms">
                  ToF 1.3ms
                </div>
                <div style={{ width: '3%' }} className="bg-[#56ffa8] h-full" title="Range Math: 0.38ms" />
                <div style={{ width: '2%' }} className="bg-[#ffd9dc] h-full" title="State Transitions: 0.12ms" />
                <div style={{ width: '17%' }} className="bg-[#00ff9d] h-full flex items-center justify-center text-[8px] font-bold text-black" title="PWM Reload & Step: 2.45ms">
                  PWM 2.4ms
                </div>
                <div style={{ width: '8%' }} className="bg-[#bdf4ff] h-full flex items-center justify-center text-[8px] font-bold text-black" title="UART TX: 1.15ms">
                  UART 1.1ms
                </div>
                <div style={{ width: '60%' }} className="bg-[#262a32] h-full flex items-center justify-center text-[9px] font-bold text-[#b9cbbc]" title="Servo Mechanical Settling Window: 8.78ms">
                  SERVO MECHANICAL SETTLING & DEADTIME WINDOW: 8.78ms (62%)
                </div>
              </div>

              {/* Timing Legend */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[9px]">
                <div className="p-2 bg-[#181c23] border border-[#262a32]">
                  <div className="text-[#ff3366] font-bold">1. TRIG EMIT: 10 µs</div>
                  <div className="text-[#b9cbbc]">PORTB4 bit toggle pulse</div>
                </div>
                <div className="p-2 bg-[#181c23] border border-[#262a32]">
                  <div className="text-[#00daf3] font-bold">2. TOF CAPTURE: 1,306 µs</div>
                  <div className="text-[#b9cbbc]">ICP1 16-bit input capture</div>
                </div>
                <div className="p-2 bg-[#181c23] border border-[#262a32]">
                  <div className="text-[#00ff9d] font-bold">3. PWM UPDATE: 2,450 µs</div>
                  <div className="text-[#b9cbbc]">OCR1A / OCR1B shadow reload</div>
                </div>
                <div className="p-2 bg-[#181c23] border border-[#262a32]">
                  <div className="text-[#dfe2ed] font-bold">4. SERVO SETTLE: 8,784 µs</div>
                  <div className="text-[#b9cbbc]">Acoustic ring dampening</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
