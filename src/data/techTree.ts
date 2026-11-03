// Space-programme technology tree. In Programme mode every part outside the starter set must be unlocked with
// Programme Credits, which are earned by flying missions and scored well. Costs are game-balance values.
// `real` names a real-world analogue (rounded, from public mission documentation) to make each node concrete.

export type Branch = 'sensing' | 'power' | 'comms' | 'avionics' | 'thermal' | 'propulsion' | 'structures' | 'launch';
export interface TechNode { id: string; name: string; tier: number; cost: number; requires: string[]; unlocks: string[]; blurb: string; branch: Branch; real: string }

export const BRANCHES: Record<Branch, { label: string; color: string }> = {
  sensing: { label: 'Science instruments', color: 'var(--br-sensing)' },
  power: { label: 'Power', color: 'var(--br-power)' },
  comms: { label: 'Communications', color: 'var(--br-comms)' },
  avionics: { label: 'Avionics and pointing', color: 'var(--br-avionics)' },
  thermal: { label: 'Thermal', color: 'var(--br-thermal)' },
  propulsion: { label: 'Propulsion', color: 'var(--br-propulsion)' },
  structures: { label: 'Structures', color: 'var(--br-structures)' },
  launch: { label: 'Launch', color: 'var(--br-launch)' },
};

export const STARTER_PARTS: string[] = [
  'frame-s', 'frame-m', 'sa-s', 'sa-m', 'bat-s', 'bat-m', 'ant-lga', 'ant-mga', 'tx-5', 'tx-25', 'obc-1', 'obc-2',
  'adcs-basic', 'adcs-sun', 'adcs-wheels', 'th-passive', 'th-ins', 'eng-mono', 'eng-bi', 'tank-s', 'tank-m',
  'optical-cam', 'magnetometer', 'rad-detector', 'thermal-sensor', 'navcam', 'lv-micro', 'lv-small', 'lv-medium',
];

export const TECH_NODES: TechNode[] = [
  // ---- tier 1 ----
  { id: 'multispectral', name: 'Multispectral Imaging', tier: 1, cost: 50, requires: [], unlocks: ['multispectral'], branch: 'sensing',
    blurb: 'Wide-swath imaging in several colour bands: the workhorse of Earth observation.', real: 'Landsat 8 OLI: 9 bands, 30 m pixels, 185 km swath.' },
  { id: 'spectroscopy', name: 'Infrared and UV Spectroscopy', tier: 1, cost: 60, requires: [], unlocks: ['ir-spec', 'uv-spec'], branch: 'sensing',
    blurb: 'Identify minerals, ices and gases from their spectral fingerprints.', real: 'Moon Mineralogy Mapper on Chandrayaan-1 found water-related absorption on the Moon.' },
  { id: 'altimetry', name: 'Radar and Laser Altimetry', tier: 1, cost: 60, requires: [], unlocks: ['radar-alt', 'laser-alt'], branch: 'sensing',
    blurb: 'Measure topography and subsurface layers.', real: 'LOLA on Lunar Reconnaissance Orbiter fired 5 laser pulses at once to map the Moon in 3-D.' },
  { id: 'atmosphere', name: 'Atmosphere and Particles', tier: 1, cost: 60, requires: [], unlocks: ['atmo-sensor', 'particle-analyzer'], branch: 'sensing',
    blurb: 'Limb sounding and in-situ mass spectrometry.', real: 'MAVEN flies through the upper atmosphere of Mars to measure how gas escapes.' },
  { id: 'radiosci', name: 'Radio Science', tier: 1, cost: 40, requires: [], unlocks: ['radio-sci', 'ant-horn'], branch: 'sensing',
    blurb: 'Use the radio link itself to weigh a world, and a cheap horn antenna for near-Earth passes.', real: 'GRAIL: two spacecraft measured the Moon\'s gravity from the distance between them.' },
  { id: 'microsat', name: 'Small-Satellite Kit', tier: 1, cost: 40, requires: [], unlocks: ['frame-xs', 'sa-xs', 'bat-xs', 'tx-2', 'obc-0', 'eng-cold', 'tank-xs', 'micro-cam', 'adcs-lite'], branch: 'structures',
    blurb: 'A cubesat-class bus with matching panels, battery, radio, computer, camera and cold-gas thrusters.', real: 'MarCO (two 6U cubesats) relayed InSight\'s landing from Mars in 2018.' },
  { id: 'power2', name: 'High-Power Arrays', tier: 1, cost: 60, requires: [], unlocks: ['sa-l', 'bat-l'], branch: 'power',
    blurb: 'Large deployable wings and big batteries for far-from-the-Sun missions.', real: 'Juno\'s three wings (about 60 m²) give ~14 kW near Earth but only ~500 W at Jupiter.' },
  { id: 'comms2', name: 'Deep-Space Communications', tier: 1, cost: 70, requires: [], unlocks: ['ant-hga', 'tx-80'], branch: 'comms',
    blurb: 'A 1.8 m dish and an 80 W amplifier make Mars distance workable.', real: 'Mars Reconnaissance Orbiter: 3 m dish, up to ~6 Mbps from Mars.' },
  { id: 'avionics2', name: 'Advanced Avionics and Star Tracking', tier: 1, cost: 70, requires: [], unlocks: ['obc-3', 'adcs-star'], branch: 'avionics',
    blurb: 'Big processing and 0.02° pointing.', real: 'The RAD750 processor flew on Curiosity and the James Webb Space Telescope.' },
  { id: 'thermal2', name: 'Active Thermal Management', tier: 1, cost: 60, requires: [], unlocks: ['th-active'], branch: 'thermal',
    blurb: 'Pumped fluid loops for kilowatt-class heat rejection and precise temperatures.', real: 'Curiosity circulates a fluid loop to move heat from its radioisotope generator around the rover.' },
  { id: 'propulsion2', name: 'Heavy Chemical Propulsion', tier: 1, cost: 80, requires: [], unlocks: ['eng-bi-h', 'tank-l'], branch: 'propulsion',
    blurb: 'A 1,100 N engine and 700 kg tanks for heavy capture burns.', real: 'Cassini\'s 445 N main engine fired for 96 minutes to enter Saturn orbit.' },
  { id: 'greenprop', name: 'Green Propellants', tier: 1, cost: 50, requires: [], unlocks: ['eng-green'], branch: 'propulsion',
    blurb: 'Low-toxicity monopropellant: easier ground handling and slightly better Isp than hydrazine.', real: 'NASA\'s Green Propellant Infusion Mission flew AF-M315E in 2019.' },
  // ---- tier 2 ----
  { id: 'structures2', name: 'Heavy Bus Structure', tier: 2, cost: 70, requires: ['power2'], unlocks: ['frame-l'], branch: 'structures',
    blurb: 'A large frame: six bays, four tank mounts.', real: 'Large observatories such as JWST (about 6.2 t at launch) need purpose-built structures.' },
  { id: 'electric', name: 'Electric Propulsion', tier: 2, cost: 100, requires: ['power2', 'propulsion2'], unlocks: ['eng-ion'], branch: 'propulsion',
    blurb: 'Xenon ion thrusters: ten times the efficiency, a hundredth of the thrust.', real: 'Dawn used ion engines (Isp ~3,100 s, ~90 mN) to orbit both Vesta and Ceres.' },
  { id: 'hall', name: 'Hall-Effect Thrusters', tier: 2, cost: 90, requires: ['power2', 'greenprop'], unlocks: ['eng-hall'], branch: 'propulsion',
    blurb: 'More thrust per kilowatt than ion engines: great for raising orbits.', real: 'ESA\'s SMART-1 spiralled from Earth orbit to the Moon on a Hall thruster.' },
  { id: 'hyperspectral', name: 'Hyperspectral Imaging', tier: 2, cost: 90, requires: ['multispectral', 'avionics2'], unlocks: ['hyperspectral'], branch: 'sensing',
    blurb: 'A full spectrum for every pixel, and a huge data stream.', real: 'EO-1\'s Hyperion recorded 220 spectral bands.' },
  { id: 'radar2', name: 'Synthetic Aperture Radar', tier: 2, cost: 100, requires: ['altimetry', 'power2'], unlocks: ['sar'], branch: 'sensing',
    blurb: 'Radar images through clouds and at night: heavy, hungry and data-rich.', real: 'Sentinel-1 (C-band SAR) maps a 250 km swath in its main mode.' },
  { id: 'nuclear-spec', name: 'Gamma-Ray and X-ray Spectroscopy', tier: 2, cost: 70, requires: ['spectroscopy'], unlocks: ['gamma-spec', 'xray-spec'], branch: 'sensing',
    blurb: 'Read elements straight from the surface.', real: 'Mars Odyssey\'s gamma-ray spectrometer found hydrogen-rich ground near both poles.' },
  { id: 'plasma-dust', name: 'Plasma and Dust Science', tier: 2, cost: 60, requires: ['atmosphere'], unlocks: ['plasma', 'dust-analyzer'], branch: 'sensing',
    blurb: 'Charged particles and tiny grains tell the story of a world\'s environment.', real: 'Cassini\'s dust analyser sampled grains from Saturn\'s rings and the plumes of Enceladus.' },
  { id: 'sounding', name: 'Atmospheric Sounding', tier: 2, cost: 70, requires: ['atmosphere'], unlocks: ['mw-radiometer', 'lidar-atm'], branch: 'sensing',
    blurb: 'Microwave and laser profiles of temperature, vapour and aerosols.', real: 'CALIPSO\'s lidar profiled clouds and aerosols for 17 years.' },
  { id: 'ka-comms', name: 'Ka-band Communications', tier: 2, cost: 90, requires: ['comms2'], unlocks: ['ant-ka', 'tx-150'], branch: 'comms',
    blurb: 'Four times the frequency: a much tighter beam and far more data.', real: 'Juno\'s gravity science used a Ka-band link for the tightest radio measurements at Jupiter.' },
  { id: 'rad-hard', name: 'Radiation-Hardened Electronics', tier: 2, cost: 80, requires: ['avionics2'], unlocks: ['obc-rh'], branch: 'avionics',
    blurb: 'Slow, expensive computers that shrug off particle strikes.', real: 'RAD750 is rated for roughly 200 to 1,000 krad of total dose.' },
  { id: 'gyros', name: 'Control Moment Gyros', tier: 2, cost: 80, requires: ['avionics2'], unlocks: ['adcs-cmg'], branch: 'avionics',
    blurb: 'Fast, precise slews for big spacecraft.', real: 'The International Space Station steers with four control moment gyros.' },
  { id: 'heatpipes', name: 'Heat Pipes and Cryocoolers', tier: 2, cost: 70, requires: ['thermal2'], unlocks: ['th-heatpipe', 'th-cryo'], branch: 'thermal',
    blurb: 'Move heat without pumps, or cool detectors to a few tens of kelvin.', real: 'JWST\'s MIRI instrument is cooled to about 7 K by a mechanical cooler.' },
  { id: 'heavylift', name: 'Heavy Lift Launcher', tier: 2, cost: 90, requires: ['propulsion2'], unlocks: ['lv-heavy'], branch: 'launch',
    blurb: 'The Titan-H class: tens of tonnes to the Moon.', real: 'Falcon Heavy lifts about 64 t to low Earth orbit when expended.' },
  { id: 'vab', name: 'Vehicle Assembly Hall', tier: 2, cost: 60, requires: ['propulsion2'], unlocks: ['lv-custom'], branch: 'launch',
    blurb: 'Build your own stack from catalogue stages and strap-on boosters.', real: 'The Vehicle Assembly Building at Kennedy Space Center is about 160 m tall.' },
  // ---- tier 3 (and 4 for nodes that depend on tier-3 technologies) ----
  { id: 'precision', name: 'Observatory-Class Pointing', tier: 3, cost: 110, requires: ['avionics2', 'thermal2'], unlocks: ['adcs-adv', 'telescope'], branch: 'avionics',
    blurb: '0.003° fine pointing and the 0.6 m space telescope payload.', real: 'Hubble holds a target steady to about 0.007 arcseconds.' },
  { id: 'ultraflex', name: 'Ultra-Flex Arrays', tier: 3, cost: 110, requires: ['power2', 'structures2'], unlocks: ['sa-xl', 'bat-xl'], branch: 'power',
    blurb: 'Fan-fold circular wings and a huge battery: kilowatts for ion engines and observatories.', real: 'UltraFlex wings powered the Phoenix and InSight Mars landers.' },
  { id: 'megabus', name: 'Super-Heavy Bus', tier: 3, cost: 100, requires: ['structures2'], unlocks: ['frame-xl', 'tank-xl'], branch: 'structures',
    blurb: 'Eight instrument bays and tanks for four tonnes of propellant.', real: 'Cassini launched with about 3 t of propellant out of a 5.7 t spacecraft.' },
  { id: 'ion2', name: 'High-Power Ion Propulsion', tier: 4, cost: 120, requires: ['electric', 'ultraflex'], unlocks: ['eng-ion-hp'], branch: 'propulsion',
    blurb: 'Three and a half kilowatts of xenon thrust for the longest journeys.', real: 'NASA\'s NEXT thruster was tested at about 7 kW, 236 mN and Isp ~4,100 s.' },
  { id: 'irtelescope', name: 'Cooled Infrared Observatory', tier: 4, cost: 130, requires: ['precision', 'heatpipes', 'megabus'], unlocks: ['ir-telescope'], branch: 'sensing',
    blurb: 'A cryogenic 0.85 m telescope for the deep-space observatory mission.', real: 'Spitzer (0.85 m, cooled) observed the infrared sky from 2003 to 2020.' },
];

export const TECH_MAP: Record<string, TechNode> = Object.fromEntries(TECH_NODES.map((n) => [n.id, n]));

export function unlockedPartSet(nodes: string[]): Set<string> {
  const s = new Set<string>(STARTER_PARTS);
  for (const id of nodes) for (const p of TECH_MAP[id]?.unlocks ?? []) s.add(p);
  return s;
}
export function nodeForPart(partId: string): TechNode | undefined {
  return TECH_NODES.find((n) => n.unlocks.includes(partId));
}
export function canUnlock(node: TechNode, nodes: string[], credits: number): { ok: boolean; why: string } {
  if (nodes.includes(node.id)) return { ok: false, why: 'Already unlocked' };
  const missing = node.requires.filter((r) => !nodes.includes(r));
  if (missing.length) return { ok: false, why: `Requires: ${missing.map((m) => TECH_MAP[m].name).join(', ')}` };
  if (credits < node.cost) return { ok: false, why: `Needs ${node.cost - credits} more credits` };
  return { ok: true, why: '' };
}
/** Every prerequisite (transitively) of a node, nearest first. */
export function prerequisitesOf(id: string, seen = new Set<string>()): string[] {
  const out: string[] = [];
  for (const r of TECH_MAP[id]?.requires ?? []) if (!seen.has(r)) { seen.add(r); out.push(r, ...prerequisitesOf(r, seen)); }
  return out;
}
/** Nodes that directly depend on this one. */
export function dependentsOf(id: string): string[] {
  return TECH_NODES.filter((n) => n.requires.includes(id)).map((n) => n.id);
}
/** Programme credits earned for a finished mission. */
export function creditsFor(score: number, previousBest: number): number {
  const base = Math.round(score / 8);
  const first = previousBest <= 0 && score >= 450 ? 40 : 0;
  const improvement = score > previousBest && previousBest > 0 ? Math.round((score - previousBest) / 10) : 0;
  return base + first + improvement;
}
