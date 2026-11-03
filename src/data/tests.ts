// Verification & validation campaign catalogue. Costs and durations are game-balance values.
export interface TestDef { id: string; name: string; costM: number; months: number; short: string; reduces: string }

export const TESTS: TestDef[] = [
  { id: 'power', name: 'Orbit power-profile simulation', costM: 0.4, months: 0.5, short: 'Five orbits of generation, load and battery state of charge, including eclipses.', reduces: 'Battery degradation and power-draw anomalies (−30%)' },
  { id: 'tvac', name: 'Thermal-vacuum chamber test', costM: 1.4, months: 1.5, short: 'Hot and cold equilibrium temperatures from the Stefan-Boltzmann balance against component limits.', reduces: 'Thermal anomalies (−50%)' },
  { id: 'vibe', name: 'Vibration and shock test', costM: 1.0, months: 1.0, short: 'Natural frequencies and quasi-static launch loads against launcher requirements.', reduces: 'Instrument malfunctions (−20%)' },
  { id: 'rf', name: 'RF range and link test', costM: 0.8, months: 0.8, short: 'Data rate versus distance and the effect of pointing error on the link.', reduces: 'Communication blackouts and transmitter faults (−40%)' },
  { id: 'deploy', name: 'Deployment test', costM: 0.9, months: 1.0, short: 'Solar wing and antenna deployment reliability from mechanism complexity.', reduces: 'Commissioning and array-damage risk (−50%)' },
  { id: 'fire', name: 'Engine static-fire test', costM: 1.2, months: 1.2, short: 'Thrust, Isp, burn time, propellant margin and thrust-to-weight of the main engine.', reduces: 'Orbit-insertion engine failure risk (−50%)' },
  { id: 'emc', name: 'Electromagnetic compatibility test', costM: 0.6, months: 0.6, short: 'Radiated noise from the transmitter and thrusters against the sensitivity of field instruments.', reduces: 'Instrument malfunctions (−15%) and blackouts (−10%)' },
  { id: 'acoustic', name: 'Acoustic and launch-noise test', costM: 0.7, months: 0.7, short: 'How panels and dishes survive the noise of lift-off, from appendage area per kilogram.', reduces: 'Array damage in orbit (−20%)' },
  { id: 'radtest', name: 'Radiation (total dose and upset) test', costM: 1.1, months: 1.2, short: 'Mission dose against component tolerance, plus the expected single-event-upset rate.', reduces: 'Computer faults and memory upsets (−40%)' },
  { id: 'optical', name: 'Optical alignment and calibration', costM: 0.9, months: 1.0, short: 'Pointing and thermal-focus quality of every imager and spectrometer.', reduces: 'Instrument malfunctions (−15%)' },
  { id: 'sw', name: 'Flight-software and data-handling test', costM: 0.8, months: 1.0, short: 'Processing load, storage buffer and fault-protection headroom of the flight computer.', reduces: 'Computer faults (−30%), upsets (−30%), star-tracker blinding (−20%)' },
  { id: 'eol', name: 'Battery and mechanism life test', costM: 1.4, months: 2.0, short: 'Cycle life of the battery and bearing wear over the whole mission.', reduces: 'Battery degradation (−40%), wheel friction (−50%)' },
  { id: 'ete', name: 'End-to-end "day in the life" test', costM: 1.6, months: 1.5, short: 'Runs the power, thermal, link and data tests together as one simulated operating day.', reduces: 'Every anomaly type (−10%)' },
];
export const TEST_MAP: Record<string, TestDef> = Object.fromEntries(TESTS.map((t) => [t.id, t]));
