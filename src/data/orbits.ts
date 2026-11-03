import type { BodyId, LaunchClass, TargetId } from '../types';
import type { LaunchWindowDef } from '../engine/launchWindows';

export interface OrbitDef {
  id: string;
  name: string;
  short: string;
  bodyId: BodyId;
  targets: TargetId[];
  kind: 'circular' | 'elliptical' | 'sunsync' | 'geo' | 'halo' | 'asteroid';
  periRange: [number, number];       // km altitude above surface
  apoRange?: [number, number];       // km altitude (elliptical only)
  defaultPeri: number;
  defaultApo: number;
  incRange: [number, number];
  defaultInc: number;
  launchClass: LaunchClass;
  c3?: number;                        // m^2/s^2 launch characteristic energy at the centre of a launch window
  window?: LaunchWindowDef;           // interplanetary launch windows (synodic period)
  vInfMps?: number;                   // arrival hyperbolic excess speed
  fixedInsertionDv?: number;          // m/s
  insertionType: 'none' | 'impulsive' | 'flexible';
  radiation: number;                  // relative radiation environment (1 = nominal)
  summary: string;
  advantages: string[];
  limitations: string[];
}

export const ORBITS: Record<string, OrbitDef> = {
  leo: {
    id: 'leo', name: 'Low Earth Orbit (LEO)', short: 'LEO', bodyId: 'earth', targets: ['earth'], kind: 'circular',
    periRange: [300, 1200], defaultPeri: 550, defaultApo: 550, incRange: [28.5, 98], defaultInc: 53,
    launchClass: 'direct', insertionType: 'none', radiation: 0.8,
    summary: 'Circular orbit a few hundred km up. Fast, cheap to reach, fine resolution, short ground contacts.',
    advantages: ['Highest launch capacity', 'Fine image resolution (small altitude)', 'Short signal delay'],
    limitations: ['Atmospheric drag below ~600 km', 'Only minutes of contact per pass', 'Long eclipses (~35% of each orbit)'],
  },
  sso: {
    id: 'sso', name: 'Sun-Synchronous Orbit (SSO)', short: 'SSO', bodyId: 'earth', targets: ['earth'], kind: 'sunsync',
    periRange: [450, 900], defaultPeri: 650, defaultApo: 650, incRange: [96, 100], defaultInc: 98,
    launchClass: 'direct', insertionType: 'none', radiation: 1.0,
    summary: 'Near-polar orbit whose plane precesses with the Earth around the Sun, so the lighting stays constant.',
    advantages: ['Near-global coverage', 'Constant local solar time for comparable images', 'Great for Earth observation'],
    limitations: ['Inclination is dictated by altitude', 'Launch from polar-ish azimuth costs extra delta-v', 'Polar ground stations needed'],
  },
  meo: {
    id: 'meo', name: 'Medium Earth Orbit (MEO)', short: 'MEO', bodyId: 'earth', targets: ['earth'], kind: 'circular',
    periRange: [2000, 25000], defaultPeri: 20200, defaultApo: 20200, incRange: [28.5, 90], defaultInc: 55,
    launchClass: 'direct', insertionType: 'none', radiation: 2.5,
    summary: 'Navigation-satellite altitude, crossing the Van Allen belts. Wide field of view, harsh radiation.',
    advantages: ['Wide visibility footprint', 'Very low drag', 'Long contact windows'],
    limitations: ['Strong radiation environment', 'Poor image resolution', 'Expensive to reach'],
  },
  geo: {
    id: 'geo', name: 'Geostationary Orbit (GEO)', short: 'GEO', bodyId: 'earth', targets: ['earth'], kind: 'geo',
    periRange: [35786, 35786], defaultPeri: 35786, defaultApo: 35786, incRange: [0, 0], defaultInc: 0,
    launchClass: 'gto', insertionType: 'impulsive', radiation: 1.6,
    summary: 'A 23 h 56 min orbit that keeps pace with Earth rotation: the satellite hovers over one longitude.',
    advantages: ['Continuous view of one hemisphere', 'Almost continuous ground contact', 'Fixed antenna pointing'],
    limitations: ['Poor resolution at 36,000 km', 'Apogee-kick delta-v ~1.8 km/s', 'Higher signal delay and path loss'],
  },
  heo: {
    id: 'heo', name: 'Highly Elliptical Orbit (HEO)', short: 'HEO', bodyId: 'earth', targets: ['earth'], kind: 'elliptical',
    periRange: [500, 1500], apoRange: [20000, 45000], defaultPeri: 600, defaultApo: 39700, incRange: [40, 90], defaultInc: 63.4,
    launchClass: 'direct', insertionType: 'none', radiation: 2.2,
    summary: 'Fast near Earth, slow far away: lingers for hours over high latitudes (Molniya-type).',
    advantages: ['Long dwell over polar regions', 'Long contact windows near apogee'],
    limitations: ['Passes through radiation belts', 'Varying range and resolution', 'Inclination 63.4 deg avoids apsidal drift'],
  },
  lunar: {
    id: 'lunar', name: 'Lunar Orbit', short: 'Lunar', bodyId: 'moon', targets: ['moon'], kind: 'circular',
    periRange: [30, 500], defaultPeri: 100, defaultApo: 100, incRange: [0, 90], defaultInc: 90,
    launchClass: 'tli', vInfMps: 800, insertionType: 'impulsive', radiation: 1.2,
    summary: 'Circular orbit around the Moon. A polar orbit lets the Moon rotate underneath for full coverage.',
    advantages: ['Polar orbit gives global coverage as the Moon turns', 'Short comm delay (1.3 s)', 'Eclipse ~ 40% but predictable'],
    limitations: ['Mass concentrations make low orbits unstable (station-keeping)', 'Far-side occultation blocks Earth link', 'Capture burn ~0.8 km/s'],
  },
  mars: {
    id: 'mars', name: 'Mars Orbit', short: 'Mars', bodyId: 'mars', targets: ['mars'], kind: 'elliptical',
    periRange: [130, 500], apoRange: [400, 20000], defaultPeri: 200, defaultApo: 6200, incRange: [0, 93], defaultInc: 75,
    launchClass: 'tmi', c3: 10e6, window: { periodD: 780, bestDay: 750, spanC3: 26e6, arrivalGain: 0.28 }, vInfMps: 2700, insertionType: 'impulsive', radiation: 1.0,
    summary: 'Capture into an ellipse: a high apoapsis saves orbit-insertion propellant, a low periapsis samples the atmosphere.',
    advantages: ['Lower apoapsis = smaller capture burn', 'Periapsis dips into upper atmosphere', 'Good global view at apoapsis'],
    limitations: ['Capture burn is 1-2 km/s', 'Light delay 4-24 min', 'Solar conjunction blackout', 'Solar power only ~43% of Earth'],
  },
  'asteroid-orbit': {
    id: 'asteroid-orbit', name: 'Asteroid Proximity Orbit', short: 'Asteroid', bodyId: 'asteroid', targets: ['asteroid'], kind: 'asteroid',
    periRange: [0.6, 6], defaultPeri: 2, defaultApo: 2, incRange: [0, 90], defaultInc: 60,
    launchClass: 'asteroid', c3: 12e6, window: { periodD: 640, bestDay: 760, spanC3: 20e6, arrivalGain: 0.35 }, fixedInsertionDv: 1100, insertionType: 'flexible', radiation: 1.1,
    summary: 'A slow "orbit" only a couple of km from a 500 m asteroid. Gravity is so weak the orbital speed is ~5 cm/s.',
    advantages: ['Tiny orbital speed lets instruments dwell on a target', 'Ion thrusters can do the whole transfer'],
    limitations: ['Rendezvous delta-v ~1.1 km/s', 'Solar radiation pressure perturbs orbit', 'Weak gravity makes navigation delicate'],
  },
  l2: {
    id: 'l2', name: 'Sun-Earth L2 Deep-Space Trajectory', short: 'L2 halo', bodyId: 'sun', targets: ['deepspace'], kind: 'halo',
    periRange: [1500000, 1500000], defaultPeri: 1500000, defaultApo: 1500000, incRange: [0, 0], defaultInc: 0,
    launchClass: 'l2', c3: -0.6e6, fixedInsertionDv: 120, insertionType: 'flexible', radiation: 1.4,
    summary: 'A halo trajectory 1.5 million km behind Earth. Sun, Earth and Moon are all on one side: a cold, stable view of the sky.',
    advantages: ['No eclipses', 'Stable cold thermal environment', 'Constant geometry to Earth', 'Unobstructed sky'],
    limitations: ['Unstable: needs periodic station-keeping', 'No servicing', 'Exposed to galactic cosmic rays'],
  },
};

export const ORBIT_LIST = Object.values(ORBITS);
