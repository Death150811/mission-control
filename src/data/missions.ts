import type { Objective, Scenario, TargetId } from '../types';

const AU = 1.495978707e11;

export const SCENARIOS: Scenario[] = [
  {
    id: 'lunar-explorer', code: 'A', name: 'LUNAR EXPLORER', tagline: 'Map the Moon and find where to go next.',
    target: 'moon', bodyId: 'moon', difficultyRating: 2, budgetM: 150, maxMassKg: 1600, deadlineMonths: 30,
    cruiseDays: 5, nominalDays: 180, extendedDays: 90, allowedOrbitIds: ['lunar'], requiredGsdM: 20,
    distance: { type: 'synodic', minM: 3.57e8, maxM: 4.07e8, periodD: 27.3, phase: 0 }, sunDistanceAU: 1.0,
    briefing: 'Space agencies are planning a sustained human presence on the Moon, but our global maps are not detailed enough to choose landing sites. You direct a low-cost orbiter that must image the surface, identify minerals and ice, and relay the results to Earth.',
    science: 'A polar orbit lets the Moon rotate beneath the spacecraft so every longitude passes under the camera. Spectrometers reveal which minerals and ices lie below. Everything must be sent home through a communication link that is cut off every orbit when the Moon blocks Earth.',
    requirements: ['Carry at least one imaging instrument and one spectrometer', 'Complete the lunar capture burn with your own propulsion', 'Provide a downlink capable of returning the science data', 'Operate for at least 120 days in lunar orbit'],
    successConditions: ['Map at least 70% of the lunar surface', 'Return at least 50 science points of mineral data', 'Operate 120+ days'],
    objectives: [
      { id: 'map', type: 'coverage', title: 'Global surface imaging', description: 'Image at least 70% of the lunar surface (Poisson overlap model).', domains: ['imaging'], requiredFraction: 0.7, repeats: 1, mandatory: true, weight: 3 },
      { id: 'minerals', type: 'science', title: 'Identify interesting regions', description: 'Return 50 science points of spectroscopic composition data.', domains: ['spectroscopy'], points: 50, mandatory: true, weight: 3 },
      { id: 'ops', type: 'metric', title: 'Sustained operations', description: 'Operate science instruments for at least 120 days.', metric: 'operatingDays', op: '>=', value: 120, mandatory: true, weight: 1 },
      { id: 'topo', type: 'science', title: 'Topography', description: 'Return 30 points of altimetry data.', domains: ['altimetry'], points: 30, mandatory: false, weight: 2 },
    ],
    bonus: [
      { id: 'fields', type: 'science', title: 'Bonus: magnetic and radiation environment', description: 'Return 12 points of fields / radiation data.', domains: ['fields', 'radiation'], points: 12, mandatory: false, weight: 1 },
      { id: 'data', type: 'metric', title: 'Bonus: data return', description: 'Return 40 GB of data.', metric: 'dataReturnedGB', op: '>=', value: 40, mandatory: false, weight: 1 },
    ],
  },
  {
    id: 'mars-atmosphere', code: 'B', name: 'MARS ATMOSPHERE', tagline: 'Where did the air go?',
    target: 'mars', bodyId: 'mars', difficultyRating: 4, budgetM: 250, maxMassKg: 2800, deadlineMonths: 26,
    cruiseDays: 210, nominalDays: 330, extendedDays: 120, allowedOrbitIds: ['mars'],
    distance: { type: 'synodic', minM: 0.55 * AU, maxM: 2.5 * AU, periodD: 780, phase: 0.9 }, sunDistanceAU: 1.52,
    briefing: 'Mars lost most of its atmosphere billions of years ago. Understanding how that happened tells us about habitability and about the future of Earth. Your orbiter must dip into the upper atmosphere, measure its composition and escape rate across the seasons, and send the data across tens of light-minutes.',
    science: 'Atmospheric sensors and spectrometers sample gases at low altitude; particle instruments see ions leaving to space. Only about 43% of Earth sunlight reaches Mars, so power is tight, and radio signals are weak across hundreds of millions of kilometres.',
    requirements: ['Carry at least one atmospheric instrument', 'Large capture burn: plan propellant for roughly 1-2 km/s', 'High-gain antenna and sufficient transmitter power for deep-space link', 'Operate across seasons for at least 250 days'],
    successConditions: ['Return 120 science points of atmospheric data', 'Operate 250+ days', 'Survive the 210-day cruise and capture'],
    objectives: [
      { id: 'atmo', type: 'science', title: 'Atmospheric composition', description: 'Return 120 science points from atmosphere and spectroscopy instruments.', domains: ['atmosphere', 'spectroscopy'], points: 120, mandatory: true, weight: 4 },
      { id: 'ops', type: 'metric', title: 'Seasonal coverage', description: 'Operate instruments for at least 250 days.', metric: 'operatingDays', op: '>=', value: 250, mandatory: true, weight: 2 },
      { id: 'escape', type: 'science', title: 'Atmospheric escape', description: 'Return 40 points of particles / fields data.', domains: ['particles', 'fields', 'radiation'], points: 40, mandatory: false, weight: 2 },
      { id: 'data', type: 'metric', title: 'Data return', description: 'Return at least 30 GB.', metric: 'dataReturnedGB', op: '>=', value: 30, mandatory: false, weight: 1 },
    ],
    bonus: [
      { id: 'topo', type: 'science', title: 'Bonus: topography', description: 'Return 30 points of altimetry data.', domains: ['altimetry'], points: 30, mandatory: false, weight: 1 },
    ],
  },
  {
    id: 'earth-observation', code: 'C', name: 'EARTH OBSERVATION', tagline: 'See the planet change.',
    target: 'earth', bodyId: 'earth', difficultyRating: 2, budgetM: 150, maxMassKg: 1500, deadlineMonths: 24,
    cruiseDays: 0, nominalDays: 365, extendedDays: 180, allowedOrbitIds: ['leo', 'sso', 'meo', 'geo', 'heo'], requiredGsdM: 60,
    distance: { type: 'fixed' }, sunDistanceAU: 1.0,
    briefing: 'Climate scientists need consistent, repeated multispectral images of the whole planet to track forests, ice and water. You must pick an orbit that gives frequent global coverage, an imager with a wide swath, and a downlink that can carry gigabytes every day.',
    science: 'Orbit altitude and inclination decide resolution, swath and revisit time. Sun-synchronous orbits keep lighting constant. Imagers generate far more data than a small spacecraft can transmit unless compression, storage and antennas are sized together.',
    requirements: ['Multispectral imaging with a ground resolution of 60 m or better', 'Revisit time of at most 14 days', 'Downlink adequate for about 100 GB of data return', 'Operate at least 250 days'],
    successConditions: ['Cover 90% of the globe 20 times with multispectral data', 'Revisit every location within 14 days', 'Return 100+ GB'],
    objectives: [
      { id: 'cover', type: 'coverage', title: 'Repeated global coverage', description: 'Cover 90% of Earth with multispectral imaging at least 20 times.', domains: ['multispectral'], requiredFraction: 0.9, repeats: 20, mandatory: true, weight: 4 },
      { id: 'revisit', type: 'metric', title: 'Revisit time', description: 'Revisit time of at most 14 days.', metric: 'revisitDays', op: '<=', value: 14, mandatory: true, weight: 2 },
      { id: 'data', type: 'metric', title: 'Data return', description: 'Return at least 100 GB of data.', metric: 'dataReturnedGB', op: '>=', value: 100, mandatory: true, weight: 2 },
      { id: 'ops', type: 'metric', title: 'Operations', description: 'Operate instruments at least 250 days.', metric: 'operatingDays', op: '>=', value: 250, mandatory: true, weight: 1 },
      { id: 'thermal', type: 'science', title: 'Surface temperature', description: 'Return 25 points of thermal data.', domains: ['thermal'], points: 25, mandatory: false, weight: 1 },
    ],
    bonus: [
      { id: 'atmo', type: 'science', title: 'Bonus: air composition', description: 'Return 40 points of atmospheric data.', domains: ['atmosphere'], points: 40, mandatory: false, weight: 1 },
      { id: 'hyper', type: 'science', title: 'Bonus: hyperspectral campaign', description: 'Return 50 points of hyperspectral data.', domains: ['hyperspectral'], points: 50, mandatory: false, weight: 1 },
    ],
  },
  {
    id: 'asteroid-rendezvous', code: 'D', name: 'ASTEROID RENDEZVOUS', tagline: 'Chase a 500-metre rock and read its history.',
    target: 'asteroid', bodyId: 'asteroid', difficultyRating: 4, budgetM: 190, maxMassKg: 1500, deadlineMonths: 28,
    cruiseDays: 420, nominalDays: 240, extendedDays: 90, allowedOrbitIds: ['asteroid-orbit'], requiredGsdM: 0.5,
    distance: { type: 'synodic', minM: 0.4 * AU, maxM: 1.8 * AU, periodD: 640, phase: 1.2 }, sunDistanceAU: 1.12,
    briefing: 'Near-Earth asteroid 2026 NS-1 (fictional) is a pile of primitive material left over from the birth of the Solar System. You must send a spacecraft that matches its orbit, maps its shape and composition and navigates by itself, because radio delays make joystick control impossible.',
    science: 'Matching the orbit of a small body demands about 1.1 km/s of delta-v. Chemical engines are fast but need huge propellant loads; ion thrusters are efficient but weak and power-hungry. Gravity is so low that orbital speed is a few centimetres per second.',
    requirements: ['Rendezvous delta-v of ~1.1 km/s with propulsion able to finish the burn before arrival', 'Optical navigation sensor (nav camera or star tracker)', 'A spectrometer and an imager', 'Power for the propulsion type chosen'],
    successConditions: ['Return 50 points of spectroscopic composition data', 'Image the surface twice over', 'Carry a navigation sensor and arrive'],
    objectives: [
      { id: 'comp', type: 'science', title: 'Composition', description: 'Return 50 points of spectroscopy data.', domains: ['spectroscopy'], points: 50, mandatory: true, weight: 3 },
      { id: 'shape', type: 'coverage', title: 'Shape model', description: 'Image 90% of the surface at least twice.', domains: ['imaging'], requiredFraction: 0.9, repeats: 2, mandatory: true, weight: 3 },
      { id: 'nav', type: 'metric', title: 'Optical navigation', description: 'Carry a navigation sensor (nav camera or fine star tracker).', metric: 'navigation', op: '>=', value: 1, mandatory: true, weight: 1 },
      { id: 'topo', type: 'science', title: 'Topography', description: 'Return 40 points of altimetry data.', domains: ['altimetry'], points: 40, mandatory: false, weight: 2 },
      { id: 'ops', type: 'metric', title: 'Proximity operations', description: 'Operate instruments at least 150 days at the asteroid.', metric: 'operatingDays', op: '>=', value: 150, mandatory: false, weight: 1 },
    ],
    bonus: [
      { id: 'dust', type: 'science', title: 'Bonus: dust and particles', description: 'Return 25 points of particles / fields data.', domains: ['particles', 'fields'], points: 25, mandatory: false, weight: 1 },
      { id: 'thermal', type: 'science', title: 'Bonus: thermal inertia', description: 'Return 20 points of thermal data.', domains: ['thermal'], points: 20, mandatory: false, weight: 1 },
    ],
  },
  {
    id: 'deep-space-observatory', code: 'E', name: 'DEEP SPACE OBSERVATORY', tagline: 'Stare at the dark for a long time.',
    target: 'deepspace', bodyId: 'sun', difficultyRating: 5, budgetM: 300, maxMassKg: 2500, deadlineMonths: 36,
    cruiseDays: 30, nominalDays: 540, extendedDays: 365, allowedOrbitIds: ['l2'],
    distance: { type: 'fixed' }, sunDistanceAU: 1.0,
    briefing: 'Faint, distant galaxies need long, steady exposures that no Earth-orbiting telescope can offer. You will park a space telescope at the Sun-Earth L2 point, where it can shade itself from Sun, Earth and Moon at once. Pointing must be steady to a few arcseconds and temperatures must not drift.',
    science: 'Image quality depends on pointing stability and thermal stability. At 1.5 million km, communication needs a high-gain antenna and real transmitter power; nothing can be serviced, so reliability decides the outcome.',
    requirements: ['Carry the space telescope payload', 'Fine pointing: 0.005 deg or better', 'Active thermal management: stability margin of at least 1.3', 'High-gain antenna with deep-space transmitter power', 'Operate at least 420 days'],
    successConditions: ['Return 300 observatory science points', 'Pointing 0.005 deg or better', 'Thermal margin 1.3+', 'Operate 420+ days'],
    objectives: [
      { id: 'sci', type: 'science', title: 'Deep-field observations', description: 'Return 300 science points from the telescope.', domains: ['observatory'], points: 300, mandatory: true, weight: 4 },
      { id: 'point', type: 'metric', title: 'Pointing stability', description: 'Pointing error of 0.005 deg or better.', metric: 'pointingDeg', op: '<=', value: 0.005, mandatory: true, weight: 2 },
      { id: 'thermal', type: 'metric', title: 'Thermal stability', description: 'Thermal margin of at least 1.3.', metric: 'thermalMargin', op: '>=', value: 1.3, mandatory: true, weight: 2 },
      { id: 'ops', type: 'metric', title: 'Operational lifetime', description: 'Operate at least 420 days.', metric: 'operatingDays', op: '>=', value: 420, mandatory: true, weight: 1 },
      { id: 'spec', type: 'science', title: 'Spectroscopy', description: 'Return 60 points of spectroscopy data.', domains: ['spectroscopy'], points: 60, mandatory: false, weight: 2 },
      { id: 'data', type: 'metric', title: 'Data return', description: 'Return at least 150 GB.', metric: 'dataReturnedGB', op: '>=', value: 150, mandatory: false, weight: 1 },
    ],
    bonus: [
      { id: 'rad', type: 'science', title: 'Bonus: cosmic-ray environment', description: 'Return 15 points of radiation / particles data.', domains: ['radiation', 'particles'], points: 15, mandatory: false, weight: 1 },
    ],
  },
];

export const SCENARIO_MAP: Record<string, Scenario> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

export interface SandboxSettings { target: TargetId; budgetM: number; maxMassKg: number; nominalDays: number }

export function makeSandboxScenario(s: SandboxSettings): Scenario {
  const base = {
    earth: SCENARIO_MAP['earth-observation'], moon: SCENARIO_MAP['lunar-explorer'], mars: SCENARIO_MAP['mars-atmosphere'],
    asteroid: SCENARIO_MAP['asteroid-rendezvous'], deepspace: SCENARIO_MAP['deep-space-observatory'],
  }[s.target];
  const objectives: Objective[] = [
    { id: 'sbx-sci', type: 'science', title: 'Collect as much science as possible', description: 'Any instrument counts. Free experimentation.', domains: ['imaging', 'multispectral', 'hyperspectral', 'spectroscopy', 'atmosphere', 'fields', 'particles', 'altimetry', 'thermal', 'observatory', 'radiation'], points: 80, mandatory: false, weight: 1 },
  ];
  return {
    ...base, id: `sandbox-${s.target}`, code: 'S', name: `SANDBOX: ${base.name}`, tagline: 'Free experimentation. No rules but physics.',
    budgetM: s.budgetM, maxMassKg: s.maxMassKg, nominalDays: s.nominalDays, deadlineMonths: 60, extendedDays: 90,
    objectives, bonus: [], requirements: ['None. Build anything you can afford and launch.'],
    successConditions: ['Return science and learn from the debrief'], sandbox: true,
  };
}
