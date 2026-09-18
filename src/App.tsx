import React, { useState } from 'react';
import {
  ShieldAlert,
  Terminal,
  Code2,
  FileCheck2,
  HelpCircle,
  Radio,
  Cpu,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { SystemConfig } from './types';
import { HardwareSimulator } from './components/HardwareSimulator';
import { CodeStudio } from './components/CodeStudio';
import { CircuitAuditReport } from './components/CircuitAuditReport';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'circuit' | 'calibration'>('simulator');

  const [config, setConfig] = useState<SystemConfig>({
    servoMinAngle: 30,
    servoMaxAngle: 150,
    servoStepDeg: 5,
    servoRestAngle: 90,
    ldrSamples: 25,
    laserTripThresholdPct: 30, // 30% drop triggers alarm
    hysteresisMargin: 30, // ADC count hysteresis
    minObjectDeltaCm: 25, // must be 25cm closer than background
    maxValidDistanceCm: 350,
    buzzerFreqHz: 880,
    buzzerAlertFreqHz: 1200,
    lcdI2cAddress: '0x27',
    echoTimeoutUs: 25000, // 25ms timeout (~4.2m)
    settlingDelayMs: 60, // 60ms servo settle before ping
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
              <ShieldAlert className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                  Dual-Laser Security Alarm & Ultrasonic Radar
                </h1>
                <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Arduino Uno ATmega328P
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Servo-Mounted HC-SR04 • 16×2 I2C LCD • Dual LDR Tripwires • Passive Buzzer
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'simulator'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Live Simulator
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'code'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Arduino Code (.ino)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('circuit')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'circuit'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              Circuit Audit & Pinout
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('calibration')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'calibration'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Calibration & Troubleshooting
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'simulator' && (
          <HardwareSimulator config={config} onConfigChange={setConfig} />
        )}

        {activeTab === 'code' && (
          <CodeStudio config={config} onConfigChange={setConfig} />
        )}

        {(activeTab === 'circuit' || activeTab === 'calibration') && (
          <CircuitAuditReport />
        )}
      </main>

      {/* Engineering Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/50 py-4 text-xs font-mono text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            ATmega328P Timers: Timer 1 (Servo, D9) • Timer 2 (tone, D12) • 5V Logic Compatible
          </div>
          <div className="text-slate-400">
            Compliant with Frank de Brabander LiquidCrystal_I2C & Arduino Servo.h
          </div>
        </div>
      </footer>
    </div>
  );
}
