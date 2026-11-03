// Rule-based engineering validation. Every rule reads real simulation parameters from the Analysis object.
// Each issue explains: what is wrong, why it matters, which system, what could happen, and at least one fix.

import { LAUNCH_VEHICLES, vehicleCostM } from '../data/launchVehicles';
import type { Issue, Severity } from '../types';
import { DIFFICULTY } from './difficulty';
import { payloadCapacityKg } from './launch';
import type { Analysis } from './resourceManager';

const f0 = (x: number) => Math.round(x).toLocaleString('en-US');
const f1 = (x: number) => x.toFixed(1);

export function validateDesign(a: Analysis): Issue[] {
  const out: Issue[] = [];
  const rules = DIFFICULTY[a.difficulty];
  const scn = a.scenario;
  const add = (id: string, severity: Severity, title: string, system: string, what: string, why: string, consequence: string, solutions: string[], blocksLaunch = false) =>
    out.push({ id, severity, title, system, what, why, consequence, solutions, blocksLaunch });
  const p = a.parts;

  // ---------- mandatory subsystems ----------
  const missing: [boolean, string, string][] = [
    [!p.computer, 'onboard computer', 'It runs flight software, fault protection and data handling.'],
    [!p.adcs, 'attitude control system', 'Without it the spacecraft tumbles and cannot point antennas, arrays or instruments.'],
    [!p.transmitter, 'transmitter', 'It generates the radio signal that carries science data to Earth.'],
    [!p.antenna, 'antenna', 'It focuses the radio signal toward Earth; without it there is no link.'],
    [!p.thermal, 'thermal control', 'Electronics fail outside their temperature range.'],
    [p.batteries.length === 0, 'battery', 'Solar arrays produce nothing in eclipse and during peaks; the battery carries the bus.'],
    [p.solar.length === 0, 'solar array', 'No generation means the battery drains and the spacecraft dies within hours.'],
    [p.instruments.length === 0, 'science instrument', 'The mission has nothing to measure.'],
  ];
  for (const [bad, name, why] of missing) {
    if (bad) add(`missing-${name}`, 'CRITICAL', `Missing ${name}`, 'Spacecraft architecture', `No ${name} is installed.`, why,
      'The mission cannot launch: this subsystem is mandatory.', [`Open the Spacecraft Workshop and drag a ${name} into a free slot.`], true);
  }
  if (a.orbit.def.insertionType !== 'none' && !p.engine) {
    add('missing-engine', 'CRITICAL', 'No main engine', 'Propulsion', `The ${a.orbit.def.short} destination needs ${f0(a.orbit.insertionDvMps)} m/s of insertion delta-v but there is no engine.`,
      'The launcher drops the spacecraft on a trajectory; only your engine can capture it into orbit.', 'The spacecraft flies past its target.', ['Mount an engine in the aft slot and add tanks.'], true);
  }

  // ---------- mass, launch, structure ----------
  if (a.mass.total > scn.maxMassKg) add('mass-limit', 'CRITICAL', 'Spacecraft exceeds mission mass limit', 'Mass budget',
    `Launch mass is ${f0(a.mass.total)} kg; the scenario limit is ${f0(scn.maxMassKg)} kg.`, 'Mass drives launcher size and cost; the programme cannot approve a heavier spacecraft.', 'The design is rejected at the review gate.',
    ['Remove or downsize instruments, tanks or solar wings.', 'Use a higher-Isp engine so less propellant is needed.'], true);
  if (!a.launch.classOk) add('launch-class', 'CRITICAL', `${a.vehicle.name} cannot reach ${a.orbit.def.short}`, 'Launch vehicle',
    `${a.vehicle.name} is only certified for: ${a.vehicle.classes.join(', ')}.`, 'Different destinations need a restartable upper stage and enough energy for the injection burn.', 'Launch cannot be attempted.',
    ['Select a medium or heavy launch vehicle in the Launch Center.'], true);
  else if (a.launch.capacityKg < a.mass.total) add('launch-capacity', 'CRITICAL', 'Mass exceeds launch capacity', 'Launch vehicle',
    `${a.vehicle.name} can deliver ${f0(a.launch.capacityKg)} kg to ${a.orbit.def.short}, but the spacecraft weighs ${f0(a.mass.total)} kg.`,
    'Payload capacity falls steeply with destination energy: the rocket equation gives less mass to the Moon than to LEO.', 'The vehicle cannot reach the required velocity; the spacecraft is lost.',
    ['Choose a bigger launch vehicle.', `Cut ${f0(a.mass.total - a.launch.capacityKg)} kg: smaller tanks, fewer instruments, a lighter bus.`, 'Choose a lower-energy orbit.'], true);
  else if (a.launch.marginKg / Math.max(a.launch.capacityKg, 1) < rules.designMargin * 0.5) add('launch-margin', 'WARNING', 'Thin launch mass margin', 'Launch vehicle',
    `Only ${f0(a.launch.marginKg)} kg (${f1((a.launch.marginKg / a.launch.capacityKg) * 100)}%) of capacity remains.`, 'Mass grows during development; a margin absorbs it.', 'A late mass increase would cancel the launch.',
    ['Keep at least 10% launch margin.']);
  if (a.mass.supported > (a.frame?.maxSupportedKg ?? 0)) add('frame-load', 'CRITICAL', 'Frame overloaded', 'Structure',
    `The ${a.frame?.name} supports ${f0(a.frame?.maxSupportedKg ?? 0)} kg of equipment; you load it with ${f0(a.mass.supported)} kg.`, 'Primary structure is sized for a maximum load.', 'The frame buckles under launch acceleration.',
    ['Upgrade to a larger frame.', 'Reduce propellant or equipment mass.'], true);
  if (!a.launch.fitsWidth || !a.launch.fitsHeight) add('fairing', 'CRITICAL', 'Does not fit inside the fairing', 'Launch integration',
    `Stowed envelope is ${f1(a.geometry.widthM)} m wide x ${f1(a.geometry.heightM)} m tall; the ${a.vehicle.name} fairing allows ${f1(a.vehicle.fairingDiameterM * 0.95)} m x ${f1(a.vehicle.fairingLengthM)} m.`,
    'The payload must fit inside the nose cone with clearance for vibration.', 'The spacecraft cannot be integrated.',
    ['Pick a launch vehicle with a bigger fairing.', 'Use a smaller antenna dish or a smaller frame.'], true);
  const lat = Math.abs(a.geometry.comLatM);
  if (lat > 0.15) add('com-lat', 'CRITICAL', 'Centre of mass far off-axis', 'Structure', `Lateral CoM offset ${f1(lat * 100)} cm exceeds 15 cm.`, 'An off-axis payload loads the launcher adapter unevenly and induces tumbling.', 'Structural failure on ascent.', ['Mirror heavy equipment on the opposite side.'], true);
  else if (lat > 0.06) add('com-lat-w', 'WARNING', 'Centre of mass offset', 'Structure', `Lateral CoM offset ${f1(lat * 100)} cm.`, 'It requires counter-torque from the attitude system.', 'Extra wheel momentum use and reduced pointing stability.', ['Balance instruments left and right; keep tank sizes symmetric.']);
  if (a.geometry.comHeightM > a.vehicle.maxComHeightM) add('com-height', 'CRITICAL', 'Centre of mass too high', 'Launch integration',
    `CoM is ${f1(a.geometry.comHeightM)} m above the separation plane; ${a.vehicle.name} allows ${f1(a.vehicle.maxComHeightM)} m.`, 'A tall payload overloads the adapter in lateral launch loads.', 'Adapter failure.', ['Use a launcher with a higher limit.', 'Use a smaller frame.'], true);
  if (a.frame && a.vehicle.maxG > a.frame.maxAccelG) add('frame-g', 'WARNING', 'Frame g-load rating below vehicle peak acceleration', 'Structure',
    `${a.frame.name} is rated ${a.frame.maxAccelG} g; ${a.vehicle.name} can reach about ${a.vehicle.maxG} g.`, 'Acceleration peaks just before engine cutoff.', 'You must throttle down late in ascent, losing performance (and in manual flight, risk overload).',
    ['Choose a more rugged frame.', 'Plan to throttle the upper stage.']);

  // ---------- orbit and objectives ----------
  if (!scn.allowedOrbitIds.includes(a.orbit.def.id) && !scn.sandbox) add('orbit-wrong', 'CRITICAL', 'Wrong orbit type for this mission', 'Orbit', `${a.orbit.def.name} is not suitable for "${scn.name}".`, 'The target body and science geometry demand a specific orbit family.', 'Mission objectives cannot be met.', [`Select one of: ${scn.allowedOrbitIds.join(', ')}.`], true);
  for (const o of [...scn.objectives, ...scn.bonus]) {
    if (o.type === 'coverage') {
      const acc = a.science.coverageFractionMax;
      if (acc < o.requiredFraction) add(`cov-${o.id}`, o.mandatory ? 'CRITICAL' : 'WARNING', 'Orbit inclination cannot cover required area', 'Orbit',
        `At ${f0(a.orbit.incDeg)} deg inclination the satellite never sees more than ${f0(acc * 100)}% of the surface; "${o.title}" needs ${f0(o.requiredFraction * 100)}%.`,
        'A satellite can only observe latitudes up to about its inclination (plus its swath).', 'The objective cannot be completed whatever the instruments do.', ['Increase inclination toward 90 degrees (polar orbit).']);
    }
    if (o.type === 'metric' && o.metric === 'revisitDays' && a.science.revisitDays > o.value) add(`rev-${o.id}`, o.mandatory ? 'CRITICAL' : 'WARNING', 'Revisit time too long', 'Orbit and instruments',
      `Best revisit time is ${isFinite(a.science.revisitDays) ? f1(a.science.revisitDays) : 'infinite'} days; the requirement is ${o.value} days.`, 'Revisit time depends on swath width x ground speed: wide-swath imagers in lower orbits revisit faster.',
      'Monitoring of change is too infrequent.', ['Add a wide-swath imager (multispectral).', 'Raise the altitude a little to widen the swath (resolution drops).']);
    if (o.type === 'metric' && o.metric === 'pointingDeg' && a.science.pointingDeg > o.value) add(`pt-${o.id}`, 'CRITICAL', 'Pointing accuracy below requirement', 'Attitude control',
      `Pointing is ${a.science.pointingDeg} deg; the mission requires ${o.value} deg.`, 'A telescope image smears if the spacecraft wobbles during an exposure.', 'Science images are blurred.', ['Install the Advanced Fine-Pointing System.']);
    if (o.type === 'metric' && o.metric === 'thermalMargin' && a.thermal.metric < o.value - 1e-9) add(`th-${o.id}`, 'CRITICAL', 'Thermal margin below requirement', 'Thermal control',
      `Thermal margin is ${a.thermal.metric.toFixed(2)}; the requirement is ${o.value}.`, 'Stable detector temperatures need both heat rejection and active control.', 'Detector noise grows; observations drift.', ['Use Active Thermal Management.']);
    if (o.type === 'metric' && o.metric === 'navigation' && !a.science.navigation) add(`nav-${o.id}`, 'CRITICAL', 'No optical navigation sensor', 'Navigation',
      'Neither a navigation camera nor a fine star tracker is installed.', 'Radio tracking alone cannot place a spacecraft within metres of a small asteroid.', 'High risk of missing the target during rendezvous.', ['Add the Optical Navigation Camera.']);
    if (o.type === 'science') {
      const matching = a.instruments.filter((i) => i.part.domains.some((d) => o.domains.includes(d)) && i.relevance > 0);
      const potential = matching.reduce((s, i) => s + i.pointsPerDay, 0) * scn.nominalDays;
      if (matching.length === 0) add(`sci-${o.id}`, o.mandatory ? 'CRITICAL' : 'INFO', `No instrument for "${o.title}"`, 'Science payload',
        `The objective needs one of: ${o.domains.join(', ')}.`, 'Objectives are only fulfilled by instruments that measure the right quantity at the target.', 'The objective scores zero.', ['Add a matching instrument in the Instrument Lab.']);
      else if (potential * 0.8 < o.points) add(`sci-low-${o.id}`, o.mandatory ? 'WARNING' : 'INFO', `Science potential too low for "${o.title}"`, 'Science payload',
        `Even at full duty the instruments produce about ${f0(potential)} points during nominal operations; ${o.points} are needed and ~20% is lost to anomalies and downlink.`, 'Science points scale with instrument quality, duty and returned data.', 'The objective will likely fail.', ['Add a second instrument in the same domain or improve pointing/thermal quality.']);
    }
  }
  for (const i of a.instruments) {
    if (i.mismatch) add(`mismatch-${i.slotId}`, 'WARNING', `${i.part.name} is useless at this target`, 'Science payload', `Target "${scn.target}" gives this instrument zero scientific relevance.`, 'Instruments measure physical phenomena that must exist at the target (an atmosphere sensor needs an atmosphere).', 'It adds mass, power, data and cost for no science.', ['Replace it with a relevant instrument.']);
    else {
      if (i.pointingFactor < 0.7) add(`pt-${i.slotId}`, 'WARNING', `${i.part.name}: pointing too coarse`, 'Attitude control', `Needs ${i.part.pointingDeg} deg; the attitude system gives ${a.science.pointingDeg} deg.`, 'Pointing jitter blurs images and smears spectra.', `Science quality drops to ${f0(i.pointingFactor * 100)}%.`, ['Upgrade the attitude control system.']);
      if (i.thermalFactor < 0.85) add(`th-${i.slotId}`, 'WARNING', `${i.part.name}: unstable temperature`, 'Thermal control', `The instrument needs thermal stability ${i.part.thermal}; the thermal system provides ${a.thermal.stability}.`, 'Detectors drift with temperature.', `Quality drops to ${f0(i.thermalFactor * 100)}%.`, ['Select enhanced insulation or active thermal management.']);
      if (i.rangeFactor < 0.6) add(`rng-${i.slotId}`, 'WARNING', `${i.part.name} is too far from the surface`, 'Orbit', `Useful range is ${i.part.rangeKm} km; the orbit averages ${f0(a.orbit.effectiveAltM / 1000)} km.`, 'Active sensors lose signal with the inverse square of distance.', `Quality drops to ${f0(i.rangeFactor * 100)}%.`, ['Lower the orbit.']);
      if (i.resolutionFactor < 0.7) add(`res-${i.slotId}`, 'WARNING', `${i.part.name}: resolution too coarse`, 'Orbit and instruments', `Ground resolution is ${f1(i.gsdM)} m; the mission asks for ${scn.requiredGsdM} m.`, 'Resolution = altitude x angular pixel size.', `Quality drops to ${f0(i.resolutionFactor * 100)}%.`, ['Choose a lower orbit.']);
    }
  }

  // ---------- propulsion ----------
  if (p.engine) {
    if (a.propulsion.dvAvailable < a.propulsion.dvRequired) add('dv-short', 'CRITICAL', 'Insufficient delta-v', 'Propulsion',
      `The spacecraft can produce ${f0(a.propulsion.dvAvailable)} m/s but needs ${f0(a.propulsion.dvRequired)} m/s (insertion ${f0(a.propulsion.dvInsertion)} + station-keeping ${f0(a.propulsion.dvStationKeeping)} + margin).`,
      'Delta-v = Isp x g0 x ln(m0/mf): it is limited by propellant fraction and engine efficiency.', 'The spacecraft cannot enter orbit or runs dry mid-mission.',
      ['Add propellant (up to the tank capacity) or a bigger tank.', 'Use a higher-Isp engine.', 'Pick an orbit with a cheaper insertion (e.g. higher Mars apoapsis).'], true);
    else if (a.propulsion.dvMargin < rules.designMargin) add('dv-margin', 'WARNING', 'Thin delta-v margin', 'Propulsion', `Margin is ${f1(a.propulsion.dvMargin * 100)}%; ${rules.label} difficulty asks for ${f0(rules.designMargin * 100)}%.`, 'Navigation corrections and anomalies consume delta-v.', 'Extended operations may be impossible.', ['Load more propellant.']);
    if (a.orbit.def.insertionType === 'impulsive' && a.propulsion.burnTimeS > a.propulsion.burnLimitS) add('burn-time', 'CRITICAL', 'Engine too weak for the capture burn', 'Propulsion',
      `A ${f0(a.propulsion.thrustN)} N engine would need a ${f1(a.propulsion.burnTimeS / 3600)} h burn; the limit is ${f1(a.propulsion.burnLimitS / 3600)} h.`, 'Capture burns must happen near periapsis: thrust spread over hours means the spacecraft has moved away.', 'Capture fails; gravity losses grow.', ['Use a higher-thrust chemical engine.'], true);
    if (p.engine.electric && a.orbit.def.insertionType === 'flexible' && a.propulsion.burnTimeS > a.propulsion.burnLimitS) add('ion-time', 'CRITICAL', 'Ion thruster cannot finish in time', 'Propulsion',
      `Thrusting needs ${f0(a.propulsion.burnTimeS / 86400)} days; only ~${f0(a.propulsion.burnLimitS / 86400)} thrust-days fit in the cruise at the available solar power.`, 'Electric propulsion trades thrust for efficiency, and power limits when it can run.', 'The spacecraft arrives with a delta-v deficit.', ['Add solar arrays for the 1.1 kW thruster.', 'Reduce spacecraft mass.', 'Use a chemical engine.'], true);
    if (a.propulsion.propellantKg === 0 && a.propulsion.dvRequired > 30) add('no-prop', 'CRITICAL', 'Tanks are empty', 'Propulsion', 'The engine has no propellant.', 'Propellant is loaded separately from tank hardware.', 'Same as having no engine.', ['Use the propellant slider in the Workshop.'], true);
  }
  if (a.propulsion.skPerYear > 20 && (!p.engine || a.propulsion.dvStationKeeping > a.propulsion.dvAvailable - a.propulsion.dvInsertion)) add('sk-drag', 'WARNING', 'Orbit will not be maintained', 'Orbit', `Drag / perturbation station-keeping needs about ${f0(a.propulsion.skPerYear)} m/s per year at this altitude and spacecraft mass-to-area ratio.`, 'Atmospheric drag or perturbations steadily change a low orbit.', 'The orbit decays and the mission ends early.', ['Raise the orbit or carry propellant for reboosts.']);

  // ---------- power ----------
  if (a.power.orbitMarginPct < 0) add('power-neg', 'CRITICAL', 'Insufficient power', 'Power subsystem', `Orbit-average energy balance is ${f1(a.power.orbitMarginPct)}% at end of life (generation ${f0(a.power.genEolW)} W vs average load ${f0(a.power.avgLoadW)} W).`,
    'Energy generated per orbit must exceed energy consumed or the battery drains.', 'Instruments are shed and eventually the spacecraft browns out.', ['Add or enlarge solar wings.', 'Remove power-hungry instruments or lower their duty.']);
  else if (a.power.orbitMarginPct < rules.designMargin * 100) add('power-thin', 'WARNING', 'Thin power margin', 'Power subsystem', `Margin is ${f1(a.power.orbitMarginPct)}%; ${f0(rules.designMargin * 100)}% is recommended.`, 'Panels degrade each year and anomalies draw extra power.', 'Instrument duty will be curtailed.', ['Add solar area.']);
  if (a.power.marginPct < 0) add('power-peak', 'WARNING', 'Peak demand exceeds generation + battery discharge', 'Power subsystem', `Peak load ${f0(a.power.peakLoadW)} W vs available ${f0(a.power.availableW)} W (power margin ${f1(a.power.marginPct)}%).`, 'Available power = generated power + battery discharge; all instruments plus transmitter at once is the peak case.', 'The bus can brown out during simultaneous operation.', ['Stagger instrument operation, or add batteries and arrays.']);
  if (isFinite(a.power.eclipseCoverage) && a.power.eclipseCoverage < 1) add('battery-ecl', a.power.eclipseCoverage < 0.6 ? 'CRITICAL' : 'WARNING', 'Battery cannot cover eclipse', 'Power subsystem',
    `Each eclipse (${f1(a.orbit.eclipseS / 60)} min) needs ${f0(a.power.eclipseEnergyWh)} Wh; the battery offers ${f0(a.power.usableWh)} Wh usable at ${f0(a.power.dod * 100)}% depth of discharge.`, 'Battery capacity is energy (Wh), not power (W); depth of discharge is limited to protect cycle life.', 'The spacecraft browns out every orbit; instruments shut down.', ['Add batteries (internal bays permitting).', 'Reduce eclipse-time loads.']);
  if (a.power.orbitMarginPct > 250 && p.solar.length > 0) add('power-over', 'INFO', 'Solar arrays are oversized', 'Power subsystem', `Margin is ${f0(a.power.orbitMarginPct)}%.`, 'Every extra square metre of array costs mass and money.', 'You pay for power you do not use.', ['Choose smaller wings to save mass and budget.']);

  // ---------- thermal ----------
  if (p.thermal) {
    if (a.thermal.ratio < 1) add('therm-heat', 'CRITICAL', 'Insufficient heat rejection', 'Thermal control', `The spacecraft dissipates ${f0(a.thermal.dissipationW)} W (hot case needs ${f0(a.thermal.requiredW)} W of rejection); the thermal system rejects ${f0(p.thermal.heatRejectionW)} W.`, 'All electrical power ends up as heat that must be radiated to space.', 'Electronics overheat and fail.', ['Choose enhanced or active thermal control.']);
    else if (a.thermal.ratio < 1.25) add('therm-thin', 'WARNING', 'Thin thermal margin', 'Thermal control', `Heat rejection ratio is ${a.thermal.ratio.toFixed(2)}.`, 'Anomalies add heat load.', 'Higher probability of thermal anomalies.', ['Upgrade thermal control.']);
  }

  // ---------- attitude + communications ----------
  if (p.adcs?.earthOnly && a.orbit.def.bodyId !== 'earth') add('adcs-earth', 'CRITICAL', 'Magnetorquer attitude control does not work here', 'Attitude control', 'Basic stabilization pushes against Earth\'s magnetic field.', 'Mars, the Moon and deep space have no useful magnetic field for this method.', 'Pointing falls to ~5 degrees: antennas and instruments are useless.', ['Choose a reaction-wheel based system.']);
  if (p.antenna && p.transmitter) {
    if (a.comms.pointingLossDb > 3) add('point-loss', a.comms.pointingLossDb > 10 ? 'CRITICAL' : 'WARNING', 'Antenna pointing loss', 'Communications', `Beamwidth is ${f1(a.comms.beamwidthDeg)} deg but pointing error is ${a.comms.pointingDeg} deg: ${f1(a.comms.pointingLossDb)} dB lost.`, 'High-gain antennas have narrow beams; loss = 12 (error / beamwidth)^2 dB.', 'The link rate collapses.', ['Better attitude control or a lower-gain antenna.']);
    const need = a.data.compressedMBd;
    if (need > 0) {
      if (a.comms.capacityMeanMB < need * 0.5) add('link-cap', 'CRITICAL', 'Inadequate communication capacity', 'Communications', `Average downlink is ${f0(a.comms.capacityMeanMB)} MB/day but the instruments generate ${f0(need)} MB/day.`, 'Science that cannot be downlinked has zero value; storage only delays the problem.', 'Storage fills and data is lost.', ['Larger antenna or transmitter, more ground stations, stronger compression, or fewer data-hungry instruments.']);
      else if (a.comms.capacityMeanMB < need) add('link-short', 'WARNING', 'Downlink below data generation', 'Communications', `${f0(a.comms.capacityMeanMB)} MB/day downlink vs ${f0(need)} MB/day generation.`, 'A backlog accumulates continuously.', 'Storage overflows eventually.', ['Improve the link or reduce duty cycles.']);
      else if (a.comms.capacityWorstMB < need) add('link-worst', 'INFO', 'Link is marginal at worst distance', 'Communications', `At greatest range the downlink drops to ${f0(a.comms.capacityWorstMB)} MB/day vs ${f0(need)} MB/day.`, 'Distance changes through the mission (path loss grows with distance squared).', 'A backlog builds during far phases.', ['Ensure storage can buffer several weeks of data.']);
    }
    if (a.data.storageDays < 3 && need > 0) add('storage', a.data.storageDays < 1 ? 'CRITICAL' : 'WARNING', 'Insufficient onboard storage', 'Onboard computer', `Storage holds only ${f1(a.data.storageDays)} days of data (${f0(a.data.storageMB / 1000)} GB).`, 'Between contacts, and during outages, data must be stored.', 'Data is overwritten and lost during any blackout.', ['Select a computer with more storage or increase compression.']);
    if (a.data.processingNeedMBd > a.data.processingCapMBd && a.data.processingCapMBd > 0) add('proc', 'WARNING', 'Onboard processing bottleneck', 'Onboard computer', `Needs ${f0(a.data.processingNeedMBd)} MB/day processing; the computer handles ${f0(a.data.processingCapMBd)}.`, 'Compression and formatting use CPU time.', 'Excess data is dropped.', ['Upgrade the computer or reduce compression.']);
  }

  // ---------- budget, schedule, reliability ----------
  if (a.cost.total > a.cost.budget) add('budget', 'CRITICAL', 'Budget overrun', 'Programme', `Total cost $${f1(a.cost.total)}M (parts $${f1(a.cost.parts)}M + launch $${f1(a.cost.launch)}M + ops $${f1(a.cost.ops)}M + ${f0(rules.contingency * 100)}% reserve $${f1(a.cost.contingency)}M) exceeds the $${f1(a.cost.budget)}M budget.`, 'The programme cannot spend money it does not have.', 'The mission is cancelled.', ['Switch to a cheaper launcher.', 'Remove an instrument or downsize arrays.'], true);
  else if (a.cost.total > a.cost.budget * 0.97) add('budget-thin', 'WARNING', 'Almost no budget left', 'Programme', `Cost is ${f0((a.cost.total / a.cost.budget) * 100)}% of the budget.`, 'Overruns of 5-15% are normal.', 'Little room for schedule slips.', ['Save a few percent.']);
  if (a.schedule.departMonths !== null && a.schedule.departMonths < a.schedule.readyMonths - 0.05) add('window-early', 'CRITICAL', 'Spacecraft not ready for the chosen launch date', 'Programme', `The programme is ready after ${f1(a.schedule.readyMonths)} months (day ${f0(a.schedule.readyMonths * 30.44)}); the chosen launch day is ${f0(a.orbit.departDay ?? 0)} (month ${f1(a.schedule.departMonths)}).`, 'Hardware has to be built, tested and integrated before the rocket can leave the pad.', 'The date is missed and the mission waits for the next window.', ['Move the launch day later in the Launch Center.', 'Book fewer tests or simplify the design.'], true);
  if (a.orbit.def.window && a.orbit.windowQ > 0.35) add('window-poor', a.orbit.windowQ > 0.7 ? 'CRITICAL' : 'WARNING', 'Launching far from the best window', 'Trajectory', `Departure C3 is ${f1(a.orbit.c3Eff / 1e6)} km²/s² against ${f1((a.orbit.def.c3 ?? 0) / 1e6)} km²/s² at the centre of the window.`, 'Off-window dates need a faster transfer: more launcher energy now, a harder capture burn later.', 'Payload capacity falls and the spacecraft needs more propellant on arrival.', ['Choose a date inside the window in the Launch Center.'], a.orbit.windowQ > 0.7);
  if (a.schedule.waitMonths > 3) add('window-wait', 'INFO', 'Long wait for the window', 'Programme', `The spacecraft sits ready for ${f1(a.schedule.waitMonths)} months before the window opens, costing ${f1(a.cost.standby)}M of standby.`, 'A synodic period is long; hardware that is ready early still waits for the planets.', 'Budget is spent on standby instead of science.', ['Use the time for tests that cut anomaly risk.']);
  if (a.schedule.totalMonths > a.schedule.deadline) add('schedule', 'CRITICAL', 'Development takes too long', 'Programme', `Development + integration needs ${f1(a.schedule.totalMonths)} months; the launch deadline is ${a.schedule.deadline} months.`, 'Complex hardware (large optics, ion engines, fine-pointing) takes longer to build and test.', 'The launch window is missed.', ['Use simpler or fewer components.', 'A launcher with a shorter lead time.'], true);
  if (a.reliability.critical < 0.85) add('rel', 'WARNING', 'Low estimated bus reliability', 'Spacecraft architecture', `Probability that all critical subsystems survive the nominal mission is ${f0(a.reliability.critical * 100)}%.`, 'Every extra component multiplies failure risk.', 'Anomalies will be more frequent.', ['Reduce complexity.']);

  // ---------- radiation, lifetime, illumination, redundancy ----------
  const rad = a.radiation;
  if (rad.doseKrad * 2 > rad.tidKrad) add('tid-crit', 'CRITICAL', 'Radiation dose exceeds electronics tolerance', 'Spacecraft architecture',
    `Expected ionising dose is ${f1(rad.doseKrad)} krad behind ${f1(rad.shieldMm)} mm of aluminium; the weakest electronics survive ${f0(rad.tidKrad)} krad, and practice demands a factor-2 margin.`,
    'Total ionising dose slowly degrades transistors until they stop working.', 'Computer and detector failures become likely during the mission.',
    ['Choose the radiation-hardened computer (300 krad; other electronics are limited to ~60 krad).', 'Add aluminium shielding: every ~3.5 mm cuts the dose about tenfold, at a mass cost.', 'Fly a lower-radiation orbit (LEO or SSO instead of MEO / HEO).']);
  else if (rad.doseKrad * 1.3 > rad.tidKrad * 0.5) add('tid-warn', 'WARNING', 'Thin radiation margin', 'Spacecraft architecture', `Dose ${f1(rad.doseKrad)} krad against ${f0(rad.tidKrad)} krad tolerance (margin ×${rad.margin.toFixed(1)}).`, 'Dose accumulates every day; storms add peaks.', 'Higher chance of computer faults and instrument degradation.', ['Add a few mm of shielding or choose a harder computer.']);
  if ((a.orbit.def.id === 'leo' || a.orbit.def.id === 'sso') && a.propulsion.lifetimeYears < a.scenario.nominalDays / 365.25 * 1.5 && !(p.engine && a.propulsion.dvAvailable >= a.propulsion.dvRequired)) {
    add('orbit-decay', a.propulsion.lifetimeYears < a.scenario.nominalDays / 365.25 ? 'CRITICAL' : 'WARNING', 'Orbit decays during the mission', 'Orbit',
      `Without reboosts the orbit decays in about ${f1(a.propulsion.lifetimeYears)} years at this altitude for a ${f0(a.mass.total)} kg spacecraft with ${f1(a.propulsion.dragAreaM2)} m² drag area.`, 'Drag removes orbital energy; density falls roughly tenfold every 100-150 km.', 'Re-entry before the end of the mission.', ['Fly higher, carry reboost propellant, or reduce the drag area / raise the mass.']);
  }
  if (a.orbit.def.kind === 'sunsync' && a.orbit.illum < 0.6 && a.instruments.some((i) => i.part.sunlitOnly && i.relevance > 0)) add('illum', 'WARNING', 'Low sun angle for imaging', 'Orbit', `The ascending node at ${(a.design.orbit.ltanH ?? 10.5).toFixed(1)} h local time puts the Sun low in the sky (illumination quality ${f0(a.orbit.illum * 100)}%).`, 'Optical instruments need good illumination; a dawn-dusk orbit avoids eclipses but gives long shadows.', 'Image quality falls though eclipse power problems vanish.', ['Choose a local time nearer 10:30 for imaging missions.']);
  if ((a.design.arrayDrive ?? 'tracking') === 'fixed' && p.solar.length) add('array-fixed', 'INFO', 'Fixed solar arrays', 'Power subsystem', 'Body-fixed arrays only see the Sun at an angle for most of each orbit.', 'Average cosine factor ~0.68 instead of ~0.95 for a sun-tracking drive.', 'About 28% less power from the same array, in exchange for 4 kg and 4 W saved per wing and one fewer mechanism.', ['Use tracking drives for power-hungry missions; fixed arrays for tiny, simple satellites.']);
  if (a.reliability.critical < 0.92 && !(a.design.redundancy?.computer && a.design.redundancy?.transmitter)) add('redundancy', 'INFO', 'Redundancy would raise reliability', 'Spacecraft architecture', `Estimated bus reliability over the nominal mission is ${f0(a.reliability.critical * 100)}%.`, 'A hot or cold spare turns a mission-ending fault into a recoverable anomaly.', 'Single-string computer or transmitter faults can degrade the mission permanently.', ['Enable computer and transmitter redundancy in the Workshop (mass, power and cost increase).']);

  // ---------- optimisation ----------
  const cheaper = LAUNCH_VEHICLES.filter((v) => payloadCapacityKg(v, a.orbit) >= a.mass.total && a.geometry.widthM <= v.fairingDiameterM * 0.95 && a.geometry.heightM <= v.fairingLengthM && vehicleCostM(v) < a.cost.launch - 1);
  if (cheaper.length) { const c = cheaper.sort((x, y) => vehicleCostM(x) - vehicleCostM(y))[0]; add('cheaper-launch', 'INFO', `${c.name} could launch this spacecraft for less`, 'Launch vehicle', `${c.name} can carry ${f0(payloadCapacityKg(c, a.orbit))} kg to this orbit at $${f1(vehicleCostM(c))}M vs $${f1(a.cost.launch)}M.`, 'Launch is often the largest cost.', 'You pay for unused lift capacity.', [`Switch to ${c.name}.`]); }
  if (a.cost.total < a.cost.budget * 0.6 && a.instruments.length < 4) add('budget-spare', 'INFO', 'Unused budget', 'Programme', `Only ${f0((a.cost.total / a.cost.budget) * 100)}% of the budget is committed.`, 'More science or redundancy may be affordable.', 'Missed science.', ['Add an instrument or a larger battery.']);
  return out;
}

export function launchBlockers(issues: Issue[]): Issue[] { return issues.filter((i) => i.severity === 'CRITICAL' && i.blocksLaunch); }
export function severityCount(issues: Issue[]) {
  return { critical: issues.filter((i) => i.severity === 'CRITICAL').length, warning: issues.filter((i) => i.severity === 'WARNING').length, info: issues.filter((i) => i.severity === 'INFO').length };
}
