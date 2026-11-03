import { LAUNCH_VEHICLES } from '../src/data/launchVehicles';
import { createFlight, stepFlight, autopilot, elements, vehicleMass } from '../src/engine/flightSim';
const v = LAUNCH_VEHICLES[3];
const s = createFlight(v, 30000, { seed: 1, reliabilityScale: 0, payloadMaxG: 8, incDeg: 28.5, kickDeg: 6 });
s.engineOn = true; s.throttle = 1; s.status='ascent';
let n=0;
while (s.status==='ascent' && s.t<200) {
  const g = autopilot(v, s);
  stepFlight(v, s, g);
  if (n++ % 100 === 0) {
    const r = Math.hypot(s.x,s.y); const el = elements(s);
    console.log('t', s.t.toFixed(0), 'h', ((r-6.371e6)/1000).toFixed(1), 'v', Math.hypot(s.vx,s.vy).toFixed(0), 'q', (s.qNow/1000).toFixed(1), 'g', s.gNow.toFixed(2), 'thr', g.throttle.toFixed(2), 'pitch', s.pitchDeg.toFixed(1), g.reason, 'peri/apo', ((el.rp-6.371e6)/1000).toFixed(0), ((el.ra-6.371e6)/1000).toFixed(0), 'm', vehicleMass(v,s).toFixed(0));
  }
}
console.log(s.status, s.failure);
