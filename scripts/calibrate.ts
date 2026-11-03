import { SCENARIOS } from '../src/data/missions';
import { LAUNCH_VEHICLES } from '../src/data/launchVehicles';
import { autoDesign } from '../src/engine/designFactory';
import { analyzeDesign } from '../src/engine/resourceManager';
import { describeOrbit, defaultSelection } from '../src/engine/orbitalMechanics';
import { payloadCapacityKg, stackDv, launchRequirement } from '../src/engine/launch';

console.log('--- capacity table (kg) ---');
for (const o of ['leo','sso','meo','geo','heo','lunar','mars','asteroid-orbit','l2']) {
  const info = describeOrbit(defaultSelection(o));
  const req = launchRequirement(info);
  console.log(o.padEnd(15), 'ascent', req.ascent.toFixed(0), 'park', req.parking.toFixed(0), 'ins', info.insertionDvMps.toFixed(0),
    LAUNCH_VEHICLES.map(v => v.name + ':' + payloadCapacityKg(v, info)).join('  '));
}
for (const s of SCENARIOS) {
  const d = autoDesign(s, 'engineer');
  const a = analyzeDesign(d, s, 'engineer');
  console.log('\n=== ', s.name);
  console.log('mass', a.mass.total.toFixed(0), 'dry', a.mass.dry.toFixed(0), 'prop', a.mass.propellant, 'cap', a.launch.capacityKg, 'supported', a.mass.supported.toFixed(0), '/', a.frame?.maxSupportedKg);
  console.log('power gen BOL/EOL', a.power.genBolW.toFixed(0), a.power.genEolW.toFixed(0), 'avg', a.power.avgLoadW.toFixed(0), 'peak', a.power.peakLoadW.toFixed(0), 'orbitMargin', a.power.orbitMarginPct.toFixed(0), 'ecl cov', a.power.eclipseCoverage.toFixed(2), 'peakMargin', a.power.marginPct.toFixed(0));
  console.log('thermal ratio', a.thermal.ratio.toFixed(2), 'metric', a.thermal.metric.toFixed(2));
  console.log('comms rate mean', ((a.comms.linkMean?.rateBps ?? 0)/1e3).toFixed(1), 'kbps', a.comms.linkMean?.limitedBy, 'contact', a.comms.contactFraction.toFixed(3), 'cap mean/worst MB', a.comms.capacityMeanMB.toFixed(0), a.comms.capacityWorstMB.toFixed(0), 'need', a.data.compressedMBd.toFixed(0));
  console.log('dv avail', a.propulsion.dvAvailable.toFixed(0), 'required', a.propulsion.dvRequired.toFixed(0), 'burn', a.propulsion.burnTimeS.toFixed(0), '/', a.propulsion.burnLimitS.toFixed(0));
  console.log('cost', JSON.stringify({p:a.cost.parts.toFixed(1), l:a.cost.launch, o:a.cost.ops.toFixed(1), c:a.cost.contingency.toFixed(1), t:a.cost.total.toFixed(1), b:a.cost.budget}));
  console.log('schedule', a.schedule.totalMonths.toFixed(1), '/', a.schedule.deadline, 'fits', a.launch.fitsWidth, a.launch.fitsHeight, 'geom', a.geometry.widthM.toFixed(2), a.geometry.heightM.toFixed(2), 'com', a.geometry.comLatM.toFixed(3), a.geometry.comHeightM.toFixed(2));
  console.log('science pts/day', a.science.potentialPerDay.toFixed(2), 'revisit', a.science.revisitDays.toFixed(1), 'orbit period', (a.orbit.periodS/60).toFixed(1), 'min');
}
