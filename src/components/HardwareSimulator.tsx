import React, { useState, useEffect, useRef, useId } from 'react';
import {
  Volume2,
  VolumeX,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Radar,
  Move,
  Eye,
  Sliders,
  Play,
  RotateCcw,
} from 'lucide-react';
import { SystemConfig, SystemState, ScanPoint, SerialLogMessage } from '../types';
import { VirtualLcd } from './VirtualLcd';
import { VirtualSerialMonitor } from './VirtualSerialMonitor';

interface HardwareSimulatorProps {
  config: SystemConfig;
  onConfigChange?: (newConfig: SystemConfig) => void;
}

export const HardwareSimulator: React.FC<HardwareSimulatorProps> = ({ config }) => {
  // Audio setup for passive buzzer simulation
  const [audioMuted, setAudioMuted] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  // System State
  const [systemState, setSystemState] = useState<SystemState>('ARMED');
  const [servoAngle, setServoAngle] = useState<number>(config.servoRestAngle);
  const [targetAngle, setTargetAngle] = useState<number | null>(null);
  const [targetDistance, setTargetDistance] = useState<number | null>(null);

  // LDR Simulation values (ADC 0-1023)
  const [ldr1Raw, setLdr1Raw] = useState<number>(960);
  const [ldr2Raw, setLdr2Raw] = useState<number>(955);
  const [ldr1Baseline, setLdr1Baseline] = useState<number>(960);
  const [ldr2Baseline, setLdr2Baseline] = useState<number>(955);
  const [beam1Broken, setBeam1Broken] = useState<boolean>(false);
  const [beam2Broken, setBeam2Broken] = useState<boolean>(false);

  // Room baseline scan points (angle -> baseline distance in cm)
  const [baselineMap, setBaselineMap] = useState<Record<number, number>>({});
  const [currentScanIndex, setCurrentScanIndex] = useState<number>(config.servoMinAngle);

  // Room objects (obstacles & intruder)
  const [intruder, setIntruder] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 45,
    active: true,
  });

  const [obstacles] = useState([
    { id: 'wall-back', name: 'Rear Wall', x: 50, y: 15, width: 90, height: 4, color: '#475569' },
    { id: 'cabinet-left', name: 'Metal Cabinet', x: 20, y: 35, width: 14, height: 16, color: '#334155' },
    { id: 'bookshelf-right', name: 'Bookshelf', x: 80, y: 38, width: 14, height: 18, color: '#334155' },
  ]);

  // LCD text lines
  const [lcdLine1, setLcdLine1] = useState<string>('SYSTEM ARMED');
  const [lcdLine2, setLcdLine2] = useState<string>('Beams: SECURED');

  // Serial Monitor logs
  const [logs, setLogs] = useState<SerialLogMessage[]>([
    {
      id: 'log-0',
      timestamp: '00:00:01.020',
      type: 'system',
      message: 'Dual-Laser Security Alarm & Ultrasonic Radar initialized.',
    },
    {
      id: 'log-1',
      timestamp: '00:00:01.450',
      type: 'info',
      message: '[CALIB] LDR1 Baseline: 960 (Thresh: 672) | LDR2 Baseline: 955 (Thresh: 668)',
    },
    {
      id: 'log-2',
      timestamp: '00:00:03.100',
      type: 'info',
      message: '[CALIB] Background acoustic baseline mapped (30 deg to 150 deg).',
    },
    {
      id: 'log-3',
      timestamp: '00:00:03.200',
      type: 'system',
      message: '[SYSTEM] Armed and guarding perimeter. Send \'R\' to rearm.',
    },
  ]);

  const addLog = (message: string, type: SerialLogMessage['type'] = 'info') => {
    const now = new Date();
    const ts = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setLogs((prev) => [...prev.slice(-150), { id: `log-${Date.now()}-${Math.random()}`, timestamp: ts, type, message }]);
  };

  // Sound Engine (Web Audio API for tone() on D12)
  useEffect(() => {
    if (audioMuted) {
      if (gainRef.current && audioCtxRef.current) {
        gainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      }
      return;
    }

    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'square'; // piezo passive buzzer characteristic
        osc.frequency.setValueAtTime(config.buzzerFreqHz, audioCtxRef.current.currentTime);
        gain.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        oscRef.current = osc;
        gainRef.current = gain;
      }
    } catch {
      // Audio context may require user interaction
    }
  }, [audioMuted, config.buzzerFreqHz]);

  // Siren modulation when alarm is active
  useEffect(() => {
    const isAlarming =
      systemState === 'BEAM_TRIPPED' ||
      systemState === 'RADAR_SCANNING' ||
      systemState === 'CONFIRMING_TARGET' ||
      systemState === 'TARGET_LOCKED' ||
      systemState === 'NO_TARGET_FOUND' ||
      systemState === 'ALARM_ACTIVE';

    if (!isAlarming || audioMuted || !gainRef.current || !oscRef.current || !audioCtxRef.current) {
      if (gainRef.current && audioCtxRef.current) {
        gainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      }
      return;
    }

    // Activate sound
    gainRef.current.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime);

    let flip = false;
    const interval = setInterval(() => {
      if (!oscRef.current || !audioCtxRef.current) return;
      flip = !flip;
      const freq = flip ? config.buzzerFreqHz : config.buzzerAlertFreqHz;
      oscRef.current.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
    }, 150);

    return () => clearInterval(interval);
  }, [systemState, audioMuted, config.buzzerFreqHz, config.buzzerAlertFreqHz]);

  // Calculate distances to room objects from the HC-SR04 position (located at bottom center: x=50, y=92)
  const getDistanceAtAngle = (angleDeg: number, includeIntruder: boolean = true): number => {
    // Sensor at (50, 92) in percentage coordinates
    // Convert angle: 90 deg is straight UP (towards y=0). 0 deg is right, 180 is left.
    // Standard polar coordinates: 90 is along -Y direction
    const rad = (angleDeg * Math.PI) / 180;
    // Ray direction: dx = cos(angle), dy = -sin(angle)
    const rayDirX = Math.cos(rad);
    const rayDirY = -Math.sin(rad);

    let closestDistCm = 280; // default empty room background (2.8 meters)

    // Raycast against obstacles
    obstacles.forEach((obs) => {
      // Simple bounding box intersection approximation
      const obsCenterX = obs.x;
      const obsCenterY = obs.y;
      const dx = obsCenterX - 50;
      const dy = obsCenterY - 92;
      const distPercent = Math.sqrt(dx * dx + dy * dy);

      // Angle to obstacle
      const angleToObs = (Math.atan2(-dy, dx) * 180) / Math.PI;
      const angleDiff = Math.abs(angleToObs - angleDeg);

      // Within ultrasonic beam cone (~15 degrees spread)
      if (angleDiff < 10) {
        // Approximate cm: 100% room height = 300 cm
        const distCm = Math.round(distPercent * 3.0);
        if (distCm < closestDistCm) {
          closestDistCm = distCm;
        }
      }
    });

    // Raycast against Intruder if active and included
    if (includeIntruder && intruder.active) {
      const dx = intruder.x - 50;
      const dy = intruder.y - 92;
      const distPercent = Math.sqrt(dx * dx + dy * dy);
      const angleToIntruder = (Math.atan2(-dy, dx) * 180) / Math.PI;
      const angleDiff = Math.abs(angleToIntruder - angleDeg);

      // Intruder cross-section (~12 degree cone acceptance)
      if (angleDiff < 9) {
        const distCm = Math.round(distPercent * 3.0);
        if (distCm < closestDistCm) {
          closestDistCm = distCm;
        }
      }
    }

    return closestDistCm;
  };

  // Populate initial baseline map on mount
  useEffect(() => {
    const map: Record<number, number> = {};
    for (let a = config.servoMinAngle; a <= config.servoMaxAngle; a += config.servoStepDeg) {
      map[a] = getDistanceAtAngle(a, false); // empty room without intruder
    }
    setBaselineMap(map);
  }, [config.servoMinAngle, config.servoMaxAngle, config.servoStepDeg]);

  // Evaluate Laser Tripping when Intruder is moved
  useEffect(() => {
    // Laser 1 is at X=30%, Y from 25% to 85%
    // Laser 2 is at X=70%, Y from 25% to 85%
    let b1 = false;
    let b2 = false;

    if (intruder.active) {
      // Intruder radius is ~5%
      if (Math.abs(intruder.x - 30) < 4.5 && intruder.y >= 25 && intruder.y <= 85) {
        b1 = true;
      }
      if (Math.abs(intruder.x - 70) < 4.5 && intruder.y >= 25 && intruder.y <= 85) {
        b2 = true;
      }
    }

    setBeam1Broken(b1);
    setBeam2Broken(b2);

    // Update LDR voltages / ADC
    const v1 = b1 ? 140 : ldr1Baseline;
    const v2 = b2 ? 145 : ldr2Baseline;
    setLdr1Raw(v1);
    setLdr2Raw(v2);

    // If armed and either beam is broken, trigger alarm!
    if (systemState === 'ARMED' && (b1 || b2)) {
      setSystemState('BEAM_TRIPPED');
      addLog(`[ALARM] Laser tripwire breached! (LDR1=${v1}, LDR2=${v2})`, 'alarm');
      setLcdLine1('! INTRUSION !');
      setLcdLine2(b1 && b2 ? 'Both Beams Cut' : b1 ? 'Beam 1 Cut' : 'Beam 2 Cut');
    }
  }, [intruder, ldr1Baseline, ldr2Baseline, systemState]);

  // State Machine Radar Sweep Loop
  useEffect(() => {
    if (systemState === 'BEAM_TRIPPED') {
      const timer = setTimeout(() => {
        setSystemState('RADAR_SCANNING');
        setCurrentScanIndex(config.servoMinAngle);
        setServoAngle(config.servoMinAngle);
        setLcdLine1('RADAR SCANNING');
        setLcdLine2('Locating target');
        addLog(`[RADAR] Starting sector sweep from ${config.servoMinAngle}° to ${config.servoMaxAngle}°...`, 'radar');
      }, 600);
      return () => clearTimeout(timer);
    }

    if (systemState === 'RADAR_SCANNING') {
      const interval = setInterval(() => {
        const nextAngle = servoAngle + config.servoStepDeg;
        setServoAngle(nextAngle);

        // Ping distance
        const currentDist = getDistanceAtAngle(nextAngle, true);
        const baselineDist = baselineMap[nextAngle] || 250;

        addLog(`[SWEEP] Angle: ${nextAngle}° | Current: ${currentDist}cm | Base: ${baselineDist}cm`, 'radar');

        // Check if closer than baseline by minimum delta
        if (currentDist < baselineDist - config.minObjectDeltaCm && currentDist > 15) {
          // Found plausible new object!
          clearInterval(interval);
          setTargetAngle(nextAngle);
          setTargetDistance(currentDist);
          setSystemState('CONFIRMING_TARGET');
          addLog(`>>> Potential target found at ${nextAngle}° (${currentDist} cm)! Confirming multi-ping...`, 'system');
          return;
        }

        // Check if reached end of sweep
        if (nextAngle >= config.servoMaxAngle) {
          clearInterval(interval);
          setSystemState('NO_TARGET_FOUND');
          setServoAngle(config.servoRestAngle);
          setLcdLine1('! INTRUSION !');
          setLcdLine2('No target found');
          addLog('[RADAR] Full sector sweep completed. No new target found in ultrasonic FOV.', 'warn');
        }
      }, config.settlingDelayMs);

      return () => clearInterval(interval);
    }

    if (systemState === 'CONFIRMING_TARGET') {
      const timer = setTimeout(() => {
        // Confirmation pings
        if (targetAngle !== null && targetDistance !== null) {
          const verifiedDist = getDistanceAtAngle(targetAngle, true);
          const baseline = baselineMap[targetAngle] || 250;

          if (verifiedDist < baseline - config.minObjectDeltaCm) {
            // Target confirmed!
            setSystemState('TARGET_LOCKED');
            setTargetDistance(verifiedDist);
            setLcdLine1('TARGET LOCKED!  ');
            setLcdLine2(`D:${String(verifiedDist).padStart(3, ' ')}cm A:${String(targetAngle).padStart(3, ' ')}deg`);
            addLog(`[LOCKED] Confirmed intruder at ${targetAngle}°, Distance: ${verifiedDist} cm. Holding servo.`, 'alarm');
          } else {
            // Glitch echo, continue scan
            setSystemState('RADAR_SCANNING');
            addLog('[RADAR] Echo disappeared during multi-ping verification. Resuming scan.', 'warn');
          }
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [systemState, servoAngle, baselineMap, config, targetAngle, targetDistance]);

  // Reset / Rearm system action
  const handleResetRearm = () => {
    addLog('[USER] Reset / Rearm command issued. Restoring idle monitoring.', 'system');
    setSystemState('ARMED');
    setServoAngle(config.servoRestAngle);
    setTargetAngle(null);
    setTargetDistance(null);
    setBeam1Broken(false);
    setBeam2Broken(false);
    setLdr1Raw(ldr1Baseline);
    setLdr2Raw(ldr2Baseline);
    setLcdLine1('SYSTEM ARMED');
    setLcdLine2('Beams: SECURED');
  };

  // Calibrate LDRs action
  const handleCalibrateLDR = () => {
    addLog('[CALIB] Calibrating LDRs with unobstructed laser beams...', 'info');
    const b1 = 960 + Math.floor(Math.random() * 10 - 5);
    const b2 = 955 + Math.floor(Math.random() * 10 - 5);
    setLdr1Baseline(b1);
    setLdr2Baseline(b2);
    setLdr1Raw(b1);
    setLdr2Raw(b2);
    setBeam1Broken(false);
    setBeam2Broken(false);
    setLcdLine1('CALIB COMPLETE');
    setLcdLine2(`L1:${b1} L2:${b2}`);
    addLog(`[CALIB] New LDR1 baseline: ${b1} | LDR2 baseline: ${b2}`, 'info');
    setTimeout(() => {
      setLcdLine1('SYSTEM ARMED');
      setLcdLine2('Beams: SECURED');
    }, 1500);
  };

  // Background sweep calibration action
  const handleCalibrateBaseline = () => {
    addLog('[CALIB] Performing full room acoustic baseline sweep...', 'info');
    setSystemState('BASELINE_SWEEP');
    setLcdLine1('RADAR BASELINE');
    setLcdLine2('Mapping room...');

    const map: Record<number, number> = {};
    let a = config.servoMinAngle;
    const interval = setInterval(() => {
      if (a <= config.servoMaxAngle) {
        setServoAngle(a);
        const dist = getDistanceAtAngle(a, false);
        map[a] = dist;
        addLog(`  Angle ${a}° -> Base Dist: ${dist} cm`, 'radar');
        a += config.servoStepDeg;
      } else {
        clearInterval(interval);
        setBaselineMap(map);
        setServoAngle(config.servoRestAngle);
        setSystemState('ARMED');
        setLcdLine1('SYSTEM ARMED');
        setLcdLine2('Beams: SECURED');
        addLog('[CALIB] Room baseline map updated successfully.', 'info');
      }
    }, 50);
  };

  // Threshold calculations
  const thresh1 = Math.round((ldr1Baseline * (100 - config.laserTripThresholdPct)) / 100);
  const thresh2 = Math.round((ldr2Baseline * (100 - config.laserTripThresholdPct)) / 100);

  return (
    <div className="space-y-6">
      {/* Top Banner / System Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              systemState === 'ARMED'
                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)] animate-pulse'
                : systemState === 'RADAR_SCANNING' || systemState === 'CONFIRMING_TARGET'
                ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-ping'
                : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)] animate-bounce'
            }`}
          ></div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Firmware State</div>
            <div className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
              {systemState.replace(/_/g, ' ')}
              {targetAngle !== null && systemState === 'TARGET_LOCKED' && (
                <span className="text-xs px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                  Angle: {targetAngle}° | {targetDistance} cm
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAudioMuted(!audioMuted)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
              audioMuted
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                : 'bg-amber-950/80 text-amber-300 border-amber-600/50 hover:bg-amber-900'
            }`}
          >
            {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />}
            {audioMuted ? 'Passive Buzzer (Muted)' : 'Passive Buzzer (Sound ON)'}
          </button>

          <button
            type="button"
            onClick={handleCalibrateLDR}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            title="Recalibrate open-beam LDR baseline"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            Calibrate LDRs
          </button>

          <button
            type="button"
            onClick={handleCalibrateBaseline}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            title="Scan empty room background distances"
          >
            <Radar className="w-3.5 h-3.5 text-cyan-400" />
            Map Room Baseline
          </button>

          <button
            type="button"
            onClick={handleResetRearm}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset / Rearm ('R')
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Room Canvas & Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Room Simulator Canvas */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-2">
                <Radar className="w-4 h-4 text-cyan-400" />
                <strong className="text-slate-200">Room Security Zone (Bird's-Eye 2D View)</strong>
              </span>
              <span className="text-slate-400">Drag intruder or click beams to simulate breach</span>
            </div>

            {/* Canvas Container */}
            <div className="relative w-full h-[380px] bg-slate-950 border-2 border-slate-800 rounded-xl overflow-hidden shadow-inner select-none">
              {/* Radar Grid Lines */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 50% 92%, #06b6d4 1px, transparent 1px), linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
                  backgroundSize: '100% 100%, 40px 40px, 40px 40px',
                }}
              ></div>

              {/* Sonar Range Concentric Arcs */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <circle cx="50%" cy="92%" r="25%" fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3 3" opacity="0.25" />
                <circle cx="50%" cy="92%" r="50%" fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3 3" opacity="0.25" />
                <circle cx="50%" cy="92%" r="75%" fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3 3" opacity="0.25" />
                {/* 90 deg center line */}
                <line x1="50%" y1="92%" x2="50%" y2="10%" stroke="#06b6d4" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
              </svg>

              {/* Background Obstacles */}
              {obstacles.map((obs) => (
                <div
                  key={obs.id}
                  style={{
                    left: `${obs.x - obs.width / 2}%`,
                    top: `${obs.y - obs.height / 2}%`,
                    width: `${obs.width}%`,
                    height: `${obs.height}%`,
                    backgroundColor: obs.color,
                  }}
                  className="absolute rounded border border-slate-600/60 shadow flex items-center justify-center text-[10px] text-slate-300 font-mono select-none"
                >
                  {obs.name}
                </div>
              ))}

              {/* Laser 1 Emitter & Beam Path */}
              <div
                className="absolute top-[20%] left-[30%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer"
                onClick={() => setBeam1Broken(!beam1Broken)}
                title="Laser 1 (D7)"
              >
                <div className="w-5 h-5 rounded bg-red-600 border border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)] flex items-center justify-center text-[9px] font-mono text-white font-bold">
                  L1
                </div>
              </div>

              {/* Laser 1 Beam line down to LDR 1 */}
              <div
                className={`absolute left-[30%] top-[22%] bottom-[16%] w-0.5 -translate-x-1/2 cursor-pointer transition-opacity ${
                  beam1Broken
                    ? 'opacity-20 bg-red-500'
                    : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)] opacity-95 animate-pulse'
                }`}
                onClick={() => setBeam1Broken(!beam1Broken)}
                title="Click to break Beam 1"
              ></div>

              {/* LDR 1 Receiver at bottom */}
              <div
                className="absolute bottom-[13%] left-[30%] -translate-x-1/2 flex flex-col items-center cursor-pointer"
                onClick={() => setBeam1Broken(!beam1Broken)}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-mono font-bold transition ${
                    beam1Broken
                      ? 'bg-slate-800 border-amber-500 text-amber-300'
                      : 'bg-red-950 border-red-500 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                  }`}
                >
                  A0
                </div>
                <span className="text-[10px] font-mono text-slate-400 mt-0.5">LDR 1</span>
              </div>

              {/* Laser 2 Emitter & Beam Path */}
              <div
                className="absolute top-[20%] left-[70%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer"
                onClick={() => setBeam2Broken(!beam2Broken)}
                title="Laser 2 (D10)"
              >
                <div className="w-5 h-5 rounded bg-red-600 border border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)] flex items-center justify-center text-[9px] font-mono text-white font-bold">
                  L2
                </div>
              </div>

              {/* Laser 2 Beam line down to LDR 2 */}
              <div
                className={`absolute left-[70%] top-[22%] bottom-[16%] w-0.5 -translate-x-1/2 cursor-pointer transition-opacity ${
                  beam2Broken
                    ? 'opacity-20 bg-red-500'
                    : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)] opacity-95 animate-pulse'
                }`}
                onClick={() => setBeam2Broken(!beam2Broken)}
                title="Click to break Beam 2"
              ></div>

              {/* LDR 2 Receiver at bottom */}
              <div
                className="absolute bottom-[13%] left-[70%] -translate-x-1/2 flex flex-col items-center cursor-pointer"
                onClick={() => setBeam2Broken(!beam2Broken)}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-mono font-bold transition ${
                    beam2Broken
                      ? 'bg-slate-800 border-amber-500 text-amber-300'
                      : 'bg-red-950 border-red-500 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                  }`}
                >
                  A1
                </div>
                <span className="text-[10px] font-mono text-slate-400 mt-0.5">LDR 2</span>
              </div>

              {/* Ultrasonic Sonar Cone (Radiating from Servo at 50%, 92%) */}
              <div
                className="absolute left-[50%] bottom-[8%] pointer-events-none origin-bottom"
                style={{
                  transform: `rotate(${90 - servoAngle}deg)`,
                  transition: 'transform 70ms linear',
                }}
              >
                {/* Visual acoustic cone (20 degree field) */}
                <div
                  className="w-0 h-0 border-l-[35px] border-l-transparent border-r-[35px] border-r-transparent border-t-[240px] border-t-cyan-500/25 -translate-x-1/2 -translate-y-full"
                  style={{
                    filter: 'drop-shadow(0 0 12px rgba(6,182,212,0.4))',
                  }}
                ></div>
                {/* Pointer line */}
                <div className="w-0.5 h-60 bg-cyan-300 -translate-x-1/2 -translate-y-full shadow-[0_0_8px_rgba(6,182,212,0.9)]"></div>
              </div>

              {/* Servo & HC-SR04 Assembly at Bottom Center (50%, 92%) */}
              <div className="absolute left-[50%] bottom-[4%] -translate-x-1/2 flex flex-col items-center z-10">
                {/* HC-SR04 Dual Transducers Mounted on Servo Horn */}
                <div
                  className="relative p-1 bg-blue-700 border border-blue-400 rounded shadow-md flex items-center gap-1 origin-center"
                  style={{
                    transform: `rotate(${90 - servoAngle}deg)`,
                    transition: 'transform 70ms linear',
                  }}
                >
                  {/* Left transducer (Transmitter) */}
                  <div className="w-4 h-4 rounded-full bg-slate-200 border-2 border-slate-700 flex items-center justify-center text-[7px] text-slate-900 font-bold">
                    T
                  </div>
                  {/* Center pointer */}
                  <div className="w-1 h-3 bg-red-500 rounded-sm"></div>
                  {/* Right transducer (Receiver) */}
                  <div className="w-4 h-4 rounded-full bg-slate-200 border-2 border-slate-700 flex items-center justify-center text-[7px] text-slate-900 font-bold">
                    R
                  </div>
                </div>

                {/* SG90 Servo Base Box */}
                <div className="w-9 h-5 bg-blue-950 border border-blue-600 rounded-sm mt-0.5 flex items-center justify-center text-[8px] font-mono text-blue-200">
                  SG90 (D9)
                </div>
                <div className="text-[10px] font-mono text-cyan-300 mt-0.5">
                  Servo: {servoAngle}° {servoAngle === 90 ? '(Center)' : servoAngle < 90 ? '(Right)' : '(Left)'}
                </div>
              </div>

              {/* Draggable Intruder */}
              <div
                style={{
                  left: `${intruder.x}%`,
                  top: `${intruder.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseDown={(e) => {
                  const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!rect) return;
                  const onMouseMove = (moveEvent: MouseEvent) => {
                    const newX = Math.max(10, Math.min(90, ((moveEvent.clientX - rect.left) / rect.width) * 100));
                    const newY = Math.max(20, Math.min(85, ((moveEvent.clientY - rect.top) / rect.height) * 100));
                    setIntruder({ x: Math.round(newX), y: Math.round(newY), active: true });
                  };
                  const onMouseUp = () => {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                  };
                  window.addEventListener('mousemove', onMouseMove);
                  window.addEventListener('mouseup', onMouseUp);
                }}
                className="absolute z-20 cursor-grab active:cursor-grabbing group"
              >
                <div className="relative flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-amber-500 border-2 border-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.9)] flex items-center justify-center text-slate-950 font-bold text-xs">
                    👤
                  </div>
                  <span className="bg-slate-900/90 text-amber-300 border border-amber-500/40 text-[9px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap mt-1">
                    Intruder ({intruder.x}%, {intruder.y}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Interactive Scenario Buttons */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-mono">Quick Scenarios:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIntruder({ x: 30, y: 55, active: true })}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition"
                >
                  Step onto Beam 1 (X:30%)
                </button>
                <button
                  type="button"
                  onClick={() => setIntruder({ x: 70, y: 55, active: true })}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition"
                >
                  Step onto Beam 2 (X:70%)
                </button>
                <button
                  type="button"
                  onClick={() => setIntruder({ x: 50, y: 50, active: true })}
                  className="px-2.5 py-1 text-xs bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-800 rounded transition"
                >
                  Center FOV (90°, 50%)
                </button>
                <button
                  type="button"
                  onClick={() => setIntruder({ x: 12, y: 75, active: true })}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded transition"
                >
                  Flee / Hide behind Cabinet
                </button>
              </div>
            </div>
          </div>

          {/* LDR Signal Telemetry & Voltage Dividers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LDR 1 Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${beam1Broken ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                  LDR 1 (Pin A0)
                </span>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                    beam1Broken ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300'
                  }`}
                >
                  {beam1Broken ? 'BEAM BROKEN' : 'BEAM INTACT'}
                </span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>ADC Value (0-1023):</span>
                  <span className="font-bold text-slate-100">{ldr1Raw}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Voltage (5V ref):</span>
                  <span className="text-emerald-400">{((ldr1Raw * 5) / 1023).toFixed(2)} V</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Trip Threshold:</span>
                  <span className="text-amber-400">{thresh1} (Baseline: {ldr1Baseline})</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-2 relative">
                  <div
                    className={`h-full transition-all duration-150 ${beam1Broken ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${(ldr1Raw / 1023) * 100}%` }}
                  ></div>
                  {/* Threshold marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
                    style={{ left: `${(thresh1 / 1023) * 100}%` }}
                    title="Threshold"
                  ></div>
                </div>
              </div>
            </div>

            {/* LDR 2 Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${beam2Broken ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                  LDR 2 (Pin A1)
                </span>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                    beam2Broken ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300'
                  }`}
                >
                  {beam2Broken ? 'BEAM BROKEN' : 'BEAM INTACT'}
                </span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>ADC Value (0-1023):</span>
                  <span className="font-bold text-slate-100">{ldr2Raw}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Voltage (5V ref):</span>
                  <span className="text-emerald-400">{((ldr2Raw * 5) / 1023).toFixed(2)} V</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Trip Threshold:</span>
                  <span className="text-amber-400">{thresh2} (Baseline: {ldr2Baseline})</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-2 relative">
                  <div
                    className={`h-full transition-all duration-150 ${beam2Broken ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${(ldr2Raw / 1023) * 100}%` }}
                  ></div>
                  {/* Threshold marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
                    style={{ left: `${(thresh2 / 1023) * 100}%` }}
                    title="Threshold"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): LCD Display & Live Serial Monitor */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          {/* LCD Simulator */}
          <VirtualLcd line1={lcdLine1} line2={lcdLine2} i2cAddress={config.lcdI2cAddress} />

          {/* Virtual Serial Terminal */}
          <div className="flex-1 min-h-[320px]">
            <VirtualSerialMonitor
              logs={logs}
              onClearLogs={() => setLogs([])}
              onSendCommand={(cmd) => {
                if (cmd.toUpperCase() === 'R') {
                  handleResetRearm();
                } else {
                  addLog(`[COMMAND] Unrecognized: "${cmd}". Send 'R' to rearm.`, 'warn');
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
