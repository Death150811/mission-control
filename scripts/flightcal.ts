import { LAUNCH_VEHICLES } from '../src/data/launchVehicles';
import { runAutoFlight, tuneKick } from '../src/engine/flightSim';
import { payloadCapacityKg, stackDv, launchRequirement } from '../src/engine/launch';
import { describeOrbit, defaultSelection } from '../src/engine/orbitalMechanics';

for (const v of LAUNCH_VEHICLES) {
  const info = describeOrbit(defaultSelection('leo'));
  const cap = payloadCapacityKg(v, info);
  for (const frac of [0.3, 0.6, 0.9]) {
    const pl = Math.round(cap * frac);
    if (pl < 50) continue;
    const opts = { seed: 1, reliabilityScale: 0, payloadMaxG: 8, incDeg: 28.5 };
    const k = tuneKick(v, pl, opts);
    const r = runAutoFlight(v, pl, { ...opts, kickDeg: k });
    const sd = stackDv(v, pl);
    console.log(v.name.padEnd(12), 'payload', pl, 'kick', k, 'orbit', r.orbitOk, 'peri/apo', r.perigeeKm.toFixed(0), r.apogeeKm.toFixed(0), 't', r.state.t.toFixed(0),
      'dvUsed', r.state.dvUsed.toFixed(0), 'stackDv', sd.total.toFixed(0), 'remainDv', r.remainingDv.toFixed(0), 'maxQ', (r.state.maxQ/1000).toFixed(0), 'maxG', r.state.maxG.toFixed(1), r.state.failure ?? '');
  }
}
