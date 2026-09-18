export type SystemState =
  | 'BOOT'
  | 'ALIGNING_LDR'
  | 'BASELINE_SWEEP'
  | 'ARMED'
  | 'BEAM_TRIPPED'
  | 'RADAR_SCANNING'
  | 'CONFIRMING_TARGET'
  | 'TARGET_LOCKED'
  | 'NO_TARGET_FOUND'
  | 'ALARM_ACTIVE';

export interface ScanPoint {
  angle: number; // degrees (e.g. 30 to 150)
  baselineDist: number; // cm
  currentDist: number; // cm
  isNewObject: boolean;
}

export interface IntruderPosition {
  x: number; // 0 to 100 (%)
  y: number; // 0 to 100 (%)
}

export interface Obstacle {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface SystemConfig {
  servoMinAngle: number;
  servoMaxAngle: number;
  servoStepDeg: number;
  servoRestAngle: number;
  ldrSamples: number;
  laserTripThresholdPct: number; // % drop from calibrated baseline
  hysteresisMargin: number; // ADC counts
  minObjectDeltaCm: number; // min delta from baseline to qualify as intruder
  maxValidDistanceCm: number;
  buzzerFreqHz: number;
  buzzerAlertFreqHz: number;
  lcdI2cAddress: string;
  echoTimeoutUs: number;
  settlingDelayMs: number;
}

export interface SerialLogMessage {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'alarm' | 'radar' | 'system';
  message: string;
}
