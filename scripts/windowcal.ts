import { SCENARIO_MAP } from '../src/data/missions';
import { autoDesign } from '../src/engine/designFactory';
import { validateDesign } from '../src/engine/feasibilityValidator';
import { analyzeDesign } from '../src/engine/resourceManager';
import { c3AtDay } from '../src/engine/launchWindows';
import { ORBITS } from '../src/data/orbits';

for (const id of Object.keys(SCENARIO_MAP)) {
  const s = SCENARIO_MAP[id];
  for (const diff of ['beginner', 'engineer', 'expert'] as const) {
    const d = autoDesign(s, diff);
    const a = analyzeDesign(d, s, diff);
    const issues = validateDesign(a).filter((i) => i.id.startsWith('window') || i.id === 'schedule');
    console.log(s.name.padEnd(22), diff.padEnd(9), 'ready', a.schedule.readyMonths.toFixed(1), 'mo (day', Math.round(a.schedule.readyMonths * 30.44) + ')', 'depart', a.orbit.departDay ?? '-', 'wait', a.schedule.waitMonths.toFixed(1), 'standby $' + a.cost.standby.toFixed(1) + 'M', 'deadline', s.deadlineMonths, 'capOK', a.launch.ok, 'issues', issues.map((i) => i.id).join(',') || '-');
  }
}
const mars = ORBITS.mars;
for (const day of [200, 400, 560, 700, 960, 1340]) console.log('mars day', day, 'C3', (c3AtDay(mars, day) / 1e6).toFixed(1));
