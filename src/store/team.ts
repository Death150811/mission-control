// Team mode transport. HONEST SCOPE: this build synchronises tabs/windows of the SAME browser through the
// BroadcastChannel API (real shared state and presence between open tabs). It is NOT internet multiplayer.
// The TeamTransport interface below is what a Supabase Realtime channel would implement (see docs/MULTIPLAYER.md).

import type { Design } from '../types';
import { getState, logDecision, setState, teamHooks, type Decision, type RoleId, type TeamMember } from './store';
import { newId } from '../engine/designFactory';

export interface TeamTransport {
  send(msg: TeamMessage): void;
  onMessage(cb: (msg: TeamMessage) => void): void;
  close(): void;
}
export type TeamMessage =
  | { t: 'hello'; from: string; member: TeamMember }
  | { t: 'presence'; from: string; member: TeamMember }
  | { t: 'sync'; from: string; design: Design | null; scenarioId: string; difficulty: string; mode: string; decisions: Decision[]; requireApproval: boolean }
  | { t: 'design'; from: string; design: Design }
  | { t: 'decision'; from: string; decision: Decision }
  | { t: 'approval'; from: string; id: string; status: 'approved' | 'rejected'; text?: string; kind?: string; by?: string; create?: boolean }
  | { t: 'goodbye'; from: string };

class BroadcastTransport implements TeamTransport {
  private ch: BroadcastChannel;
  constructor(code: string) { this.ch = new BroadcastChannel(`mission-control-room-${code}`); }
  send(msg: TeamMessage) { this.ch.postMessage(msg); }
  onMessage(cb: (msg: TeamMessage) => void) { this.ch.onmessage = (e) => cb(e.data as TeamMessage); }
  close() { this.ch.close(); }
}

let transport: TeamTransport | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

export const broadcastAvailable = () => typeof BroadcastChannel !== 'undefined';

function me(): TeamMember {
  const t = getState().team;
  return { id: t.memberId, name: t.name, role: t.role, lastSeen: Date.now(), editing: editingNow };
}
let editingNow: string | undefined;
export function setEditing(what: string | undefined) { editingNow = what; }

export function randomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c = '';
  for (let i = 0; i < 4; i++) c += letters[Math.floor(Math.random() * letters.length)];
  return c;
}

function handle(msg: TeamMessage) {
  const s = getState();
  if (msg.from === s.team.memberId) return;
  switch (msg.t) {
    case 'hello':
    case 'presence': {
      setState({ team: { ...getState().team, members: { ...getState().team.members, [msg.member.id]: { ...msg.member, lastSeen: Date.now() } } } });
      if (msg.t === 'hello' && transport) {
        // the existing room members answer a newcomer with the full shared state
        transport.send({ t: 'presence', from: s.team.memberId, member: me() });
        transport.send({ t: 'sync', from: s.team.memberId, design: s.design, scenarioId: s.scenarioId, difficulty: s.difficulty, mode: s.mode, decisions: s.team.decisions.slice(0, 80), requireApproval: s.team.requireApproval });
      }
      break;
    }
    case 'sync':
      setState({ design: msg.design ?? s.design, scenarioId: msg.scenarioId, difficulty: msg.difficulty as never, mode: msg.mode as never, team: { ...s.team, decisions: msg.decisions.length > s.team.decisions.length ? msg.decisions : s.team.decisions, requireApproval: msg.requireApproval } });
      break;
    case 'design': setState({ design: msg.design }); break;
    case 'decision':
      if (!s.team.decisions.some((d) => d.id === msg.decision.id)) setState({ team: { ...s.team, decisions: [msg.decision, ...s.team.decisions].slice(0, 200) } });
      break;
    case 'approval': {
      const props = [...s.team.proposals];
      const i = props.findIndex((p) => p.id === msg.id);
      if (msg.create && i < 0) props.unshift({ id: msg.id, text: msg.text ?? '', by: msg.by ?? 'teammate', status: 'pending', kind: (msg.kind as never) ?? 'launch' });
      else if (i >= 0) props[i] = { ...props[i], status: msg.status };
      setState({ team: { ...s.team, proposals: props } });
      break;
    }
    case 'goodbye': {
      const members = { ...s.team.members }; delete members[msg.from];
      setState({ team: { ...s.team, members } });
      break;
    }
  }
}

export function joinRoom(code: string, name: string, role: RoleId | 'all') {
  leaveRoom(false);
  const s = getState();
  const team = { ...s.team, active: true, code, name, role, members: { [s.team.memberId]: { id: s.team.memberId, name, role, lastSeen: Date.now() } }, sync: broadcastAvailable() ? ('broadcast' as const) : ('none' as const) };
  setState({ team });
  if (broadcastAvailable()) {
    transport = new BroadcastTransport(code);
    transport.onMessage(handle);
    transport.send({ t: 'hello', from: team.memberId, member: me() });
    heartbeat = setInterval(() => {
      transport?.send({ t: 'presence', from: getState().team.memberId, member: me() });
      const now = Date.now(); const t = getState().team; const members = { ...t.members }; let changed = false;
      for (const k of Object.keys(members)) if (k !== t.memberId && now - members[k].lastSeen > 7000) { delete members[k]; changed = true; }
      if (changed) setState({ team: { ...getState().team, members } });
    }, 2000);
  }
  teamHooks.onDesign = (d) => transport?.send({ t: 'design', from: getState().team.memberId, design: d });
  teamHooks.onDecision = (d) => transport?.send({ t: 'decision', from: getState().team.memberId, decision: d });
  logDecision(`${name} joined room ${code} as ${role}`, 'approval');
}

export function leaveRoom(clear = true) {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  if (transport) { transport.send({ t: 'goodbye', from: getState().team.memberId }); transport.close(); }
  transport = null;
  teamHooks.onDesign = undefined; teamHooks.onDecision = undefined;
  if (clear) setState({ team: { ...getState().team, active: false, code: null, members: {}, proposals: [] } });
}

export function setRole(role: RoleId | 'all') {
  const t = getState().team;
  setState({ team: { ...t, role, members: { ...t.members, [t.memberId]: { ...(t.members[t.memberId] ?? me()), role } } } });
  transport?.send({ t: 'presence', from: t.memberId, member: me() });
}

export function propose(kind: 'launch' | 'vehicle' | 'orbit', text: string) {
  const t = getState().team;
  const p = { id: newId(), text, by: t.name, status: 'pending' as const, kind };
  setState({ team: { ...t, proposals: [p, ...t.proposals] } });
  transport?.send({ t: 'approval', from: t.memberId, id: p.id, status: 'approved', text, kind, by: t.name, create: true });
  logDecision(`Approval requested: ${text}`, 'approval');
  return p;
}
export function decide(id: string, status: 'approved' | 'rejected') {
  const t = getState().team;
  setState({ team: { ...t, proposals: t.proposals.map((p) => (p.id === id ? { ...p, status } : p)) } });
  transport?.send({ t: 'approval', from: t.memberId, id, status });
  const p = t.proposals.find((x) => x.id === id);
  logDecision(`${status === 'approved' ? 'Approved' : 'Rejected'}: ${p?.text ?? id}`, 'approval');
}
export function setRequireApproval(v: boolean) { setState({ team: { ...getState().team, requireApproval: v } }); }
