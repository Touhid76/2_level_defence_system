import React from 'react';

interface VirtualLcdProps {
  line1: string;
  line2: string;
  i2cAddress?: string;
}

export const VirtualLcd: React.FC<VirtualLcdProps> = ({
  line1,
  line2,
  i2cAddress = '0x27',
}) => {
  // Pad strings to exactly 16 characters
  const pad16 = (s: string) => (s + ' '.repeat(16)).slice(0, 16);
  const l1 = pad16(line1);
  const l2 = pad16(line2);

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl text-slate-100">
      {/* Top bezel */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="font-mono font-semibold text-slate-300">16×2 HD44780 I2C LCD</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] bg-slate-800 px-2 py-0.5 rounded text-amber-300 border border-slate-700">
            ADDR: {i2cAddress}
          </span>
          <span className="text-[11px] text-emerald-400 font-mono">PCF8574 Backpack</span>
        </div>
      </div>

      {/* Screen Frame */}
      <div className="relative bg-[#001433] border-4 border-slate-800 rounded-lg p-3 shadow-inner overflow-hidden font-mono select-none">
        {/* Subtle LCD dot-matrix backlight glow */}
        <div className="absolute inset-0 bg-blue-600/10 pointer-events-none"></div>

        {/* Row 1 */}
        <div className="relative flex items-center justify-between tracking-widest text-[#00e5ff] text-base md:text-lg font-bold font-mono h-8">
          {l1.split('').map((char, i) => (
            <span
              key={`r1-${i}`}
              className="inline-block w-[6.25%] text-center drop-shadow-[0_0_8px_rgba(0,229,255,0.7)]"
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </div>

        {/* Row 2 */}
        <div className="relative flex items-center justify-between tracking-widest text-[#00e5ff] text-base md:text-lg font-bold font-mono h-8 mt-1">
          {l2.split('').map((char, i) => (
            <span
              key={`r2-${i}`}
              className="inline-block w-[6.25%] text-center drop-shadow-[0_0_8px_rgba(0,229,255,0.7)]"
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </div>
      </div>

      {/* Footer Pins */}
      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span className="text-slate-400">GND • VCC (5V) • SDA (A4) • SCL (A5)</span>
        <span className="text-slate-400">Contrast Pot: Adjusted (5V)</span>
      </div>
    </div>
  );
};
