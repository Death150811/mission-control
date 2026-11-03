import { Component, useEffect, useState, type ReactNode } from 'react';
import StatusPanel from './components/StatusPanel';
import { launchBlockers } from './engine/feasibilityValidator';
import { go, useCurrent, type Screen } from './store/store';
import { Emblem } from './components/Emblem';
import TechTree from './pages/TechTree';
import Briefing from './pages/Briefing';
import TestFacility from './pages/TestFacility';
import Compare from './pages/Compare';
import Debrief from './pages/Debrief';
import FlightScreen from './pages/FlightScreen';
import InstrumentLab from './pages/InstrumentLab';
import Landing from './pages/Landing';
import LaunchCenter from './pages/LaunchCenter';
import Learn from './pages/Learn';
import Library from './pages/Library';
import MissionControl from './pages/MissionControl';
import MissionSelect from './pages/MissionSelect';
import OrbitPlanner from './pages/OrbitPlanner';
import Backdrop from './components/Backdrop';
import ThemeSwitcher from './components/ThemeSwitcher';
import RealWorld from './pages/RealWorld';
import Sandbox from './pages/Sandbox';
import TeamRoom from './pages/TeamRoom';
import Validation from './pages/Validation';
import Workshop from './pages/Workshop';
import HelpModal from './components/HelpModal';
import StepBar from './components/StepBar';
import { cycleTheme, setMotion, setTextStep, useTheme } from './store/theme';

const STEPS: { id: Screen; label: string }[] = [
  { id: 'briefing', label: 'Briefing' }, { id: 'workshop', label: 'Workshop' }, { id: 'instruments', label: 'Instruments' }, { id: 'orbit', label: 'Orbit' },
  { id: 'launch', label: 'Launch center' }, { id: 'tests', label: 'Tests' }, { id: 'validation', label: 'Validation' }, { id: 'flight', label: 'Flight' }, { id: 'control', label: 'Mission control' }, { id: 'debrief', label: 'Debrief' },
];
const DESIGN_SCREENS: Screen[] = ['workshop', 'instruments', 'orbit', 'launch', 'tests', 'validation'];
const FLOW_SCREENS: Screen[] = [...STEPS.map((s) => s.id)];
/** The steps that get the sticky Back / Next bar, with a one-line "what to do here". */
const BAR_FLOW: Screen[] = ['briefing', 'workshop', 'instruments', 'orbit', 'launch', 'tests', 'validation'];
const TIPS: Partial<Record<Screen, string>> = {
  briefing: 'Read the goal, the budget and the mass limit, then start designing.',
  workshop: 'Fill the amber slots: instruments first, then power, antenna, computer and engine. "Apply guided baseline" gives a working start.',
  instruments: 'Check that every instrument suits this target and fits your power and data budget.',
  orbit: 'Choose the orbit that serves your objectives; watch eclipse time, coverage and delta-v.',
  launch: 'Pick a rocket whose capacity to this destination is above your spacecraft mass. Mars and asteroid targets also need a launch date.',
  tests: 'Optional: tests cost money and months but lower the odds of anomalies in flight.',
  validation: 'Fix every red blocker. Warnings are risks you can choose to accept.',
};
const INTRO_KEY = 'mc-intro-seen';

class Boundary extends Component<{ children: ReactNode; reset: unknown }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidUpdate(prev: { reset: unknown }) { if (prev.reset !== this.props.reset && this.state.err) this.setState({ err: null }); }
  render() {
    if (this.state.err) return <div className="panel"><div className="pb"><h2 className="rd">Something went wrong in this screen</h2><p className="muted">{this.state.err.message}</p><button className="btn" onClick={() => this.setState({ err: null })}>Retry</button> <button className="btn" onClick={() => go('landing')}>Home</button></div></div>;
    return this.props.children;
  }
}

export default function App() {
  const { app, issues, analysis } = useCurrent();
  const s = app.screen;
  useEffect(() => { document.querySelector('.content')?.scrollTo?.(0, 0); }, [s]);
  const blockers = launchBlockers(issues).length;
  const inFlow = FLOW_SCREENS.includes(s) && !!app.design;
  const showPanel = DESIGN_SCREENS.includes(s) && !!analysis;
  const order = STEPS.map((x) => x.id);
  const idx = order.indexOf(s);
  const disabled = (id: Screen) => {
    if (!app.design) return true;
    if (id === 'flight') return blockers > 0;
    if (id === 'control') return !app.mission;
    if (id === 'debrief') return !app.result;
    return false;
  };
  const { motion, textStep } = useTheme();
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = () => { setHelpOpen(false); try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* storage unavailable */ } };
  useEffect(() => { try { if (!localStorage.getItem(INTRO_KEY)) setHelpOpen(true); } catch { /* ignore */ } }, []);
  const barIdx = BAR_FLOW.indexOf(s);
  const barPrev = barIdx > 0 ? STEPS.find((x) => x.id === BAR_FLOW[barIdx - 1]) ?? null : null;
  const nextId: Screen | null = barIdx < 0 ? null : barIdx < BAR_FLOW.length - 1 ? BAR_FLOW[barIdx + 1] : 'flight';
  const barNext = nextId ? STEPS.find((x) => x.id === nextId) ?? null : null;
  const nextBlocked = barNext && nextId === 'flight' && blockers > 0 ? `Resolve the ${blockers} launch blocker${blockers > 1 ? 's' : ''} first` : null;
  const warnCount = issues.filter((x) => x.severity === 'WARNING').length;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === '?') { setHelpOpen(true); return; }
      if (e.key === 't' || e.key === 'T') { cycleTheme(); return; }
      if (e.key === 'm' || e.key === 'M') { setMotion(!motion); return; }
      if (e.key === '+' || e.key === '=') { setTextStep(textStep + 1); return; }
      if (e.key === '-' || e.key === '_') { setTextStep(textStep - 1); return; }
      if (e.key === '[' && barPrev) go(barPrev.id as Screen);
      if (e.key === ']' && barNext && !nextBlocked) go(barNext.id as Screen);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [motion, textStep, barPrev, barNext, nextBlocked]);
  const NAV: { id: Screen; label: string }[] = [{ id: 'select', label: 'Missions' }, { id: 'sandbox', label: 'Sandbox' }, { id: 'team', label: 'Team' }, { id: 'compare', label: 'Compare' }, { id: 'library', label: 'Library' }, { id: 'learn', label: 'Learn' }, { id: 'tech', label: 'Tech tree' }, { id: 'real', label: 'Real data' }];
  const page = () => {
    switch (s) {
      case 'landing': return <Landing />;
      case 'select': return <MissionSelect />;
      case 'briefing': return app.design ? <Briefing /> : <MissionSelect />;
      case 'workshop': return app.design ? <Workshop /> : <MissionSelect />;
      case 'instruments': return app.design ? <InstrumentLab /> : <MissionSelect />;
      case 'orbit': return app.design ? <OrbitPlanner /> : <MissionSelect />;
      case 'launch': return app.design ? <LaunchCenter /> : <MissionSelect />;
      case 'validation': return app.design ? <Validation /> : <MissionSelect />;
      case 'flight': return app.design ? <FlightScreen key={app.design.id + app.seed} /> : <MissionSelect />;
      case 'control': return <MissionControl />;
      case 'debrief': return <Debrief />;
      case 'sandbox': return <Sandbox />;
      case 'team': return <TeamRoom />;
      case 'compare': return <Compare />;
      case 'library': return <Library />;
      case 'learn': return <Learn />;
      case 'tech': return <TechTree />;
      case 'real': return <RealWorld />;
      case 'tests': return app.design ? <TestFacility /> : <MissionSelect />;
    }
  };
  return (
    <>
    <Backdrop />
    <div className="app">
      <header className="topbar">
        <button className="logo" onClick={() => go('landing')} aria-label="MISSION CONTROL home">
          <Emblem size={36} />
          <span><b>MISSION CONTROL</b><small>EVERY DECISION HAS AN ORBIT</small></span>
        </button>
        {app.career.enabled && <span className="team-pill" title="Space-programme mode">PROGRAMME · {app.career.credits} CR</span>}
        {app.team.active && <span className="team-pill"><span className="dot" />room {app.team.code} · {app.team.role === 'all' ? 'all roles' : app.team.role} · {Object.keys(app.team.members).length}/4</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}><ThemeSwitcher /><button className="helpbtn" onClick={() => setHelpOpen(true)} aria-label="Help and keyboard shortcuts" title="Help and keyboard shortcuts  ( ? )">?</button></div>
        <nav className="topnav" aria-label="Main" style={{ marginLeft: 0 }}>{NAV.map((n) => <button key={n.id} className={s === n.id ? 'on' : ''} onClick={() => go(n.id)}>{n.label}</button>)}</nav>
      </header>
      {inFlow ? (
        <nav className="stepper" aria-label="Mission stages">
          {STEPS.map((st, i) => {
            const done = idx > i;
            const warn = st.id === 'validation' && issues.some((x) => x.severity === 'WARNING') && !blockers;
            return <button key={st.id} disabled={disabled(st.id)} className={`${s === st.id ? 'on' : done ? 'done' : ''} ${st.id === 'validation' && blockers ? 'bad' : warn ? 'warn' : ''}`} onClick={() => go(st.id)}><span className="n">{i + 1}</span>{st.label}</button>;
          })}
        </nav>
      ) : <div />}
      <div className={`main ${showPanel ? '' : 'nopanel'}`}>
        <main className="content"><Boundary reset={s}>{page()}</Boundary>
          {inFlow && barIdx >= 0 && <StepBar index={STEPS.findIndex((x) => x.id === s)} total={STEPS.length} prev={barPrev} next={barNext} nextBlockedReason={nextBlocked} tip={TIPS[s]} blockers={blockers} warnings={warnCount} onGo={(id) => go(id as Screen)} />}
        </main>
        {showPanel && <StatusPanel />}
      </div>
      {app.toast && <div role="status" style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface3)', border: '1px solid var(--cyan)', padding: '8px 16px', zIndex: 200, fontSize: 'calc(14px * var(--ts, 1))' }} className="fadein">{app.toast}</div>}
      {helpOpen && <HelpModal onClose={closeHelp} />}
    </div>
    </>
  );
}
