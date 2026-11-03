import { Modal } from './ui';

export const SHORTCUTS: [string, string][] = [
  ['[  and  ]', 'Previous / next step of the mission'],
  ['T', 'Cycle the visual theme'],
  ['M', 'Turn the animated background on or off'],
  ['+  and  −', 'Larger / smaller text'],
  ['?', 'Open this help'],
  ['Esc', 'Close dialogs'],
];

const FLOW: [string, string][] = [
  ['Briefing', 'Read the scientific goal, the budget, the mass limit and the deadline.'],
  ['Workshop', 'Build the spacecraft: drag parts onto the amber slots in 3D. "Apply guided baseline" gives a working start.'],
  ['Instruments', 'Choose and check the science payload against the target.'],
  ['Orbit', 'Pick the orbit. Eclipse, coverage, radiation and delta-v update live.'],
  ['Launch center', 'Choose a rocket that can lift your spacecraft to this destination. Mars and asteroid targets also need a launch window.'],
  ['Tests', 'Optional campaigns: they cost money and months but lower the odds of anomalies in flight.'],
  ['Validation', 'The flight review. Red blockers must be fixed; warnings are risks you may accept.'],
  ['Flight', 'Fly the ascent yourself or let the autopilot do it, then plan the injection burn.'],
  ['Mission control', 'Run the mission day by day, answer anomalies, manage power, data and the downlink.'],
  ['Debrief', 'See the score, what went wrong and what would have scored higher.'],
];

/** First-run guide and reference: the mission flow, keyboard shortcuts and where things are. */
export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How MISSION CONTROL works" onClose={onClose} wide footer={<button className="btn primary" onClick={onClose}>Got it</button>}>
      <p>You are the flight director. You receive a science goal, a budget and engineering limits, build the spacecraft, choose an orbit and a rocket, fly it, then operate the mission for months. Every number on screen comes from a real equation or a clearly marked approximation.</p>
      <div className="grid g2" style={{ gap: 14, alignItems: 'start' }}>
        <div>
          <h3>The ten steps</h3>
          <ol style={{ paddingLeft: 18, margin: '6px 0' }}>
            {FLOW.map(([n, t]) => <li key={n} style={{ marginBottom: 5 }}><b>{n}.</b> <span className="muted">{t}</span></li>)}
          </ol>
        </div>
        <div className="col" style={{ gap: 12 }}>
          <div>
            <h3>Keyboard</h3>
            <table className="tbl"><tbody>{SHORTCUTS.map(([k, d]) => <tr key={k}><td style={{ width: 110 }}><kbd className="mono" style={{ border: '1px solid var(--line2)', padding: '1px 6px', background: 'var(--panel2)' }}>{k}</kbd></td><td>{d}</td></tr>)}</tbody></table>
          </div>
          <div>
            <h3>Good to know</h3>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li className="muted">Pick <b>Beginner</b> on the mission list for guided help, <b>Expert</b> for tight margins.</li>
              <li className="muted">The panel on the right always shows mass, power, budget, delta-v and schedule. Red means launch is blocked.</li>
              <li className="muted">Look for the <b>?</b> buttons: they explain the physics behind a number.</li>
              <li className="muted">Top bar: choose a theme and text size that are comfortable for you; the animated background can be switched off.</li>
              <li className="muted"><b>Real data</b> compares the game with real rockets, missions and the delta-v map.</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}
