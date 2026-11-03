// Scientific findings the simulation can "make" once enough real, downlinked data of the right kind has arrived.
export interface Discovery { id: string; domains: string[]; points: number; title: string; text: string }

const D: Record<string, Discovery[]> = {
  moon: [
    { id: 'm-img', domains: ['imaging'], points: 30, title: 'Three safe landing ellipses identified', text: 'High-resolution mosaics show boulder-poor plains near the south pole, within 15 km of sunlit ridges.' },
    { id: 'm-ice', domains: ['spectroscopy'], points: 20, title: 'Water-ice signature in permanently shadowed craters', text: 'Infrared absorption near 3 µm in crater floors that have not seen sunlight for billions of years.' },
    { id: 'm-pyx', domains: ['spectroscopy'], points: 70, title: 'Mantle-derived olivine exposed in a basin wall', text: 'A direct sample of the deep Moon, uncovered by an ancient impact.' },
    { id: 'm-topo', domains: ['altimetry'], points: 15, title: 'Collapsed lava tube candidate', text: 'A 4 km-wide, 120 m-deep pit with an overhanging rim: a possible shelter for future crews.' },
    { id: 'm-mag', domains: ['fields', 'radiation'], points: 5, title: 'Crustal magnetic anomaly shields the surface', text: 'A patch of strong remnant magnetism deflects solar-wind particles and forms a bright swirl.' },
  ],
  mars: [
    { id: 'r-dust', domains: ['atmosphere'], points: 30, title: 'Dust-storm onset tracked from orbit', text: 'Atmospheric opacity rose tenfold in nine sols, lofting dust and water vapour to 60 km.' },
    { id: 'r-ch4', domains: ['atmosphere', 'spectroscopy'], points: 90, title: 'Seasonal trace-gas variation', text: 'Methane-like absorption features appear and vanish with the seasons: a puzzle for chemistry and geology.' },
    { id: 'r-esc', domains: ['particles', 'fields', 'radiation'], points: 25, title: 'Atmospheric escape measured', text: 'Oxygen ions stream away along the solar-wind electric field at a rate that rises during solar storms.' },
    { id: 'r-topo', domains: ['altimetry'], points: 20, title: 'Subsurface layering mapped', text: 'Radar echoes reveal ice-rich layers under the northern plains.' },
  ],
  earth: [
    { id: 'e-aer', domains: ['atmosphere'], points: 15, title: 'Regional aerosol plume tracked', text: 'A smoke plume crossed an ocean basin in six days; the instrument recovered its height and composition.' },
    { id: 'e-veg', domains: ['multispectral'], points: 40, title: 'Deforestation front detected within a week', text: 'Repeated multispectral passes expose new clearings along a road, faster than ground reports.' },
    { id: 'e-thm', domains: ['thermal'], points: 12, title: 'Urban heat islands and active fires mapped', text: 'Night-time thermal images show city cores 6 K warmer than their surroundings.' },
    { id: 'e-hyp', domains: ['hyperspectral'], points: 30, title: 'Coral bleaching and crop stress separated', text: 'Hundreds of narrow bands distinguish healthy chlorophyll from stress signatures invisible to colour cameras.' },
    { id: 'e-alt', domains: ['altimetry'], points: 20, title: 'Ice-sheet thinning rate measured', text: 'Centimetre-level elevation change over a glacier basin across one year.' },
  ],
  asteroid: [
    { id: 'a-shape', domains: ['imaging'], points: 25, title: 'Shape model: spinning-top rock with an equatorial ridge', text: 'The 500 m body rotates every 4.3 h; centrifugal force shaped its equator.' },
    { id: 'a-hyd', domains: ['spectroscopy'], points: 25, title: 'Hydrated minerals and organics detected', text: 'Absorption bands consistent with clays and carbon-rich material: primitive Solar System ingredients.' },
    { id: 'a-dust', domains: ['particles', 'fields'], points: 10, title: 'Particle ejection event recorded', text: 'Small grains left the surface at several m/s, probably lifted by thermal fracturing.' },
    { id: 'a-topo', domains: ['altimetry'], points: 25, title: 'Gravity field and density derived', text: 'Laser ranging and orbital motion give a bulk density of 1.2 g/cm³: a loose rubble pile.' },
    { id: 'a-th', domains: ['thermal'], points: 8, title: 'Low thermal inertia', text: 'The surface cools quickly after sunset: loose, fine regolith between boulders.' },
  ],
  deepspace: [
    { id: 'd-deep', domains: ['observatory'], points: 70, title: 'Cluster lensing reveals distant galaxies', text: 'A foreground galaxy cluster bends light, magnifying galaxies seen only 600 million years after the Big Bang.' },
    { id: 'd-exo', domains: ['observatory'], points: 140, title: 'Transiting planet atmosphere resolved', text: 'Starlight filtered through a planet atmosphere shows water vapour in the transmission spectrum.' },
    { id: 'd-spec', domains: ['spectroscopy'], points: 20, title: 'Hot gas absorption lines measured', text: 'Ultraviolet lines trace gas flowing out of a young star.' },
    { id: 'd-cr', domains: ['radiation', 'particles'], points: 6, title: 'Cosmic-ray flux versus solar cycle', text: 'The L2 environment shows galactic cosmic rays dipping as solar activity rises.' },
    { id: 'd-field', domains: ['observatory'], points: 260, title: 'Ultra-deep field completed', text: 'A 300-hour stare shows thousands of galaxies in a patch of sky the size of a grain of sand.' },
  ],
};
export function discoveriesFor(target: string): Discovery[] { return D[target] ?? []; }
