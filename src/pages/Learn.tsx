import { useState } from 'react';
import { Panel, n0, n1 } from '../components/ui';
import { BODIES } from '../data/bodies';
import { TOPICS } from '../education/topics';
import { dishGainDbi, linkBudget } from '../engine/communicationModel';
import { orbitalPeriod } from '../engine/orbitalMechanics';
import { G0, propellantForDv, tsiolkovskyDv } from '../engine/physics';
import { PARTS } from '../data/spacecraftComponents';
import type { AntennaPart, TransmitterPart } from '../types';
import { useCurrent } from '../store/store';

function PeriodCalc() {
  const [body, setBody] = useState<'earth' | 'moon' | 'mars'>('earth');
  const [alt, setAlt] = useState(400);
  const b = BODIES[body];
  const a = b.radius + alt * 1000;
  const T = orbitalPeriod(b.mu, a);
  return (
    <Panel title="Calculator · orbital period">
      <div className="chips">{(['earth', 'moon', 'mars'] as const).map((x) => <button key={x} className={`chip ${body === x ? 'on' : ''}`} onClick={() => setBody(x)}>{BODIES[x].name}</button>)}</div>
      <label className="col"><span>Altitude {n0(alt)} km</span><input type="range" min={100} max={body === 'earth' ? 40000 : 2000} step={10} value={alt} onChange={(e) => setAlt(Number(e.target.value))} /></label>
      <code className="eq">T = 2π √(a³/μ) = {n1(T / 60)} min  ({(T / 3600).toFixed(2)} h)</code>
      <div className="muted">v = √(μ/r) = {n0(Math.sqrt(b.mu / a))} m/s · μ = {b.mu.toExponential(3)} m³/s²</div>
    </Panel>
  );
}
function RocketCalc() {
  const [isp, setIsp] = useState(318);
  const [dv, setDv] = useState(800);
  const [dry, setDry] = useState(600);
  const mp = propellantForDv(dv, isp, dry);
  return (
    <Panel title="Calculator · rocket equation">
      <label className="col"><span>Isp {isp} s</span><input type="range" min={200} max={3000} step={5} value={isp} onChange={(e) => setIsp(Number(e.target.value))} /></label>
      <label className="col"><span>Required Δv {n0(dv)} m/s</span><input type="range" min={50} max={4000} step={10} value={dv} onChange={(e) => setDv(Number(e.target.value))} /></label>
      <label className="col"><span>Dry mass {n0(dry)} kg</span><input type="range" min={100} max={3000} step={10} value={dry} onChange={(e) => setDry(Number(e.target.value))} /></label>
      <code className="eq">m_prop = m_f (e^(Δv/(Isp g₀)) − 1) = {n0(mp)} kg</code>
      <div className="muted">Check: Δv = Isp g₀ ln(m₀/m_f) = {n0(tsiolkovskyDv(isp, dry + mp, dry))} m/s · g₀ = {G0} m/s². Doubling Δv more than doubles the propellant.</div>
    </Panel>
  );
}
function LinkCalc() {
  const [au, setAu] = useState(1.5);
  const [dish, setDish] = useState<'ant-mga' | 'ant-hga'>('ant-hga');
  const [tx, setTx] = useState<'tx-5' | 'tx-25' | 'tx-80'>('tx-25');
  const l = linkBudget(PARTS[dish] as AntennaPart, PARTS[tx] as TransmitterPart, null, au * 1.495978707e11, 'engineer', 0.05);
  return (
    <Panel title="Calculator · deep-space link (simplified)">
      <label className="col"><span>Distance {au.toFixed(2)} AU ({(au * 8.317).toFixed(1)} light-minutes)</span><input type="range" min={0.1} max={3} step={0.05} value={au} onChange={(e) => setAu(Number(e.target.value))} /></label>
      <div className="chips"><button className={`chip ${dish === 'ant-mga' ? 'on' : ''}`} onClick={() => setDish('ant-mga')}>0.5 m dish</button><button className={`chip ${dish === 'ant-hga' ? 'on' : ''}`} onClick={() => setDish('ant-hga')}>1.8 m dish</button>{(['tx-5', 'tx-25', 'tx-80'] as const).map((t) => <button key={t} className={`chip ${tx === t ? 'on' : ''}`} onClick={() => setTx(t)}>{(PARTS[t] as TransmitterPart).rfPowerW} W</button>)}</div>
      <dl className="kv" style={{ marginTop: 8 }}><dt>Dish gain</dt><dd>{n1(dishGainDbi((PARTS[dish] as AntennaPart).diameterM, 8.4))} dBi</dd><dt>Free-space loss</dt><dd>{n1(l.fsplDb)} dB</dd><dt>Received power</dt><dd>{n1(l.rxPowerDbw)} dBW</dd><dt>C/N₀</dt><dd>{n1(l.cn0DbHz)} dB-Hz</dd><dt>Max data rate</dt><dd><b className="cy">{l.rateBps > 1e6 ? n1(l.rateBps / 1e6) + ' Mbps' : n1(l.rateBps / 1e3) + ' kbps'}</b></dd></dl>
      <div className="note">Not a professional RF analysis: single modulation, fixed coding gain, no weather or noise-temperature detail.</div>
    </Panel>
  );
}

export default function Learn() {
  const { analysis, app } = useCurrent();
  const [open, setOpen] = useState<string | null>(app.learnTopic ?? 'deltaV');
  return (
    <div className="col" style={{ gap: 14 }}>
      <div><h1>Learning center</h1><div className="muted">Every concept has a definition, why engineers care, a practical example and a live connection to {analysis ? 'your current design' : 'a design once you start one'}.</div></div>
      <div className="grid g3"><PeriodCalc /><RocketCalc /><LinkCalc /></div>
      <Panel title="Concepts" pad={false}>
        {TOPICS.map((t) => (
          <div key={t.id} style={{ borderBottom: '1px solid var(--line)' }}>
            <button className="btn" style={{ width: '100%', textAlign: 'left', border: 0, background: open === t.id ? 'var(--cyan-bg)' : 'transparent' }} onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>{t.title}</button>
            {open === t.id && (
              <div className="fadein" style={{ padding: '4px 16px 16px' }}>
                {t.equation && <code className="eq">{t.equation}</code>}
                <h3 className="cy" style={{ margin: '8px 0 2px' }}>Simple definition</h3><p>{t.definition}</p>
                <h3 className="cy" style={{ margin: '8px 0 2px' }}>Why engineers care</h3><p>{t.significance}</p>
                <h3 className="cy" style={{ margin: '8px 0 2px' }}>Practical example</h3><p>{t.example}</p>
                <h3 className="or" style={{ margin: '8px 0 2px' }}>In your design</h3><p>{t.connect(analysis)}</p>
              </div>
            )}
          </div>
        ))}
      </Panel>
    </div>
  );
}
