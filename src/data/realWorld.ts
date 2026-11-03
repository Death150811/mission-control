// Real-world reference data shown on the "Real data" page. Figures are ROUNDED values from public mission and launch-provider
// documentation; they are here for orientation and comparison with the game's illustrative numbers, not as engineering references.

export interface RealLauncher { id: string; name: string; maker: string; first: number; heightM: number; liftoffT: number; leoKg: number; hiKg?: number; hiLabel?: string; note: string }
export const REAL_LAUNCHERS: RealLauncher[] = [
  { id: 'electron', name: 'Electron', maker: 'Rocket Lab', first: 2017, heightM: 18, liftoffT: 13, leoKg: 300, note: 'Small launcher; carbon-composite structure and electric-pump engines.' },
  { id: 'vega', name: 'Vega', maker: 'ESA / Avio', first: 2012, heightM: 30, liftoffT: 137, leoKg: 1500, note: 'Three solid stages and a liquid upper stage; polar orbits from Kourou.' },
  { id: 'soyuz', name: 'Soyuz-2.1b', maker: 'Russia', first: 2006, heightM: 46, liftoffT: 312, leoKg: 8200, hiKg: 3250, hiLabel: 'GTO', note: 'Descendant of the rocket that launched Sputnik and Gagarin.' },
  { id: 'atlas5', name: 'Atlas V 551', maker: 'ULA', first: 2002, heightM: 58, liftoffT: 590, leoKg: 18850, hiKg: 8900, hiLabel: 'GTO', note: 'The Atlas V family launched Curiosity, MAVEN and OSIRIS-REx.' },
  { id: 'ariane5', name: 'Ariane 5 ECA', maker: 'Arianespace', first: 1996, heightM: 53, liftoffT: 780, leoKg: 20000, hiKg: 10500, hiLabel: 'GTO', note: 'Launched the James Webb Space Telescope in December 2021.' },
  { id: 'falcon9', name: 'Falcon 9 Block 5', maker: 'SpaceX', first: 2010, heightM: 70, liftoffT: 549, leoKg: 22800, hiKg: 8300, hiLabel: 'GTO', note: 'Capacity shown is expendable; booster landing cuts it considerably.' },
  { id: 'shuttle', name: 'Space Shuttle', maker: 'NASA', first: 1981, heightM: 56, liftoffT: 2030, leoKg: 27500, note: 'Reusable orbiter plus two solid boosters; carried Hubble to orbit.' },
  { id: 'delta4h', name: 'Delta IV Heavy', maker: 'ULA', first: 2004, heightM: 72, liftoffT: 733, leoKg: 28790, hiKg: 14220, hiLabel: 'GTO', note: 'Three liquid-hydrogen cores strapped together.' },
  { id: 'fh', name: 'Falcon Heavy', maker: 'SpaceX', first: 2018, heightM: 70, liftoffT: 1421, leoKg: 63800, hiKg: 16800, hiLabel: 'Mars', note: 'Three Falcon 9 cores; the heaviest operational launcher of its time.' },
  { id: 'sls', name: 'SLS Block 1', maker: 'NASA', first: 2022, heightM: 98, liftoffT: 2600, leoKg: 95000, hiKg: 27000, hiLabel: 'TLI', note: 'Two solid boosters and a core with four RS-25 engines; launched Artemis I.' },
  { id: 'saturn5', name: 'Saturn V', maker: 'NASA', first: 1967, heightM: 111, liftoffT: 2970, leoKg: 140000, hiKg: 48600, hiLabel: 'TLI', note: 'Still the most capable rocket flown; sent Apollo to the Moon.' },
];

export interface RealMission { id: string; name: string; year: number; agency: string; target: string; massKg: number; orbit: string; payload: string; cost?: string; analog?: string; lesson: string }
export const REAL_MISSIONS: RealMission[] = [
  { id: 'lro', name: 'Lunar Reconnaissance Orbiter', year: 2009, agency: 'NASA', target: 'Moon', massKg: 1916, orbit: 'About 50 km polar orbit (30 × 180 km later)', payload: 'Narrow-angle cameras at 0.5 m/pixel, LOLA laser altimeter, Diviner thermal radiometer', cost: '≈ $0.5 billion', analog: 'lunar-explorer',
    lesson: 'A polar orbit lets the Moon rotate underneath, so one orbiter eventually images and ranges every longitude.' },
  { id: 'grail', name: 'GRAIL (two spacecraft)', year: 2011, agency: 'NASA', target: 'Moon', massKg: 307, orbit: 'About 55 km, flying in formation', payload: 'Ka-band ranging between the pair; each weighed ~307 kg', cost: '≈ $0.5 billion', analog: 'lunar-explorer',
    lesson: 'The radio link was the instrument: distance changes between the twins mapped lunar gravity.' },
  { id: 'mro', name: 'Mars Reconnaissance Orbiter', year: 2005, agency: 'NASA', target: 'Mars', massKg: 2180, orbit: '255 × 320 km, sun-synchronous', payload: 'HiRISE camera (0.3 m/pixel), CRISM spectrometer, SHARAD radar, 3 m dish', cost: '≈ $0.7 billion', analog: 'mars-atmosphere',
    lesson: 'It spent months aerobraking to shrink its orbit instead of carrying that propellant.' },
  { id: 'maven', name: 'MAVEN', year: 2013, agency: 'NASA', target: 'Mars', massKg: 2454, orbit: '150 × 6,200 km, 75° inclination', payload: 'Mass spectrometer, UV spectrograph, solar-wind and magnetic instruments', cost: '≈ $0.67 billion', analog: 'mars-atmosphere',
    lesson: 'An elliptical orbit that dips into the upper atmosphere samples gas escaping to space.' },
  { id: 'landsat9', name: 'Landsat 9', year: 2021, agency: 'NASA / USGS', target: 'Earth', massKg: 2711, orbit: '705 km sun-synchronous, 10 am descending node', payload: 'OLI-2 multispectral (9 bands, 30 m), TIRS-2 thermal imager', analog: 'earth-observation',
    lesson: 'A fixed local time keeps the lighting the same every pass, so images can be compared over decades.' },
  { id: 'sentinel2', name: 'Sentinel-2A', year: 2015, agency: 'ESA', target: 'Earth', massKg: 1140, orbit: '786 km sun-synchronous, 10:30 am', payload: 'Multispectral instrument: 13 bands, 10 to 60 m pixels, 290 km swath', analog: 'earth-observation',
    lesson: 'A wide swath and two identical satellites cut the revisit time to about five days.' },
  { id: 'osiris', name: 'OSIRIS-REx', year: 2016, agency: 'NASA', target: 'Asteroid Bennu (≈ 490 m)', massKg: 2110, orbit: 'Orbit about 1 km from the centre of Bennu', payload: 'Cameras, laser altimeter, thermal and visible spectrometers, sample collector', cost: '≈ $0.8 billion (excluding the launch)', analog: 'asteroid-rendezvous',
    lesson: 'Gravity at Bennu is so weak that an orbit is walking-pace slow and navigation is by landmarks.' },
  { id: 'dawn', name: 'Dawn', year: 2007, agency: 'NASA', target: 'Vesta and Ceres', massKg: 1218, orbit: 'Orbited Vesta (2011) then Ceres (2015)', payload: 'Framing camera, VIR spectrometer, gamma-ray and neutron detector; ~425 kg of xenon', analog: 'asteroid-rendezvous',
    lesson: 'Ion propulsion made two orbit insertions around different bodies possible with one spacecraft.' },
  { id: 'jwst', name: 'James Webb Space Telescope', year: 2021, agency: 'NASA / ESA / CSA', target: 'Sun-Earth L2', massKg: 6161, orbit: 'Halo orbit about 1.5 million km from Earth', payload: '6.5 m segmented mirror, four infrared instruments, five-layer sunshield', cost: '≈ $10 billion', analog: 'deep-space-observatory',
    lesson: 'The sunshield keeps the optics near 40 K, and L2 keeps Sun, Earth and Moon on one side.' },
  { id: 'hubble', name: 'Hubble Space Telescope', year: 1990, agency: 'NASA / ESA', target: 'Low Earth orbit', massKg: 11110, orbit: '≈ 540 km, 28.5° inclination', payload: '2.4 m mirror with cameras and spectrographs; serviced five times by the Shuttle', analog: 'deep-space-observatory',
    lesson: 'Servicing missions let a 1990 telescope keep up with modern detectors.' },
  { id: 'marco', name: 'MarCO (two cubesats)', year: 2018, agency: 'NASA', target: 'Mars flyby', massKg: 14, orbit: 'Heliocentric transfer; flew past Mars', payload: '6U cubesats with an X-band relay radio; about 13.5 kg each', analog: 'mars-atmosphere',
    lesson: 'Small spacecraft relayed InSight\'s landing in near real time for a tiny fraction of an orbiter\'s cost.' },
];

/* ---- delta-v map (km/s, rounded; the classic "subway map" of the community) ---- */
export interface DvNode { id: string; label: string; x: number; y: number }
export interface DvEdge { from: string; to: string; dv: number; note?: string }
export const DV_NODES: DvNode[] = [
  { id: 'surface', label: 'Earth surface', x: 70, y: 300 },
  { id: 'leo', label: 'Low Earth orbit', x: 210, y: 300 },
  { id: 'gto', label: 'Geo transfer', x: 360, y: 190 },
  { id: 'geo', label: 'Geostationary', x: 520, y: 190 },
  { id: 'l2', label: 'Sun-Earth L2', x: 360, y: 90 },
  { id: 'tli', label: 'Lunar transfer', x: 360, y: 300 },
  { id: 'llo', label: 'Low lunar orbit', x: 530, y: 300 },
  { id: 'moon', label: 'Moon surface', x: 690, y: 300 },
  { id: 'tmi', label: 'Mars transfer', x: 360, y: 410 },
  { id: 'lmo', label: 'Low Mars orbit', x: 560, y: 410 },
  { id: 'mars', label: 'Mars surface', x: 740, y: 410 },
  { id: 'neo', label: 'Near-Earth asteroid', x: 210, y: 478 },
];
export const DV_EDGES: DvEdge[] = [
  { from: 'surface', to: 'leo', dv: 9.4, note: 'includes gravity and drag losses' },
  { from: 'leo', to: 'gto', dv: 2.4 },
  { from: 'gto', to: 'geo', dv: 1.5 },
  { from: 'leo', to: 'l2', dv: 3.4 },
  { from: 'leo', to: 'tli', dv: 3.1 },
  { from: 'tli', to: 'llo', dv: 0.9, note: 'lunar orbit insertion' },
  { from: 'llo', to: 'moon', dv: 1.9, note: 'powered descent' },
  { from: 'leo', to: 'tmi', dv: 3.6 },
  { from: 'tmi', to: 'lmo', dv: 2.1, note: 'about 1 km/s into a high ellipse' },
  { from: 'lmo', to: 'mars', dv: 0.5, note: 'with aerobraking; ≈3.8 km/s propulsive only' },
  { from: 'leo', to: 'neo', dv: 5, note: 'typical accessible asteroid, 4.5 to 6' },
];
export const DV_ROUTES: { id: string; label: string; path: string[]; scenario?: string }[] = [
  { id: 'leo', label: 'Earth orbit (LEO)', path: ['surface', 'leo'], scenario: 'earth-observation' },
  { id: 'geo', label: 'Geostationary', path: ['surface', 'leo', 'gto', 'geo'] },
  { id: 'moon-orbit', label: 'Lunar orbit', path: ['surface', 'leo', 'tli', 'llo'], scenario: 'lunar-explorer' },
  { id: 'moon-land', label: 'Moon landing', path: ['surface', 'leo', 'tli', 'llo', 'moon'] },
  { id: 'mars-orbit', label: 'Mars orbit', path: ['surface', 'leo', 'tmi', 'lmo'], scenario: 'mars-atmosphere' },
  { id: 'mars-land', label: 'Mars landing', path: ['surface', 'leo', 'tmi', 'lmo', 'mars'] },
  { id: 'neo', label: 'Asteroid rendezvous', path: ['surface', 'leo', 'neo'], scenario: 'asteroid-rendezvous' },
  { id: 'l2', label: 'Sun-Earth L2', path: ['surface', 'leo', 'l2'], scenario: 'deep-space-observatory' },
];
export function routeEdges(path: string[]): DvEdge[] {
  const out: DvEdge[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const e = DV_EDGES.find((x) => x.from === path[i] && x.to === path[i + 1]);
    if (e) out.push(e);
  }
  return out;
}
export function routeTotal(path: string[]): number { return routeEdges(path).reduce((s, e) => s + e.dv, 0); }
