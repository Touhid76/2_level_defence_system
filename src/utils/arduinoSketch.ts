import { SystemConfig } from '../types';

export function generateArduinoSketch(cfg: SystemConfig): string {
  return `/*
 * ==============================================================================
 * Project: Dual-Laser Intrusion Alarm with Servo-Mounted Ultrasonic Radar & LCD
 * Target Board: Arduino Uno (ATmega328P, 16 MHz, 5V Logic)
 * 
 * Circuit Connections:
 *   - Laser 1 Trigger:     Pin D7   (Digital OUT)
 *   - Laser 2 Trigger:     Pin D10  (Digital OUT)
 *   - LDR 1 Divider:       Pin A0   (Analog IN, 10k resistor to GND)
 *   - LDR 2 Divider:       Pin A1   (Analog IN, 10k resistor to GND)
 *   - Passive Buzzer:      Pin D12  (Tone OUT via onboard driver or 100-ohm resistor)
 *   - SG90 Servo Signal:   Pin D9   (PWM/Servo OUT, Powered by EXTERNAL 5V supply)
 *   - HC-SR04 TRIG:        Pin D4   (Digital OUT, 10us trigger pulse)
 *   - HC-SR04 ECHO:        Pin D5   (Digital IN, 5V echo pulse)
 *   - I2C LCD (SDA):       Pin A4   (Hardware I2C Data)
 *   - I2C LCD (SCL):       Pin A5   (Hardware I2C Clock)
 *   - Common Ground:       External 5V supply GND connected to Arduino GND!
 * 
 * Required Libraries:
 *   1. <Servo.h>              - Built-in Arduino AVR Servo Library (Uses Timer 1)
 *   2. <Wire.h>               - Built-in Arduino I2C Library
 *   3. <LiquidCrystal_I2C.h>  - "LiquidCrystal I2C" by Frank de Brabander
 *                              (Install via Arduino IDE Library Manager)
 * 
 * Hardware Timer Note:
 *   - Servo.h utilizes 16-bit Timer 1 (disabling analogWrite PWM on D9 and D10).
 *     Pin D10 is used here as standard digitalWrite (laser on/off), which is NOT
 *     affected by Timer 1 PWM disablement.
 *   - tone() utilizes 8-bit Timer 2 (disabling PWM on D3 and D11).
 *     Pins D3 and D11 are unused in this project.
 *   - Therefore, tone() and Servo run simultaneously without any hardware conflict!
 * ==============================================================================
 */

#include <Wire.h>
#include <Servo.h>
#include <LiquidCrystal_I2C.h>

// ==========================================
// 1. PIN DEFINITIONS & HARDWARE CONSTANTS
// ==========================================
const uint8_t PIN_LASER1      = 7;    // Laser Module 1 Control
const uint8_t PIN_LASER2      = 10;   // Laser Module 2 Control
const uint8_t PIN_LDR1        = A0;   // LDR 1 Analog Input (Voltage Divider)
const uint8_t PIN_LDR2        = A1;   // LDR 2 Analog Input (Voltage Divider)
const uint8_t PIN_BUZZER      = 12;   // Passive Buzzer Signal
const uint8_t PIN_SERVO       = 9;    // SG90 Servo PWM / Signal Pin
const uint8_t PIN_US_TRIG     = 4;    // HC-SR04 Trigger Pin
const uint8_t PIN_US_ECHO     = 5;    // HC-SR04 Echo Pin

// ==========================================
// 2. USER-CONFIGURABLE PARAMETERS
// ==========================================
// I2C LCD Address: Usually 0x27 (PCF8574T) or 0x3F (PCF8574AT). 16 cols, 2 rows.
#define LCD_I2C_ADDR ${cfg.lcdI2cAddress}
#define LCD_COLS     16
#define LCD_ROWS     2

// Servo Scan Parameters (Angle convention: 90 deg = Center / Forward)
const uint8_t SERVO_MIN_ANGLE  = ${cfg.servoMinAngle};   // Left sweep boundary
const uint8_t SERVO_MAX_ANGLE  = ${cfg.servoMaxAngle};  // Right sweep boundary
const uint8_t SERVO_REST_ANGLE = ${cfg.servoRestAngle};   // Idle center position
const uint8_t SERVO_STEP_DEG   = ${cfg.servoStepDeg};    // Scan step increment in degrees
const uint8_t SERVO_SETTLE_MS  = ${cfg.settlingDelayMs};   // Mechanical vibration settling delay

// Ultrasonic Sonar Parameters
const unsigned long ECHO_TIMEOUT_US = ${cfg.echoTimeoutUs}UL; // 25ms timeout (~4.2m max range)
const uint16_t MAX_VALID_DIST_CM    = ${cfg.maxValidDistanceCm}; // Ignore reflections further than this
const uint16_t MIN_OBJECT_DELTA_CM  = ${cfg.minObjectDeltaCm};  // Must be this much closer than background
const uint8_t  CONFIRM_SAMPLES      = 3;   // Number of pings required to confirm candidate

// LDR Calibration & Tripwire Thresholds
const uint8_t  LDR_CALIB_SAMPLES    = ${cfg.ldrSamples};  // Calibration sample averaging
const uint8_t  TRIP_PERCENT_DROP    = ${cfg.laserTripThresholdPct};  // % drop from baseline to trigger alarm
const int16_t  HYSTERESIS_MARGIN    = ${cfg.hysteresisMargin};  // ADC counts hysteresis to prevent chatter
const uint8_t  DEBOUNCE_CHECKS      = 3;   // Consecutive trip readings required

// Buzzer Audio Frequencies (Passive Buzzer via tone())
const uint16_t BUZZER_FREQ_NORMAL   = ${cfg.buzzerFreqHz}; // Primary alarm frequency
const uint16_t BUZZER_FREQ_ALERT    = ${cfg.buzzerAlertFreqHz}; // Modulated siren frequency

// Number of angular scan bins for baseline background map
const uint8_t SCAN_ARRAY_SIZE = ((SERVO_MAX_ANGLE - SERVO_MIN_ANGLE) / SERVO_STEP_DEG) + 1;

// ==========================================
// 3. SYSTEM STATE MACHINE
// ==========================================
enum SystemState {
  STATE_BOOT,
  STATE_CALIBRATING_LDR,
  STATE_RECORDING_BASELINE,
  STATE_ARMED,
  STATE_TRIPPED,
  STATE_SCANNING_RADAR,
  STATE_CONFIRMING_TARGET,
  STATE_TARGET_LOCKED,
  STATE_NO_TARGET_FOUND,
  STATE_ALARM_HOLD
};

SystemState currentState = STATE_BOOT;

// Objects
Servo radarServo;
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS);

// Global Storage
uint16_t ldr1Baseline = 0;
uint16_t ldr2Baseline = 0;
uint16_t ldr1Threshold = 0;
uint16_t ldr2Threshold = 0;

uint16_t baselineDistances[SCAN_ARRAY_SIZE]; // Background room profile (cm)

// Transient Tracking Variables
uint8_t currentScanAngle = SERVO_MIN_ANGLE;
int8_t  scanDirection = 1; // +1 = clockwise, -1 = counter-clockwise
uint8_t targetLockedAngle = SERVO_REST_ANGLE;
uint16_t targetLockedDistance = 0;
bool targetFound = false;
bool ldr1Breached = false;
bool ldr2Breached = false;

// Timing Engine (millis-based non-blocking)
unsigned long stateTimer = 0;
unsigned long buzzerTimer = 0;
bool buzzerPhase = false;
unsigned long beamMonitorTimer = 0;

// LCD Buffer Helper to avoid flicker
char lcdBufferLine1[17];
char lcdBufferLine2[17];

// ==========================================
// 4. FUNCTION PROTOTYPES
// ==========================================
void calibrateLDRs();
void recordBaselineEnvironment();
uint16_t pingDistanceCm();
void updateLcd(const char* line1, const char* line2);
void handleBuzzerAlert();
bool checkLaserBreach();
uint8_t angleToIndex(uint8_t angle);

// ==========================================
// 5. ARDUINO SETUP ROUTINE
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println(F("\\n========================================================"));
  Serial.println(F(" Dual-Laser Security Alarm & Ultrasonic Radar Starting..."));
  Serial.println(F("========================================================"));

  // Initialize GPIO
  pinMode(PIN_LASER1, OUTPUT);
  pinMode(PIN_LASER2, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_US_TRIG, OUTPUT);
  pinMode(PIN_US_ECHO, INPUT);

  digitalWrite(PIN_US_TRIG, LOW);
  noTone(PIN_BUZZER);

  // Turn ON both laser modules for alignment
  digitalWrite(PIN_LASER1, HIGH);
  digitalWrite(PIN_LASER2, HIGH);

  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  updateLcd("SYSTEM BOOTING", "Aligning Lasers");

  // Attach Servo
  radarServo.attach(PIN_SERVO);
  radarServo.write(SERVO_REST_ANGLE);
  delay(500);

  // Step 1: Optical Alignment & LDR Calibration
  currentState = STATE_CALIBRATING_LDR;
  calibrateLDRs();

  // Step 2: Background Ultrasonic Sweep
  currentState = STATE_RECORDING_BASELINE;
  recordBaselineEnvironment();

  // System Armed
  currentState = STATE_ARMED;
  radarServo.write(SERVO_REST_ANGLE);
  updateLcd("SYSTEM ARMED", "Beams: SECURED");
  Serial.println(F("[SYSTEM] Armed and guarding perimeter. Send 'R' to re-calibrate."));
}

// ==========================================
// 6. MAIN SUPER-LOOP (STATE MACHINE)
// ==========================================
void loop() {
  // Check for User Serial Reset / Rearm command
  if (Serial.available()) {
    char ch = Serial.read();
    if (ch == 'r' || ch == 'R') {
      Serial.println(F("[USER] Reset command received via Serial. Rearming..."));
      noTone(PIN_BUZZER);
      radarServo.write(SERVO_REST_ANGLE);
      calibrateLDRs();
      recordBaselineEnvironment();
      currentState = STATE_ARMED;
      updateLcd("SYSTEM ARMED", "Beams: SECURED");
      return;
    }
  }

  switch (currentState) {
    // ----------------------------------------------------
    // STATE: ARMED (Continuously monitor tripwires)
    // ----------------------------------------------------
    case STATE_ARMED: {
      if (checkLaserBreach()) {
        currentState = STATE_TRIPPED;
        stateTimer = millis();
        Serial.println(F("[ALARM] Laser tripwire interrupted!"));
        updateLcd("! INTRUSION !", ldr1Breached ? "Beam 1 Cut" : (ldr2Breached ? "Beam 2 Cut" : "Both Beams Cut"));
      }
      break;
    }

    // ----------------------------------------------------
    // STATE: TRIPPED (Activate alarm sound, prepare radar)
    // ----------------------------------------------------
    case STATE_TRIPPED: {
      handleBuzzerAlert();

      // Begin ultrasonic sweep to locate the newly introduced object
      Serial.println(F("[RADAR] Initializing angular sector sweep..."));
      updateLcd("RADAR SCANNING", "Locating target");
      currentScanAngle = SERVO_MIN_ANGLE;
      scanDirection = 1;
      radarServo.write(currentScanAngle);
      stateTimer = millis() + SERVO_SETTLE_MS; // wait for initial transit
      currentState = STATE_SCANNING_RADAR;
      break;
    }

    // ----------------------------------------------------
    // STATE: SCANNING RADAR (Step by step non-blocking)
    // ----------------------------------------------------
    case STATE_SCANNING_RADAR: {
      handleBuzzerAlert(); // keep sounding alarm

      if (millis() >= stateTimer) {
        // Measure distance at current servo angle
        uint16_t measuredDist = pingDistanceCm();
        uint8_t idx = angleToIndex(currentScanAngle);
        uint16_t baseline = baselineDistances[idx];

        Serial.print(F("[SWEEP] Angle: "));
        Serial.print(currentScanAngle);
        Serial.print(F(" deg | Current: "));
        Serial.print(measuredDist);
        Serial.print(F(" cm | Base: "));
        Serial.print(baseline);
        Serial.println(F(" cm"));

        // Evaluate candidate: must be valid reading and significantly closer than background
        if (measuredDist > 0 && measuredDist <= MAX_VALID_DIST_CM) {
          if (baseline > 0 && (baseline > measuredDist + MIN_OBJECT_DELTA_CM)) {
            // Found a candidate object! Move to confirmation phase
            Serial.print(F(">>> Potential target detected at "));
            Serial.print(currentScanAngle);
            Serial.println(F(" deg! Confirming..."));
            
            targetLockedAngle = currentScanAngle;
            currentState = STATE_CONFIRMING_TARGET;
            stateTimer = millis() + 40;
            break;
          }
        }

        // Advance servo to next step
        currentScanAngle += (SERVO_STEP_DEG * scanDirection);

        // Check boundary limits
        if (currentScanAngle > SERVO_MAX_ANGLE) {
          // Finished full forward sweep without lock
          Serial.println(F("[RADAR] Full sector sweep completed. No new target found."));
          currentState = STATE_NO_TARGET_FOUND;
          stateTimer = millis();
          radarServo.write(SERVO_REST_ANGLE);
          updateLcd("! INTRUSION !", "No target found");
          break;
        } else {
          radarServo.write(currentScanAngle);
          stateTimer = millis() + SERVO_SETTLE_MS; // wait for servo to settle
        }
      }
      break;
    }

    // ----------------------------------------------------
    // STATE: CONFIRMING TARGET (Repeat pings to eliminate glitch)
    // ----------------------------------------------------
    case STATE_CONFIRMING_TARGET: {
      handleBuzzerAlert();

      if (millis() >= stateTimer) {
        uint8_t validPings = 0;
        uint32_t distSum = 0;

        for (uint8_t i = 0; i < CONFIRM_SAMPLES; i++) {
          delay(25); // safe acoustic decay delay between pings
          uint16_t ping = pingDistanceCm();
          if (ping > 0 && ping <= MAX_VALID_DIST_CM) {
            validPings++;
            distSum += ping;
          }
        }

        if (validPings >= 2) {
          // Target confirmed!
          targetLockedDistance = distSum / validPings;
          targetFound = true;
          currentState = STATE_TARGET_LOCKED;
          Serial.print(F("[LOCKED] Confirmed target at "));
          Serial.print(targetLockedAngle);
          Serial.print(F(" deg, Distance: "));
          Serial.print(targetLockedDistance);
          Serial.println(F(" cm"));

          // Format output for 16x2 LCD
          char line1[17];
          char line2[17];
          snprintf(line1, sizeof(line1), "TARGET LOCKED!  ");
          snprintf(line2, sizeof(line2), "D:%3ucm A:%3udeg", targetLockedDistance, targetLockedAngle);
          updateLcd(line1, line2);

          // Hold servo pointing exactly at the detected target
          radarServo.write(targetLockedAngle);
        } else {
          // Was a transient noise echo or moving shadow, resume sweep
          Serial.println(F("[RADAR] False reflection, resuming sweep..."));
          currentScanAngle += SERVO_STEP_DEG;
          currentState = STATE_SCANNING_RADAR;
          radarServo.write(currentScanAngle);
          stateTimer = millis() + SERVO_SETTLE_MS;
        }
      }
      break;
    }

    // ----------------------------------------------------
    // STATE: TARGET LOCKED OR NO TARGET (Maintain alarm & check reset)
    // ----------------------------------------------------
    case STATE_TARGET_LOCKED:
    case STATE_NO_TARGET_FOUND: {
      handleBuzzerAlert();

      // Check if beams have become clear and user wants automatic re-arm after 10 seconds
      int a0 = analogRead(PIN_LDR1);
      int a1 = analogRead(PIN_LDR2);

      // If beams are restored above threshold with hysteresis
      if (a0 > (ldr1Threshold + HYSTERESIS_MARGIN) && a1 > (ldr2Threshold + HYSTERESIS_MARGIN)) {
        // Beams are clear! Could auto-rearm if held clear for 5 seconds
        // For security purposes, alarm latches until explicit command
      }
      break;
    }

    default:
      break;
  }
}

// ==========================================
// 7. LDR CALIBRATION ROUTINE
// ==========================================
void calibrateLDRs() {
  Serial.println(F("[CALIB] Aligning Lasers and measuring open-beam lux..."));
  updateLcd("CALIBRATING LDR", "Hold beams clear");

  uint32_t sum1 = 0;
  uint32_t sum2 = 0;

  for (uint8_t i = 0; i < LDR_CALIB_SAMPLES; i++) {
    sum1 += analogRead(PIN_LDR1);
    sum2 += analogRead(PIN_LDR2);
    delay(20);
  }

  ldr1Baseline = sum1 / LDR_CALIB_SAMPLES;
  ldr2Baseline = sum2 / LDR_CALIB_SAMPLES;

  // Calculate trigger threshold based on % drop
  ldr1Threshold = (uint32_t)ldr1Baseline * (100 - TRIP_PERCENT_DROP) / 100;
  ldr2Threshold = (uint32_t)ldr2Baseline * (100 - TRIP_PERCENT_DROP) / 100;

  Serial.print(F("[CALIB] LDR1 Baseline: "));
  Serial.print(ldr1Baseline);
  Serial.print(F(" | Trip Threshold: "));
  Serial.println(ldr1Threshold);

  Serial.print(F("[CALIB] LDR2 Baseline: "));
  Serial.print(ldr2Baseline);
  Serial.print(F(" | Trip Threshold: "));
  Serial.println(ldr2Threshold);

  char buf[17];
  snprintf(buf, sizeof(buf), "L1:%d L2:%d", ldr1Baseline, ldr2Baseline);
  updateLcd("CALIB COMPLETE", buf);
  delay(1200);
}

// ==========================================
// 8. BACKGROUND ULTRASONIC BASELINE MAPPING
// ==========================================
void recordBaselineEnvironment() {
  Serial.println(F("[CALIB] Scanning empty monitored area for background baseline..."));
  updateLcd("RADAR BASELINE", "Mapping room...");

  for (uint8_t angle = SERVO_MIN_ANGLE; angle <= SERVO_MAX_ANGLE; angle += SERVO_STEP_DEG) {
    radarServo.write(angle);
    delay(SERVO_SETTLE_MS);

    // Multi-sample baseline measurement for stability
    uint32_t distAccum = 0;
    uint8_t validCount = 0;

    for (uint8_t s = 0; s < 2; s++) {
      uint16_t d = pingDistanceCm();
      if (d > 0) {
        distAccum += d;
        validCount++;
      }
      delay(30);
    }

    uint8_t idx = angleToIndex(angle);
    if (validCount > 0) {
      baselineDistances[idx] = distAccum / validCount;
    } else {
      baselineDistances[idx] = MAX_VALID_DIST_CM; // open space / out-of-range
    }

    Serial.print(F("  Angle "));
    Serial.print(angle);
    Serial.print(F(" deg -> Base Dist: "));
    Serial.print(baselineDistances[idx]);
    Serial.println(F(" cm"));
  }

  Serial.println(F("[CALIB] Room acoustic baseline successfully recorded."));
  updateLcd("BASELINE READY", "Sector mapped");
  delay(1000);
}

// ==========================================
// 9. HC-SR04 ULTRASONIC PING MEASUREMENT
// ==========================================
uint16_t pingDistanceCm() {
  // Clear trigger pin
  digitalWrite(PIN_US_TRIG, LOW);
  delayMicroseconds(4);

  // Send 10us ultrasonic pulse
  digitalWrite(PIN_US_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_US_TRIG, LOW);

  // Measure return echo with strictly bounded timeout (25ms)
  unsigned long duration = pulseIn(PIN_US_ECHO, HIGH, ECHO_TIMEOUT_US);

  if (duration == 0) {
    return 0; // Echo timed out or object is out-of-range
  }

  // Speed of sound in air is ~343 m/s = 0.0343 cm/us
  // Distance = (duration / 2) * 0.0343 = duration / 58.3
  uint16_t distanceCm = duration / 58;
  return distanceCm;
}

// ==========================================
// 10. LASER TRIPWIRE MONITOR WITH HYSTERESIS
// ==========================================
bool checkLaserBreach() {
  int a0 = analogRead(PIN_LDR1);
  int a1 = analogRead(PIN_LDR2);

  bool t1 = false;
  bool t2 = false;

  // Filter with debounce checks
  if (a0 < (ldr1Threshold - HYSTERESIS_MARGIN)) {
    uint8_t count = 0;
    for (uint8_t i = 0; i < DEBOUNCE_CHECKS; i++) {
      if (analogRead(PIN_LDR1) < ldr1Threshold) count++;
      delayMicroseconds(200);
    }
    if (count == DEBOUNCE_CHECKS) t1 = true;
  }

  if (a1 < (ldr2Threshold - HYSTERESIS_MARGIN)) {
    uint8_t count = 0;
    for (uint8_t i = 0; i < DEBOUNCE_CHECKS; i++) {
      if (analogRead(PIN_LDR2) < ldr2Threshold) count++;
      delayMicroseconds(200);
    }
    if (count == DEBOUNCE_CHECKS) t2 = true;
  }

  if (t1 || t2) {
    ldr1Breached = t1;
    ldr2Breached = t2;
    return true;
  }

  return false;
}

// ==========================================
// 11. PASSIVE BUZZER ALARM (NON-BLOCKING)
// ==========================================
void handleBuzzerAlert() {
  // Two-tone warble siren using tone() on Timer 2
  if (millis() - buzzerTimer >= 150) {
    buzzerTimer = millis();
    buzzerPhase = !buzzerPhase;
    if (buzzerPhase) {
      tone(PIN_BUZZER, BUZZER_FREQ_NORMAL);
    } else {
      tone(PIN_BUZZER, BUZZER_FREQ_ALERT);
    }
  }
}

// ==========================================
// 12. FLICKER-FREE LCD DISPLAY MANAGER
// ==========================================
void updateLcd(const char* line1, const char* line2) {
  // Pad strings to 16 characters to overwrite previous text without lcd.clear()
  char l1[17];
  char l2[17];
  snprintf(l1, sizeof(l1), "%-16.16s", line1);
  snprintf(l2, sizeof(l2), "%-16.16s", line2);

  // Only rewrite if changed
  if (strcmp(l1, lcdBufferLine1) != 0) {
    strncpy(lcdBufferLine1, l1, 16);
    lcdBufferLine1[16] = '\\0';
    lcd.setCursor(0, 0);
    lcd.print(lcdBufferLine1);
  }

  if (strcmp(l2, lcdBufferLine2) != 0) {
    strncpy(lcdBufferLine2, l2, 16);
    lcdBufferLine2[16] = '\\0';
    lcd.setCursor(0, 1);
    lcd.print(lcdBufferLine2);
  }
}

// ==========================================
// 13. HELPER: CONVERT ANGLE TO ARRAY INDEX
// ==========================================
uint8_t angleToIndex(uint8_t angle) {
  if (angle < SERVO_MIN_ANGLE) angle = SERVO_MIN_ANGLE;
  if (angle > SERVO_MAX_ANGLE) angle = SERVO_MAX_ANGLE;
  return (angle - SERVO_MIN_ANGLE) / SERVO_STEP_DEG;
}
`;
}
