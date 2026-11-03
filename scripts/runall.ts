import { SCENARIOS } from '../src/data/missions';
import { autoDesign } from '../src/engine/designFactory';
import { runMission } from '../src/engine/missionSimulator';
import { scoreMission } from '../src/engine/scoringEngine';

for (const diff of ['engineer'] as const) {
  for (const s of SCENARIOS) {
    const d = autoDesign(s, diff);
    for (const policy of ['director', 'passive'] as const) {
      const m = runMission(d, s, diff, 42, policy);
      const sc = scoreMission(m);
      console.log(`\n== ${s.name} [${diff}/${policy}] outcome=${m.outcome} day=${m.day} launch=${m.launch.ok} ins=${m.insertionOk}  score=${sc.total} (${sc.rank}) caps=${sc.caps.join(';')}`);
      if (policy === 'director') {
        console.log(' ', m.endReason);
        console.log('  comps', sc.components.map((c) => `${c.id}:${(c.raw * 100).toFixed(0)}`).join(' '));
        for (const o of sc.objectives) console.log(`   ${o.met ? 'OK ' : '-- '} ${o.objective.id.padEnd(10)} ${o.detail}`);
        console.log('  stats', JSON.stringify(m.stats), 'gen/down/lost MB', m.generatedMB.toFixed(0), m.downlinkedMB.toFixed(0), m.lostMB.toFixed(0), 'prop', m.propKg.toFixed(0));
        console.log('  events', m.responses.length, m.responses.map((r) => r.typeId).join(','));
      }
    }
  }
}
