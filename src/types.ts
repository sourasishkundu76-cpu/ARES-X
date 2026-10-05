export interface Obstacle {
  id: string;
  name: string;
  angleDeg: number;
  distanceCm: number;
  color: string;
  isThreat?: boolean;
  locked?: boolean;
}

export type SystemState = 
  | 'INITIALIZING'
  | 'CALIBRATING'
  | 'SCANNING'
  | 'MEASURING'
  | 'VALIDATING'
  | 'DETECTING'
  | 'CONFIRMING'
  | 'RECORDING'
  | 'RESPONDING'
  | 'VERIFYING'
  | 'TARGET_LOST'
  | 'RESCANNING';

export interface TelemetryLog {
  id: string;
  timestamp: string;
  prefix: 'RX' | 'TX' | 'SYS' | 'SIM' | 'CMD';
  message: string;
  colorClass?: string;
}

export interface WorkflowStep {
  number: number;
  code: string;
  title: string;
  purpose: string;
  input: string;
  process: string;
  output: string;
  principle: string;
}

export interface HardwareComponentStatus {
  name: string;
  subtitle: string;
  status: 'ONLINE' | 'ENGAGED' | 'PULSING' | 'FLASHING' | 'STABLE' | 'STANDBY';
  statusColor: string;
  indicatorColor: string;
  isPulsing?: boolean;
}
