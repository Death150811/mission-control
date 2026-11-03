import { useState } from 'react';
import { Badge, Panel, Illustrative } from '../components/ui';
import { ROLE_INFO, logDecision, useApp, type RoleId } from '../store/store';
import { broadcastAvailable, decide, joinRoom, leaveRoom, propose, randomCode, setRequireApproval, setRole } from '../store/team';
import { SCENARIOS } from '../data/missions';
import { startCampaign, go } from '../store/store';

const ROLES = Object.keys(ROLE_INFO) as RoleId[];

export default function TeamRoom() {
  const app = useApp();
  const t = app.team;
  const [name, setName] = useState(t.name || 'Player');
  const [code, setCode] = useState(t.code ?? '');
  const [role, setRoleSel] = useState<RoleId | 'all'>('all');
  const [msg, setMsg] = useState('');
  const members = Object.values(t.members);
  const roleTaken = (r: RoleId) => members.some((m) => m.role === r && m.id !== t.memberId);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div><h1>Team room</h1><div className="muted">Up to four participants share one mission state: Director, Spacecraft Engineer, Science Officer, Flight Operations Officer.</div></div>
      <div className="note" style={{ borderColor: 'var(--orange)' }}>
        <b>Honest scope.</b> {broadcastAvailable() ? 'Synchronisation here is REAL but local: open this app in another tab or window of the same browser, join the same room code, and design changes, presence and approvals sync live through the browser BroadcastChannel API. ' : 'BroadcastChannel is not available in this browser, so only the single-device role simulation works. '}
        It is not internet multiplayer: that needs a backend such as Supabase Realtime. The transport is isolated behind a <span className="mono">TeamTransport</span> interface (docs/MULTIPLAYER.md). Nothing on this page is simulated presence: members listed are actual open sessions.
      </div>
      {!t.active ? (
        <div className="grid g2">
          <Panel title="Create or join a room">
            <label className="col"><span>Your name</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} /></label>
            <label className="col" style={{ marginTop: 8 }}><span>Your role</span><select value={role} onChange={(e) => setRoleSel(e.target.value as never)}><option value="all">Solo: I play every role</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}</select></label>
            <div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={() => { const c = randomCode(); setCode(c); joinRoom(c, name, role); }}>Create room</button></div>
            <hr style={{ borderColor: 'var(--line)', margin: '14px 0' }} />
            <label className="col"><span>Join with a room code</span><input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={4} placeholder="ABCD" style={{ textTransform: 'uppercase' }} /></label>
            <div className="row" style={{ marginTop: 8 }}><button className="btn" disabled={code.length !== 4} onClick={() => joinRoom(code, name, role)}>Join room</button></div>
          </Panel>
          <Panel title="Roles">
            {ROLES.map((r) => <div key={r} style={{ marginBottom: 10 }}><b>{ROLE_INFO[r].label}</b><div className="muted">{ROLE_INFO[r].blurb}</div></div>)}
            <div className="note">Role permissions are enforced in the Workshop, Instrument Lab, Orbit Planner and Launch Center: a role cannot edit another role's subsystems.</div>
          </Panel>
        </div>
      ) : (
        <div className="grid g2">
          <Panel title={<>Room <span className="cy mono" style={{ fontSize: 'calc(20px * var(--ts, 1))' }}>{t.code}</span></>} right={<button className="btn sm danger" onClick={() => leaveRoom()}>Leave</button>}>
            <div className="muted">Share this code with up to 3 other tabs/windows. Sync mode: <Badge tone={t.sync === 'broadcast' ? 'gr' : 'or'}>{t.sync === 'broadcast' ? 'same-browser live sync' : 'single device'}</Badge></div>
            <h3 style={{ margin: '12px 0 6px' }}>Members ({members.length}/4)</h3>
            {members.map((m) => <div key={m.id} className="row" style={{ marginBottom: 4 }}><span className="dot" /> <b>{m.name}</b>{m.id === t.memberId && <Badge>you</Badge>}<Badge tone="cy">{m.role === 'all' ? 'all roles' : ROLE_INFO[m.role].label}</Badge>{m.editing && <span className="or">editing {m.editing}</span>}</div>)}
            <h3 style={{ margin: '12px 0 6px' }}>Your role</h3>
            <div className="chips"><button className={`chip ${t.role === 'all' ? 'on' : ''}`} onClick={() => setRole('all')}>all (solo)</button>{ROLES.map((r) => <button key={r} className={`chip ${t.role === r ? 'on' : ''}`} disabled={roleTaken(r)} title={roleTaken(r) ? 'Taken by another member' : ''} onClick={() => setRole(r)}>{ROLE_INFO[r].label}</button>)}</div>
            <label className="row" style={{ marginTop: 12 }}><input type="checkbox" checked={t.requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />Require Mission Director approval for launch and launch-vehicle changes</label>
            <div className="row" style={{ marginTop: 10 }}>
              {!app.design && <select onChange={(e) => e.target.value && startCampaign(e.target.value, app.difficulty)} defaultValue=""><option value="">Start a mission for the team…</option>{SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
              {app.design && <button className="btn primary" onClick={() => go('workshop')}>Open the shared workshop →</button>}
            </div>
          </Panel>
          <div className="col">
            <Panel title="Approvals">
              {t.proposals.length === 0 && <div className="muted">No approval requests.</div>}
              {t.proposals.map((p) => <div key={p.id} className="row" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}><div style={{ flex: 1 }}><b>{p.text}</b><div className="muted">by {p.by} · {p.kind}</div></div>{p.status === 'pending' ? (t.role === 'director' || t.role === 'all' ? <><button className="btn sm primary" onClick={() => decide(p.id, 'approved')}>Approve</button><button className="btn sm danger" onClick={() => decide(p.id, 'rejected')}>Reject</button></> : <Badge tone="or">pending</Badge>) : <Badge tone={p.status === 'approved' ? 'gr' : 'rd'}>{p.status}</Badge>}</div>)}
              {t.role !== 'director' && t.role !== 'all' && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => propose('launch', `Launch ${app.design?.name ?? 'spacecraft'}`)}>Request launch approval</button>}
            </Panel>
            <Panel title="Decision history & discussion">
              <div className="row"><input type="text" value={msg} placeholder="Discuss a decision…" onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && msg.trim()) { logDecision(msg.trim(), 'chat'); setMsg(''); } }} style={{ flex: 1 }} /><button className="btn" onClick={() => { if (msg.trim()) { logDecision(msg.trim(), 'chat'); setMsg(''); } }}>Send</button></div>
              <div className="log" style={{ maxHeight: 300, marginTop: 8 }}>{t.decisions.length === 0 && <div className="dim">Design changes and approvals are recorded here.</div>}{t.decisions.map((d) => <div key={d.id} className={d.kind === 'approval' ? 'warn' : ''}><span className="d">{new Date(d.at).toLocaleTimeString()}</span><b>{d.author}</b> ({d.role}): {d.text}</div>)}</div>
            </Panel>
          </div>
        </div>
      )}
      <Illustrative>Team data (room code, names, decisions) never leaves your browser in this build.</Illustrative>
    </div>
  );
}
