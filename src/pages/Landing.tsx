import { Badge } from '../components/ui';
import { HeroArt, MissionPatch } from '../components/Emblem';
import { SCENARIOS } from '../data/missions';
import { go, startCampaign, useApp } from '../store/store';

export default function Landing() {
  const app = useApp();
  const hasDraft = !!app.design;
  return (
    <div>
      <div className="hero grid" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', alignItems: 'center', gap: 28 }}>
        <div>
          <Badge tone="cy">Mission design &amp; flight operations simulator</Badge>
          <h1 style={{ fontSize: 'calc(58px * var(--ts, 1))', letterSpacing: '0.1em', margin: '14px 0 4px', lineHeight: 1 }}>Mission<br />Control</h1>
          <div className="stripe3" style={{ width: 220, margin: '10px 0 14px' }} />
          <div style={{ fontFamily: 'var(--cond)', fontSize: 'calc(22px * var(--ts, 1))', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Every decision has an orbit.</div>
          <p style={{ fontSize: 'calc(15px * var(--ts, 1))', color: 'var(--muted)', maxWidth: 560 }}>You are the flight director. Take a science objective, a fixed budget and real engineering limits. Assemble the spacecraft, choose the orbit and rocket, fly the ascent yourself, then run the mission for months and answer for every number in the debrief.</p>
          <div className="row" style={{ marginTop: 20 }}>
            <button className="btn primary lg" onClick={() => go('select')}>Start mission</button>
            <button className="btn lg" disabled={!hasDraft} onClick={() => go(app.mission && !app.mission.ended ? 'control' : 'workshop')} title={hasDraft ? 'Resume your current design' : 'No mission in progress'}>Continue mission</button>
            <button className="btn lg" onClick={() => go('sandbox')}>Sandbox</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => go('library')}>Mission library</button>
            <button className="btn" onClick={() => go('library')}>Leaderboard</button>
            <button className="btn" onClick={() => go('learn')}>Learning center</button>
            <button className="btn" onClick={() => go('tech')}>Technology tree</button>
          </div>
        </div>
        <div className="panel" style={{ padding: 6 }}><HeroArt /></div>
      </div>

      <div className="hazard" style={{ margin: '8px 0 18px' }} />
      <div className="grid g3">
        {[
          ['1', 'Build', 'Assemble the spacecraft from real subsystems: frame, solar wings, batteries, antennas, instruments, engines and tanks. Mass, power, heat, data and cost update live.'],
          ['2', 'Fly', 'Pick an orbit and a launch vehicle, stage it, then fly the ascent: throttle, gravity turn, staging, and a planned injection burn. Delta-v is a budget, not a card stat.'],
          ['3', 'Operate', 'Run months of operations day by day: manage power, storage and downlink, answer anomalies, and read a debrief that shows what you would have gained by deciding differently.'],
        ].map(([n, t, d]) => (
          <div className="panel" key={t}>
            <div className="ph"><h3>Phase {n} · {t}</h3></div>
            <div className="pb"><p className="muted" style={{ margin: 0 }}>{d}</p></div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '24px 0 10px' }}>Select your mission patch</h3>
      <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
        {SCENARIOS.map((s) => (
          <button key={s.id} className="card" style={{ width: 150, textAlign: 'center' }} onClick={() => startCampaign(s.id, app.difficulty)} aria-label={`Start ${s.name}`}>
            <MissionPatch id={s.id} size={92} label={s.name} />
            <div style={{ fontFamily: 'var(--cond)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 6 }}>{s.name}</div>
            <div className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))' }}>${s.budgetM}M · {s.difficultyRating}/5</div>
          </button>
        ))}
      </div>
      <div className="note" style={{ marginTop: 22, maxWidth: 760 }}>
        <b>The one principle:</b> there is no universally perfect spacecraft. There are only spacecraft optimised for particular mission objectives and constraints.
        <span className="dim"> · Original artwork; not an agency product.</span>
      </div>
    </div>
  );
}
