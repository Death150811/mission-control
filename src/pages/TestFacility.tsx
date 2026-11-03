import { Fragment } from 'react';
import { LineChart } from '../components/Charts';
import { Badge, Panel, Stat, n1 } from '../components/ui';
import { TESTS } from '../data/tests';
import { runTest } from '../engine/testFacility';
import { go, updateDesign, useCurrent } from '../store/store';

export default function TestFacility() {
  const { app, analysis: a } = useCurrent();
  if (!a || !app.design) return null;
  const sel = app.design.tests ?? [];
  const toggle = (id: string) => updateDesign((d) => ({ ...d, tests: (d.tests ?? []).includes(id) ? (d.tests ?? []).filter((t) => t !== id) : [...(d.tests ?? []), id] }), `Verification test ${sel.includes(id) ? 'removed' : 'booked'}: ${id}`);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row"><div><h1>Test facility</h1><div className="muted">Test, learn, rebuild. Each campaign costs money and months, reveals real problems before launch, and lowers the odds of the anomalies it would have caught.</div></div><span className="spacer" /><button className="btn primary" onClick={() => go('validation')}>Flight readiness poll →</button></div>
      <div className="grid g4">
        <Stat label="Campaign cost" value={`$${n1(a.cost.tests)}M`} tone="or" sub={`of $${n1(a.cost.budget)}M budget`} />
        <Stat label="Added schedule" value={`${n1(a.schedule.testMonths)} mo`} sub={`total ${n1(a.schedule.totalMonths)} / ${a.schedule.deadline} mo`} />
        <Stat label="Tests booked" value={`${sel.length} / ${TESTS.length}`} />
        <Stat label="Results" value={sel.length ? 'live' : '—'} sub="re-run automatically when the design changes" />
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        {TESTS.map((t) => {
          const booked = sel.includes(t.id);
          const r = booked ? runTest(t.id, a) : null;
          return (
            <Panel key={t.id} title={t.name} right={<>{r && <Badge tone={r.verdict === 'PASS' ? 'gr' : r.verdict === 'MARGINAL' ? 'or' : 'rd'}>{r.verdict}</Badge>}<button className={`btn sm ${booked ? '' : 'primary'}`} onClick={() => toggle(t.id)}>{booked ? 'Remove' : `Book · $${t.costM}M · ${t.months} mo`}</button></>}>
              <p className="muted" style={{ marginTop: 0 }}>{t.short}</p>
              <div className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))', marginBottom: 6 }}>Effect once tested: {t.reduces}</div>
              {r && (
                <div className="fadein">
                  <dl className="kv">{r.metrics.map((m) => <Fragment key={m.label}><dt>{m.label}</dt><dd className={m.ok === undefined ? '' : m.ok ? 'gr' : 'rd'}>{m.value}</dd></Fragment>)}</dl>
                  {r.metrics.some((m) => m.note) && <ul className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))', margin: '6px 0', paddingLeft: 16 }}>{r.metrics.filter((m) => m.note).map((m) => <li key={m.label}>{m.label}: {m.note}</li>)}</ul>}
                  <div className="note" style={{ borderLeftColor: r.verdict === 'PASS' ? 'var(--green)' : r.verdict === 'MARGINAL' ? 'var(--amber)' : 'var(--red)' }}>{r.findings.map((f) => <div key={f}>{f}</div>)}</div>
                  {r.chart && <div style={{ marginTop: 8 }}><LineChart title={r.chart.title} series={r.chart.series} xs={r.chart.xs} xLabel={r.chart.xLabel} yMax={r.chart.yMax} height={150} /></div>}
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
