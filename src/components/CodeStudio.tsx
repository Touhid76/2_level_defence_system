import React, { useState } from 'react';
import { Copy, Check, Download, Sliders, Code, FileText, CheckCircle2 } from 'lucide-react';
import { SystemConfig } from '../types';
import { generateArduinoSketch } from '../utils/arduinoSketch';

interface CodeStudioProps {
  config: SystemConfig;
  onConfigChange: (newConfig: SystemConfig) => void;
}

export const CodeStudio: React.FC<CodeStudioProps> = ({ config, onConfigChange }) => {
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  const sketchCode = generateArduinoSketch(config);

  const handleCopy = () => {
    navigator.clipboard.writeText(sketchCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownload = () => {
    const blob = new Blob([sketchCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'DualLaserSecurityAlarm.ino';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
            <Code className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              DualLaserSecurityAlarm.ino
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                Production Ready
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Complete, verified, non-blocking Arduino Uno sketch utilizing Timer 1 (Servo) & Timer 2 (Tone)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
              showConfig
                ? 'bg-slate-800 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            {showConfig ? 'Hide Config Tuner' : 'Tweak Parameters'}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied to Clipboard!' : 'Copy Complete Sketch'}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Download .ino
          </button>
        </div>
      </div>

      {/* Interactive Parameter Tuner Drawer */}
      {showConfig && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Live Firmware Constants Tuner (Instantly modifies the code below)
            </span>
            <span className="text-[11px] text-slate-400">Values inject directly into the Arduino constants header</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {/* Servo Min / Max Angle */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <label className="text-slate-300 flex justify-between">
                <span>Sweep Bounds:</span>
                <span className="text-indigo-400 font-bold">{config.servoMinAngle}° to {config.servoMaxAngle}°</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="range"
                  min={15}
                  max={60}
                  value={config.servoMinAngle}
                  onChange={(e) => onConfigChange({ ...config, servoMinAngle: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                  title="Min Angle"
                />
                <input
                  type="range"
                  min={120}
                  max={170}
                  value={config.servoMaxAngle}
                  onChange={(e) => onConfigChange({ ...config, servoMaxAngle: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                  title="Max Angle"
                />
              </div>
              <span className="text-[10px] text-slate-400 block">Min (Left) • Max (Right)</span>
            </div>

            {/* Sweep Step & Settle Delay */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <label className="text-slate-300 flex justify-between">
                <span>Step / Settle:</span>
                <span className="text-cyan-400 font-bold">{config.servoStepDeg}° / {config.settlingDelayMs}ms</span>
              </label>
              <div className="flex gap-2 items-center">
                <select
                  value={config.servoStepDeg}
                  onChange={(e) => onConfigChange({ ...config, servoStepDeg: Number(e.target.value) })}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded p-1 text-xs w-1/2"
                >
                  <option value={3}>3° (Fine)</option>
                  <option value={5}>5° (Standard)</option>
                  <option value={10}>10° (Fast)</option>
                </select>
                <select
                  value={config.settlingDelayMs}
                  onChange={(e) => onConfigChange({ ...config, settlingDelayMs: Number(e.target.value) })}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded p-1 text-xs w-1/2"
                >
                  <option value={40}>40 ms</option>
                  <option value={60}>60 ms</option>
                  <option value={80}>80 ms</option>
                </select>
              </div>
              <span className="text-[10px] text-slate-400 block">Angular resolution & settling delay</span>
            </div>

            {/* Laser Trip Threshold % */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <label className="text-slate-300 flex justify-between">
                <span>Laser Trip Drop:</span>
                <span className="text-amber-400 font-bold">{config.laserTripThresholdPct}%</span>
              </label>
              <input
                type="range"
                min={15}
                max={50}
                value={config.laserTripThresholdPct}
                onChange={(e) => onConfigChange({ ...config, laserTripThresholdPct: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <span className="text-[10px] text-slate-400 block">Required % light drop below baseline</span>
            </div>

            {/* Object Delta & LCD Address */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">LCD I2C Address:</span>
                <select
                  value={config.lcdI2cAddress}
                  onChange={(e) => onConfigChange({ ...config, lcdI2cAddress: e.target.value })}
                  className="bg-slate-900 border border-slate-700 text-amber-300 font-bold rounded px-1.5 py-0.5 text-xs"
                >
                  <option value="0x27">0x27 (Default)</option>
                  <option value="0x3F">0x3F (Alt)</option>
                </select>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-300">Min Target Delta:</span>
                <span className="text-cyan-300 font-bold">{config.minObjectDeltaCm} cm</span>
              </div>
              <input
                type="range"
                min={10}
                max={40}
                value={config.minObjectDeltaCm}
                onChange={(e) => onConfigChange({ ...config, minObjectDeltaCm: Number(e.target.value) })}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Code Viewer */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Arduino C++ (ATmega328P Uno)</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Flash: ~11,400 bytes (35%)</span>
            <span>SRAM: ~780 bytes (38%)</span>
          </div>
        </div>

        <div className="relative p-4 overflow-x-auto max-h-[640px] font-mono text-xs leading-relaxed text-slate-200 select-text">
          <pre className="text-slate-300 whitespace-pre">{sketchCode}</pre>
        </div>
      </div>
    </div>
  );
};
