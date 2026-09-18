import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Zap,
  Cpu,
  Layers,
  Wrench,
  HelpCircle,
  Copy,
  Check,
  Search,
  ExternalLink,
} from 'lucide-react';

export const CircuitAuditReport: React.FC = () => {
  const [copiedScanner, setCopiedScanner] = useState(false);

  const i2cScannerCode = `// --------------------------------------------------
// Arduino I2C Scanner - Run this to find LCD Address
// --------------------------------------------------
#include <Wire.h>

void setup() {
  Wire.begin();
  Serial.begin(115200);
  while (!Serial);
  Serial.println("\\nI2C Scanner scanning for devices...");
}

void loop() {
  byte error, address;
  int nDevices = 0;

  for (address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("I2C device found at address 0x");
      if (address < 16) Serial.print("0");
      Serial.print(address, HEX);
      Serial.println(" ! (Usually 0x27 or 0x3F for 16x2 LCD)");
      nDevices++;
    }
  }
  if (nDevices == 0) Serial.println("No I2C devices found. Check SDA/SCL wiring and pull-ups.");
  delay(5000);
}`;

  const copyScannerCode = () => {
    navigator.clipboard.writeText(i2cScannerCode);
    setCopiedScanner(true);
    setTimeout(() => setCopiedScanner(false), 2000);
  };

  return (
    <div className="space-y-8 text-slate-200">
      {/* 1. Circuit Diagram Inspection & Corrections */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">1. Circuit Diagram Audit & Necessary Wiring Corrections</h2>
            <p className="text-xs text-slate-400 font-mono">
              Careful electrical inspection of the attached schematic ("DUAL LASER SECURITY ALARM WITH SERVO RADAR & LCD – EXACT CIRCUIT")
            </p>
          </div>
        </div>

        <div className="space-y-4 text-sm leading-relaxed">
          {/* Commendation */}
          <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-lg">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300">Commendable Circuit Decisions in Your Diagram:</strong>
                <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-300 text-xs">
                  <li>
                    <strong>Dedicated External 5V Servo Supply:</strong> Powering the SG90 servo from an external 5V 1A–2A supply instead of the Arduino's 5V regulator is crucial. SG90 stall and acceleration transients pull 500mA–800mA, which would cause the Arduino Uno to brown out and reset.
                  </li>
                  <li>
                    <strong>Common Ground Implemented:</strong> The diagram correctly joins the external power supply GND to the Arduino GND. Without this common ground, the servo PWM signal (D9) would lack a return path, causing jitter or complete non-response.
                  </li>
                  <li>
                    <strong>LDR Voltage Dividers:</strong> The 10 kΩ pull-down resistors to GND paired with the LDR to 5V form an electrically correct divider where higher light = higher voltage.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Critical Corrections */}
          <div className="p-4 bg-amber-950/40 border border-amber-700/60 rounded-lg space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300">Crucial Wiring & Driver Checks Required:</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-2">
              {/* Laser modules */}
              <div className="bg-slate-950/80 p-3.5 rounded border border-slate-800 space-y-2">
                <span className="font-bold text-amber-300 font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Laser Module Pinout (Breadboard 1)
                </span>
                <p className="text-slate-300 leading-normal">
                  In your diagram, Breadboard 1 shows both <code className="text-amber-300">S</code> (connected to D7/D10) and <code className="text-amber-300">+</code> (connected to 5V bus) wired simultaneously.
                </p>
                <p className="text-slate-300 leading-normal">
                  <strong>Risk:</strong> On standard 3-pin KY-008 laser modules, the 3 pins are typically <em>Pin 1 (-) = GND</em>, <em>Pin 2 (middle) = NC (not connected) or VCC</em>, and <em>Pin 3 (S) = 5V Signal</em> through an on-board 91Ω resistor. If the middle pin is internally connected to the anode or bridged to <em>S</em>, connecting 5V directly to <code className="text-amber-300">+</code> will keep the laser permanently ON regardless of the Arduino pin, or back-feed 5V into the ATmega328P output pin when set to LOW!
                </p>
                <p className="text-emerald-400 font-medium">
                  <strong>Fix:</strong> Leave the middle <code className="text-amber-300">+</code> pin unconnected (NC). Connect <code className="text-amber-300">-</code> to Arduino GND, and <code className="text-amber-300">S</code> to D7 (Laser 1) and D10 (Laser 2).
                </p>
                <p className="text-slate-400 text-[11px]">
                  <em>Current note:</em> Each 650nm 5mW diode draws ~25-30mA. The ATmega328P pin maximum is 40mA (20mA continuous recommended). For industrial longevity, switching the lasers using a 2N2222/2N3904 NPN transistor is best practice.
                </p>
              </div>

              {/* Passive buzzer */}
              <div className="bg-slate-950/80 p-3.5 rounded border border-slate-800 space-y-2">
                <span className="font-bold text-amber-300 font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Passive Buzzer Module (Breadboard 3)
                </span>
                <p className="text-slate-300 leading-normal">
                  Your diagram notes <code className="text-amber-300">+ -&gt; 5V (if required)</code>.
                </p>
                <p className="text-slate-300 leading-normal">
                  <strong>Driver Verification:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>
                    <strong>If using a 3-pin buzzer breakout (e.g., KY-006):</strong> It has an onboard S8050 NPN transistor driver. Connect <code className="text-cyan-300">S</code> to D12, <code className="text-cyan-300">+</code> to 5V, and <code className="text-cyan-300">-</code> to GND.
                  </li>
                  <li>
                    <strong>If using a bare 2-pin passive piezo transducer:</strong> <em>DO NOT connect 5V directly!</em> Connect Pin 1 to Arduino D12 through a 100Ω current-limiting resistor, and Pin 2 to Arduino GND. Driving a bare coil directly without a resistor can damage pin D12.
                  </li>
                </ul>
                <p className="text-emerald-400 font-medium">
                  <strong>Timer Compatibility:</strong> <code className="text-slate-200 font-mono">tone()</code> uses <strong>Timer 2</strong>. Servo uses <strong>Timer 1</strong>. They operate on separate hardware timers with zero conflict!
                </p>
              </div>
            </div>

            {/* Additional engineering recommendation */}
            <div className="p-3 bg-slate-950 rounded border border-slate-800 text-xs text-slate-300">
              <strong className="text-slate-100">Engineering Recommendation for Servo Stability:</strong> Place a{' '}
              <strong className="text-cyan-400">100 µF to 470 µF electrolytic capacitor</strong> (rated 10V or 16V) directly across the external 5V and GND rail near the SG90 servo connector. This absorbs the motor's sudden inductive switching current surges and prevents ultrasonic measurement glitches.
            </div>
          </div>
        </div>
      </section>

      {/* 2. Verified Pin-Connection Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">2. Verified Pin-Connection Matrix</h2>
            <p className="text-xs text-slate-400 font-mono">
              Complete pinout mapping with electrical direction, logic levels, and timer allocations
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                <th className="p-3">Device & Signal</th>
                <th className="p-3">Arduino Pin</th>
                <th className="p-3">I/O Mode</th>
                <th className="p-3">Electrical Voltage / Specs</th>
                <th className="p-3">Hardware Notes & Timers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-red-400">Laser 1 Control (S)</td>
                <td className="p-3 font-bold text-amber-300">D7</td>
                <td className="p-3 text-cyan-300">OUTPUT</td>
                <td className="p-3">5V TTL (HIGH = On, LOW = Off)</td>
                <td className="p-3 text-slate-400">Standard GPIO. Internal limit ~25-30mA.</td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-red-400">Laser 2 Control (S)</td>
                <td className="p-3 font-bold text-amber-300">D10</td>
                <td className="p-3 text-cyan-300">OUTPUT</td>
                <td className="p-3">5V TTL (HIGH = On, LOW = Off)</td>
                <td className="p-3 text-slate-400">
                  Timer 1 disables PWM on D10 when Servo is active, but binary <code>digitalWrite()</code> is 100% functional.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-amber-400">LDR 1 Divider Junction</td>
                <td className="p-3 font-bold text-amber-300">A0</td>
                <td className="p-3 text-emerald-300">INPUT (Analog)</td>
                <td className="p-3">0V – 5.0V Analog (ADC: 0 – 1023)</td>
                <td className="p-3 text-slate-400">
                  LDR leg to 5V; 10 kΩ resistor from A0 to GND. Laser on: ~950; beam cut: &lt;300.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-amber-400">LDR 2 Divider Junction</td>
                <td className="p-3 font-bold text-amber-300">A1</td>
                <td className="p-3 text-emerald-300">INPUT (Analog)</td>
                <td className="p-3">0V – 5.0V Analog (ADC: 0 – 1023)</td>
                <td className="p-3 text-slate-400">
                  LDR leg to 5V; 10 kΩ resistor from A1 to GND. Laser on: ~950; beam cut: &lt;300.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-yellow-400">Passive Buzzer Signal</td>
                <td className="p-3 font-bold text-amber-300">D12</td>
                <td className="p-3 text-cyan-300">OUTPUT</td>
                <td className="p-3">5V AC Square wave via <code>tone()</code></td>
                <td className="p-3 text-slate-400">
                  Operates via <strong>Timer 2</strong>. Modulates between 880 Hz and 1200 Hz for siren.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-blue-400">SG90 Servo Signal</td>
                <td className="p-3 font-bold text-amber-300">D9</td>
                <td className="p-3 text-cyan-300">OUTPUT (PWM)</td>
                <td className="p-3">50 Hz PPM signal (1ms – 2ms pulses)</td>
                <td className="p-3 text-slate-400">
                  Uses <strong>Timer 1</strong> via <code>Servo.h</code>. Power (Red) MUST connect to separate 5V supply!
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-cyan-400">HC-SR04 TRIG</td>
                <td className="p-3 font-bold text-amber-300">D4</td>
                <td className="p-3 text-cyan-300">OUTPUT</td>
                <td className="p-3">5V TTL (10 µs HIGH pulse)</td>
                <td className="p-3 text-slate-400">Initiates 8-cycle 40 kHz acoustic burst.</td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-cyan-400">HC-SR04 ECHO</td>
                <td className="p-3 font-bold text-amber-300">D5</td>
                <td className="p-3 text-emerald-300">INPUT</td>
                <td className="p-3">5V TTL pulse width (proportional to dist)</td>
                <td className="p-3 text-slate-400">
                  Measured with <code>pulseIn()</code> using a strict 25,000 µs timeout (~4.2m).
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-emerald-400">I2C LCD SDA</td>
                <td className="p-3 font-bold text-amber-300">A4</td>
                <td className="p-3 text-indigo-300">I2C DATA</td>
                <td className="p-3">5V Open-drain with backpack pull-up</td>
                <td className="p-3 text-slate-400">Hardware I2C Data (PCF8574 I/O Expander).</td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-emerald-400">I2C LCD SCL</td>
                <td className="p-3 font-bold text-amber-300">A5</td>
                <td className="p-3 text-indigo-300">I2C CLOCK</td>
                <td className="p-3">5V Open-drain with backpack pull-up</td>
                <td className="p-3 text-slate-400">Hardware I2C Clock (100 kHz bus).</td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-purple-400">Common Ground</td>
                <td className="p-3 font-bold text-amber-300">GND</td>
                <td className="p-3 text-slate-400">POWER GND</td>
                <td className="p-3">0V Reference Potential</td>
                <td className="p-3 text-slate-400">
                  Shared ground connection between Arduino Uno GND, External 5V GND, LDR GND, and HC-SR04 GND.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Required Libraries & I2C Address */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">3. Required Arduino Libraries & I2C Configuration</h2>
            <p className="text-xs text-slate-400 font-mono">
              Exact library names, authors, and I2C address detection guide
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3 bg-slate-950 p-4 rounded-lg border border-slate-800">
            <h3 className="text-sm font-bold text-slate-200">Library Manifest</h3>
            <ul className="space-y-3 text-slate-300">
              <li className="p-2.5 bg-slate-900 rounded border border-slate-800">
                <div className="flex justify-between">
                  <strong className="text-indigo-400 font-mono">&lt;Servo.h&gt;</strong>
                  <span className="text-emerald-400">Built-in Arduino AVR</span>
                </div>
                <p className="text-slate-400 mt-1">Pre-installed with the Arduino IDE. Manages Timer 1 interrupts for D9 PWM.</p>
              </li>
              <li className="p-2.5 bg-slate-900 rounded border border-slate-800">
                <div className="flex justify-between">
                  <strong className="text-indigo-400 font-mono">&lt;Wire.h&gt;</strong>
                  <span className="text-emerald-400">Built-in Arduino AVR</span>
                </div>
                <p className="text-slate-400 mt-1">Standard TWI/I2C communication library on pins A4 (SDA) and A5 (SCL).</p>
              </li>
              <li className="p-2.5 bg-slate-900 rounded border border-slate-800">
                <div className="flex justify-between">
                  <strong className="text-indigo-400 font-mono">&lt;LiquidCrystal_I2C.h&gt;</strong>
                  <span className="text-amber-400">Frank de Brabander</span>
                </div>
                <p className="text-slate-400 mt-1">
                  Install via Arduino IDE: <strong>Sketch &gt; Include Library &gt; Manage Libraries</strong>, search for{' '}
                  <code className="text-slate-200">LiquidCrystal I2C</code> by <em>Frank de Brabander</em> (or <em>Marco Schwartz</em>).
                </p>
              </li>
            </ul>
          </div>

          <div className="space-y-3 bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-200">How to Find Your LCD I2C Address</h3>
                <button
                  type="button"
                  onClick={copyScannerCode}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-mono flex items-center gap-1 transition"
                >
                  {copiedScanner ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedScanner ? 'Copied!' : 'Copy I2C Scanner'}
                </button>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Most 16x2 I2C adapters use either <strong>0x27</strong> (PCF8574T chip) or <strong>0x3F</strong> (PCF8574AT chip). If your LCD lights up but displays blank rectangles or nothing, run this lightweight scanner:
              </p>
              <pre className="mt-2 p-2.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-32">
                {i2cScannerCode}
              </pre>
            </div>
            <p className="text-slate-400 text-[11px]">
              Tip: If address matches but text is invisible, turn the small blue contrast potentiometer on the back of the LCD backpack with a small screwdriver.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Fundamental Sensor Physics & Architectural Limitations */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">4. Crucial Sensor Physics & Engineering Limitations</h2>
            <p className="text-xs text-slate-400 font-mono">
              Addressing why ultrasonic pointing is an estimate rather than a guaranteed target lock
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <h3 className="font-bold text-amber-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              1. Tripwire vs. Coordinate Disconnect
            </h3>
            <p className="text-slate-300 leading-relaxed">
              The two laser beams function strictly as <strong>1-bit binary boundary tripwires</strong>. They indicate <em>that</em> a boundary was breached, but provide zero positional data (no X, Y, Z coordinates, distance, or bearing).
            </p>
            <p className="text-slate-400 leading-relaxed">
              When the servo-mounted ultrasonic radar sweeps after a trip, it scans the sector for <em>any acoustic reflector closer than the background profile</em>. It cannot guarantee that the detected object is the intruder that cut the beam. For instance, if an intruder runs through and exits the room, or hides behind furniture outside the scan cone, the radar will correctly report "No target found" rather than inventing a false reading.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <h3 className="font-bold text-amber-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              2. Acoustic Spread Angle (~15° to 30°)
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Unlike a tight laser beam, the HC-SR04 emits a <strong>wide conical acoustic wave</strong>. The sensor returns the distance to the <em>nearest point</em> on an object anywhere within that ~15°–30° cone.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Consequently, the angular resolution is bounded: if an object is at 88°, the sensor may register it from 80° to 96°. Our sketch uses multi-ping verification and step averaging to pinpoint the peak return angle.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <h3 className="font-bold text-amber-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              3. Specular Reflection & Soft Fabrics
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Sound waves reflect like light on mirrors. If an intruder is angled obliquely (e.g. 45°) to the sensor, the 40 kHz pulse bounces away from the receiver rather than returning (specular scattering).
            </p>
            <p className="text-slate-400 leading-relaxed">
              Furthermore, soft winter coats, wool sweaters, and fabrics absorb 40 kHz ultrasonic energy, drastically attenuating echo amplitude. Hard surfaces (leather, shoes, legs, walls) reflect much more reliably.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <h3 className="font-bold text-amber-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              4. Servo Mechanical Latency vs. Moving Targets
            </h3>
            <p className="text-slate-300 leading-relaxed">
              The SG90 servo sweeps from 30° to 150° in increments of 5° with a 60 ms settling pause per step. A full sweep takes approximately 1.5 seconds.
            </p>
            <p className="text-slate-400 leading-relaxed">
              If an intruder crosses the beam at running speed, they may be out of the sector before the radar reaches that angle. The sketch handles this gracefully by holding the alarm on the buzzer and declaring "No target found" on the LCD.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Step-by-Step Calibration & Testing Instructions */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">5. Step-by-Step Physical Calibration & Testing Procedure</h2>
            <p className="text-xs text-slate-400 font-mono">
              Follow these stages in sequence before permanent installation
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-slate-950 rounded border-l-4 border-l-blue-500 border-slate-800 space-y-1.5">
            <strong className="text-blue-300 text-sm">Stage 1: Mechanical & Optical Alignment</strong>
            <p className="text-slate-300">
              1. Mount both laser modules (D7, D10) rigidly across the monitored doorway or hallway pointing towards LDR1 (A0) and LDR2 (A1).
            </p>
            <p className="text-slate-300">
              2. Ensure the bright red laser dots hit the center of the cadmium-sulfide (CdS) LDR sensor heads. Tip: Slip a 1-inch piece of black heat-shrink or straw over each LDR to shield them from ambient ceiling light!
            </p>
            <p className="text-slate-300">
              3. Mount the SG90 servo centrally so its 90° horn position points directly forward down the monitored corridor. Attach the HC-SR04 securely to the horn.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 rounded border-l-4 border-l-emerald-500 border-slate-800 space-y-1.5">
            <strong className="text-emerald-300 text-sm">Stage 2: Power-Up & Automatic Calibration</strong>
            <p className="text-slate-300">
              1. Power on the external 5V servo supply first, then plug in the Arduino Uno via USB. Open the Arduino Serial Monitor at <strong>115200 baud</strong>.
            </p>
            <p className="text-slate-300">
              2. Keep the monitored corridor completely empty during the first 5 seconds.
            </p>
            <p className="text-slate-300">
              3. The sketch will execute <code className="text-emerald-300">calibrateLDRs()</code>: it samples A0 and A1 over 30 readings, calculates baseline ADC (typically ~900–980), and sets dynamic trip thresholds at 70% of baseline with a ±30 count hysteresis band.
            </p>
            <p className="text-slate-300">
              4. Next, the sketch automatically executes <code className="text-cyan-300">recordBaselineEnvironment()</code>: the servo sweeps from 30° to 150°, recording the distance to the static walls/furniture in <code className="text-cyan-300">baselineDistances[]</code>.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 rounded border-l-4 border-l-amber-500 border-slate-800 space-y-1.5">
            <strong className="text-amber-300 text-sm">Stage 3: Verification & Intrusion Simulation</strong>
            <p className="text-slate-300">
              1. LCD should display <code className="text-emerald-400">"SYSTEM ARMED" / "Beams: SECURED"</code>.
            </p>
            <p className="text-slate-300">
              2. Pass a piece of cardboard or your hand across Laser Beam 1.
            </p>
            <p className="text-slate-300">
              3. The passive buzzer should sound immediately with a two-tone warble (880 Hz / 1200 Hz).
            </p>
            <p className="text-slate-300">
              4. The servo will immediately begin sweeping. Stand in the monitored area: the radar will detect your presence because your measured distance is significantly closer (&gt;25 cm closer) than the recorded wall baseline.
            </p>
            <p className="text-slate-300">
              5. The servo will stop, aim straight at you, and the LCD will display <code className="text-cyan-300">"TARGET LOCKED!"</code> with your exact Distance (cm) and Bearing Angle (°).
            </p>
            <p className="text-slate-300">
              6. Open the Serial Monitor and send <code className="text-amber-300 font-bold">'R'</code> to reset and rearm the system!
            </p>
          </div>
        </div>
      </section>

      {/* 6. Comprehensive Troubleshooting Matrix */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">6. Exhaustive Troubleshooting Guide</h2>
            <p className="text-xs text-slate-400 font-mono">
              Root causes and field fixes for jitter, false alarms, and acoustic anomalies
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                <th className="p-3 w-1/4">Symptom</th>
                <th className="p-3 w-1/3">Probable Root Cause</th>
                <th className="p-3">Embedded Engineer's Solution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-rose-400">False laser alarms when nobody is nearby</td>
                <td className="p-3 text-slate-400">
                  Ambient sunlight shifts, fluorescent light 100/120Hz flicker, or laser beam spot creeping off LDR edge due to mechanical flex.
                </td>
                <td className="p-3 text-slate-200">
                  1. Place a 2cm dark opaque tube or heat-shrink over the LDR face to eliminate off-axis room glare.
                  <br />
                  2. In the sketch, increase <code className="text-amber-300">DEBOUNCE_CHECKS</code> from 3 to 5.
                  <br />
                  3. Verify that the 10 kΩ resistor is seated firmly in breadboard ground.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-rose-400">Servo jitters, twitches, or Arduino resets during sweep</td>
                <td className="p-3 text-slate-400">
                  Current starvation or lack of shared ground potential. Common if servo is powered from Arduino 5V pin.
                </td>
                <td className="p-3 text-slate-200">
                  1. Double-check that servo Red wire is on the <strong>external 5V supply</strong>, NOT the Arduino 5V pin!
                  <br />
                  2. Confirm external supply GND is linked directly to Arduino GND.
                  <br />
                  3. Add a 100µF–470µF capacitor directly across servo VCC and GND.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-rose-400">Ultrasonic always reads 0 cm or hangs loop</td>
                <td className="p-3 text-slate-400">
                  ECHO pin not connected properly, or missing timeout in <code>pulseIn()</code> blocking for 1 second.
                </td>
                <td className="p-3 text-slate-200">
                  1. Our sketch uses <code className="text-cyan-300">pulseIn(PIN_US_ECHO, HIGH, 25000UL)</code> which forces an immediate 25ms timeout.
                  <br />
                  2. Verify Trig is on D4 and Echo is on D5.
                  <br />
                  3. Ensure HC-SR04 has solid 5V VCC (it does not run properly at 3.3V).
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-rose-400">Radar locks onto a permanent wall instead of intruder</td>
                <td className="p-3 text-slate-400">
                  Baseline calibration was performed with someone standing in the room, or <code className="text-amber-300">MIN_OBJECT_DELTA_CM</code> is set too small.
                </td>
                <td className="p-3 text-slate-200">
                  1. Ensure room is 100% empty during the initial boot baseline sweep.
                  <br />
                  2. Increase <code className="text-amber-300">MIN_OBJECT_DELTA_CM</code> from 15 to 25 cm so minor ultrasonic distance noise isn't mistaken for a human.
                  <br />
                  3. Send 'R' via Serial Monitor to recapture a clean empty room profile.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-semibold text-rose-400">LCD shows 16 solid blue/black blocks on row 1</td>
                <td className="p-3 text-slate-400">
                  LCD contrast potentiometer is misadjusted or the I2C address is wrong (e.g. 0x3F instead of 0x27).
                </td>
                <td className="p-3 text-slate-200">
                  1. Rotate the contrast potentiometer on the blue backpack with a small flathead screwdriver until text characters appear sharp.
                  <br />
                  2. Run the provided I2C Scanner to verify whether your module is 0x27 or 0x3F, then update <code className="text-amber-300">LCD_I2C_ADDR</code>.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
