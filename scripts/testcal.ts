import { SCENARIOS } from '../src/data/missions';
import { autoDesign } from '../src/engine/designFactory';
import { analyzeDesign } from '../src/engine/resourceManager';
import { runTest } from '../src/engine/testFacility';
for (const s of SCENARIOS) {
  const a = analyzeDesign(autoDesign(s, 'engineer'), s, 'engineer');
  console.log('\n==', s.name, 'mass', a.mass.total.toFixed(0), 'dose', a.radiation.doseKrad.toFixed(2), 'tid', a.radiation.tidKrad, 'sk/yr', a.propulsion.skPerYear.toFixed(1), 'life', a.propulsion.lifetimeYears.toFixed(1), 'ecl', (a.orbit.eclipseS/60).toFixed(1), 'beta', a.orbit.betaDeg);
  for (const id of ['power', 'tvac', 'vibe', 'rf', 'deploy', 'fire']) {
    const r = runTest(id, a);
    console.log(' ', id.padEnd(7), r.verdict.padEnd(9), r.metrics.slice(0, 3).map((m) => `${m.label.slice(0, 22)}=${m.value}`).join(' | '));
  }
}
