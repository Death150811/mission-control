// Anomaly / opportunity engine. Probabilities depend on the actual design (power margin, thermal margin, radiation,
// reliability, navigation sensors) and on difficulty. Rolls use a per-day deterministic stream, so a given
// design + seed reproduces the same events regardless of player action order.

import { DIFFICULTY } from './difficulty';
import { rngFor } from './rng';
import { propellantUsed } from './physics';
import type { ActiveEvent, MissionState, Phase } from './missionTypes';

interface EventDef {
  id: string;
  title: string;
  base: number; // per-day probability at ENGINEER difficulty and nominal conditions
  phases: Phase[];
  weight: (m: MissionState) => number;
  build: (m: MissionState, rng: () => number) => Omit<ActiveEvent, 'key' | 'typeId' | 'day' | 'deadlineDay' | 'title' | 'severity'> & { severity: ActiveEvent['severity'] };
  apply: (m: MissionState, ev: ActiveEvent, responseId: string, rng: () => number) => string;
}

/** Verification tests bought in the test facility lower the odds of the anomalies they would have caught. */
const TEST_EFFECT: Record<string, [string, number][]> = {
  'power-draw': [['power', 0.7]], 'battery-degradation': [['power', 0.7], ['eol', 0.6]], 'thermal-anomaly': [['tvac', 0.5]],
  'instrument-malfunction': [['vibe', 0.8], ['optical', 0.85], ['emc', 0.85]], 'comm-blackout': [['rf', 0.6], ['emc', 0.9]], 'transmitter-fault': [['rf', 0.6]],
  'solar-degradation': [['deploy', 0.5], ['acoustic', 0.8]], 'computer-fault': [['radtest', 0.6], ['sw', 0.7]], 'seu-bitflip': [['radtest', 0.6], ['sw', 0.7]],
  'wheel-friction': [['eol', 0.5]], 'star-tracker-blind': [['sw', 0.8]],
};
function testMultiplier(m: MissionState, eventId: string): number {
  const base = (TEST_EFFECT[eventId] ?? []).reduce((f, [t, k]) => f * (m.design.tests?.includes(t) ? k : 1), 1);
  return base * (m.design.tests?.includes('ete') ? 0.9 : 1);
}

const ALL_OPS: Phase[] = ['commissioning', 'science', 'extended'];
const WITH_CRUISE: Phase[] = ['cruise', 'commissioning', 'science', 'extended'];

function pickInstrument(m: MissionState, rng: () => number, weightFn?: (id: string) => number): string | null {
  const ids = Object.values(m.inst).filter((i) => i.status !== 'failed').map((i) => i.slotId);
  if (!ids.length) return null;
  const w = ids.map((id) => (weightFn ? weightFn(id) : 1));
  const total = w.reduce((s, v) => s + v, 0);
  let u = rng() * total;
  for (let i = 0; i < ids.length; i++) { u -= w[i]; if (u <= 0) return ids[i]; }
  return ids[ids.length - 1];
}
const iname = (m: MissionState, slot: string | undefined) => (slot ? m.inst[slot]?.name ?? slot : 'instrument');
const pct = (x: number) => `${Math.round(x * 100)}%`;

export const EVENT_DEFS: EventDef[] = [
  {
    id: 'solar-degradation', title: 'Solar panel degradation', base: 0.0010, phases: WITH_CRUISE,
    weight: (m) => (m.a.power.orbitMarginPct < 40 ? 1.8 : 1) * m.a.orbit.radiation,
    build: (m, rng) => {
      const mag = 0.04 + rng() * 0.08;
      return { severity: mag > 0.09 ? 'major' : 'moderate', magnitude: mag,
        description: `A micrometeoroid / radiation burst damaged cells on the solar arrays. Output would fall by ${pct(mag)}.`,
        educational: 'Solar cells age faster in radiation belts. Sizing arrays with end-of-life margin (not beginning-of-life) is why spacecraft look over-built at launch.',
        responses: [
          { id: 'reorient', label: 'Re-orient arrays and re-optimise tracking', desc: 'Recovers ~40% of the loss; costs one day of science.', quality: 1.0 },
          { id: 'reduce-load', label: 'Reduce load for ten days', desc: 'Keeps the battery healthy but recovers nothing.', quality: 0.55 },
          { id: 'accept', label: 'Accept the loss', desc: 'Full loss of array output.', quality: 0.4 },
        ] };
    },
    apply: (m, ev, id) => {
      if (id === 'reorient') { m.mods.solarLoss += ev.magnitude * 0.6; m.mods.shedUntil = Math.max(m.mods.shedUntil, m.day + 1); m.mods.shedFrac = Math.max(m.mods.shedFrac, 0.6); return `Arrays re-optimised: net loss ${pct(ev.magnitude * 0.6)}.`; }
      if (id === 'reduce-load') { m.mods.solarLoss += ev.magnitude * 0.9; m.mods.shedUntil = Math.max(m.mods.shedUntil, m.day + 10); m.mods.shedFrac = Math.max(m.mods.shedFrac, 0.2); return `Load reduced. Net loss ${pct(ev.magnitude * 0.9)}.`; }
      m.mods.solarLoss += ev.magnitude; return `Accepted a ${pct(ev.magnitude)} power loss.`;
    },
  },
  {
    id: 'power-draw', title: 'Unexpected power consumption', base: 0.0009, phases: WITH_CRUISE,
    weight: (m) => (m.a.power.orbitMarginPct < 40 ? 1.6 : 1) * (m.a.thermal.ratio < 1.3 ? 1.5 : 1),
    build: (m, rng) => {
      const w = Math.round((0.15 + rng() * 0.25) * (m.a.power.avgLoadW + 30));
      const days = 6 + Math.floor(rng() * 9);
      return { severity: 'moderate', magnitude: w, target: String(days),
        description: `A heater stuck on / a subsystem draws ${w} W extra for about ${days} days.`,
        educational: 'Average power is a budget, not a limit: surprises eat the margin. This is why power margin is held above 10-20% even when the numbers "work".',
        responses: [
          { id: 'power-cycle', label: 'Power-cycle the faulty unit', desc: '70% chance to clear the fault immediately.', quality: 0.9 },
          { id: 'shed', label: 'Shed 25% of instrument load', desc: 'Balances the budget; reduces science during the fault.', quality: 0.7 },
          { id: 'ignore', label: 'Ignore it', desc: 'Battery and instruments absorb the extra load.', quality: 0.3 },
        ] };
    },
    apply: (m, ev, id, rng) => {
      const days = Number(ev.target);
      if (id === 'power-cycle') {
        if (rng() < 0.7) return 'Fault cleared by power-cycling.';
        m.mods.extraLoadW += ev.magnitude; m.mods.extraLoadUntil = m.day + 5; return 'Power-cycle did not help: fault persists for 5 more days.';
      }
      m.mods.extraLoadW += ev.magnitude; m.mods.extraLoadUntil = m.day + days;
      if (id === 'shed') { m.mods.shedUntil = Math.max(m.mods.shedUntil, m.day + days); m.mods.shedFrac = Math.max(m.mods.shedFrac, 0.25); return `Instrument load reduced 25% for ${days} days.`; }
      return `Extra ${ev.magnitude} W load for ${days} days.`;
    },
  },
  {
    id: 'comm-blackout', title: 'Communication blackout', base: 0.0009, phases: WITH_CRUISE,
    weight: (m) => (m.a.orbit.def.bodyId === 'earth' ? 0.6 : 1),
    build: (m, rng) => {
      const days = 3 + Math.floor(rng() * 7);
      return { severity: days > 6 ? 'major' : 'moderate', magnitude: days,
        description: `Signal lost: ground station fault / solar interference. Expected outage ${days} days.`,
        educational: 'Communication windows are a resource. During an outage, data piles up in onboard storage - this is why storage must hold several days of data, not one.',
        responses: [
          { id: 'extra-station', label: 'Book backup ground station ($0.6M)', desc: 'Halves the outage.', quality: 0.9 },
          { id: 'safe-wait', label: 'Wait in reduced-load mode', desc: 'Cuts instrument load 30%; less data piles up.', quality: 0.7 },
          { id: 'continue', label: 'Keep observing and buffer data', desc: 'Risks storage overflow.', quality: 0.5 },
        ] };
    },
    apply: (m, ev, id) => {
      const d = ev.magnitude;
      if (id === 'extra-station') { m.mods.blackoutUntil = m.day + Math.ceil(d / 2); m.stats.extraCostM += 0.6; return `Backup station booked: outage ${Math.ceil(d / 2)} days.`; }
      m.mods.blackoutUntil = m.day + d;
      if (id === 'safe-wait') { m.mods.shedUntil = Math.max(m.mods.shedUntil, m.day + d); m.mods.shedFrac = Math.max(m.mods.shedFrac, 0.3); return `Reduced-load wait: ${d} days.`; }
      return `Outage of ${d} days; observing continues.`;
    },
  },
  {
    id: 'radiation-storm', title: 'Radiation storm', base: 0.0012, phases: WITH_CRUISE,
    weight: (m) => m.a.orbit.radiation * (m.a.parts.computer && m.a.parts.computer.reliability < 0.994 ? 1.3 : 1),
    build: (m, rng) => {
      const mag = 0.4 + rng() * 0.6;
      return { severity: mag > 0.8 ? 'major' : 'moderate', magnitude: mag,
        description: 'A solar particle event is sweeping through. Single-event upsets are likely in electronics and detectors.',
        educational: 'Charged particles flip bits and damage detectors. Spacecraft go to "safe mode" - instruments off, minimal electronics - until the flux decays.',
        responses: [
          { id: 'safe-mode', label: 'Enter safe mode for 2 days', desc: 'Instruments off, nothing damaged.', quality: 1.0 },
          { id: 'continue', label: 'Keep observing', desc: '40% risk of damaging an instrument and corrupting 15% of stored data.', quality: 0.35 },
        ] };
    },
    apply: (m, ev, id, rng) => {
      if (id === 'safe-mode') { m.mods.safeUntil = Math.max(m.mods.safeUntil, m.day + 2); return 'Safe mode held through the storm; no damage.'; }
      if (rng() < 0.4 * ev.magnitude + 0.1) {
        const slot = pickInstrument(m, rng);
        let lost = 0;
        for (const k of Object.keys(m.buffers)) { const l = m.buffers[k] * 0.15; m.buffers[k] -= l; lost += l; }
        m.lostMB += lost;
        if (slot) { const i = m.inst[slot]; i.status = i.status === 'degraded' ? 'failed' : 'degraded'; i.health = i.status === 'failed' ? 0 : 0.6; return `Radiation damage: ${i.name} now ${i.status}; ${Math.round(lost)} MB corrupted.`; }
      }
      return 'Lucky: the storm passed without damage.';
    },
  },
  {
    id: 'instrument-malfunction', title: 'Instrument malfunction', base: 0.0013, phases: ALL_OPS,
    weight: (m) => 1 + Object.values(m.a.parts.instruments).reduce((s, i) => s + i.part.complexity, 0) / 12,
    build: (m, rng) => {
      const slot = pickInstrument(m, rng, (id) => (m.inst[id].status === 'ok' ? m.a.instruments.find((i) => i.slotId === id)!.part.complexity : 0.2));
      return { severity: 'moderate', magnitude: 1, target: slot ?? undefined,
        description: `${iname(m, slot ?? undefined)} reports errors: bad calibration or a stuck mechanism.`,
        educational: 'Complex instruments fail more often. Operational responses (reboot, recalibrate) trade a few days of data for a chance to restore full performance.',
        responses: [
          { id: 'recalibrate', label: 'Recalibrate (2 days offline)', desc: '90% restore to full performance.', quality: 1.0 },
          { id: 'reboot', label: 'Reboot', desc: '75% restore; 25% leaves it degraded.', quality: 0.8 },
          { id: 'power-off', label: 'Power it off permanently', desc: 'Protects the bus; instrument lost.', quality: 0.3 },
        ] };
    },
    apply: (m, ev, id, rng) => {
      const slot = ev.target; if (!slot || !m.inst[slot]) return 'No instrument affected.';
      const i = m.inst[slot];
      if (id === 'power-off') { i.status = 'failed'; i.health = 0; return `${i.name} switched off for good.`; }
      const ok = rng() < (id === 'recalibrate' ? 0.9 : 0.75);
      if (id === 'recalibrate') m.mods.spike[slot] = { until: m.day + 2, mult: 0 };
      if (ok) { i.status = 'ok'; i.health = 1; return `${i.name} restored to full performance.`; }
      i.status = 'degraded'; i.health = 0.6; return `${i.name} recovered only partly (60% performance).`;
    },
  },
  {
    id: 'battery-degradation', title: 'Battery degradation', base: 0.0007, phases: ALL_OPS,
    weight: (m) => (m.a.power.dod <= 0.4 ? 1.5 : 1) * (m.a.power.eclipseCoverage < 1.5 ? 1.5 : 1),
    build: (m, rng) => {
      const mag = 0.06 + rng() * 0.06;
      return { severity: 'moderate', magnitude: mag,
        description: `A cell string is failing: battery capacity would fall by ${pct(mag)}.`,
        educational: 'Batteries wear with every deep charge cycle. Lower depth of discharge means longer life - another reason a bigger battery can be the lighter choice over a long mission.',
        responses: [
          { id: 'reduce-dod', label: 'Cut load 10% for 14 days', desc: 'Limits stress; halves the capacity loss.', quality: 0.9 },
          { id: 'accept', label: 'Accept', desc: 'Full capacity loss.', quality: 0.5 },
        ] };
    },
    apply: (m, ev, id) => {
      if (id === 'reduce-dod') { m.mods.battHealth -= ev.magnitude * 0.5; m.mods.shedUntil = Math.max(m.mods.shedUntil, m.day + 14); m.mods.shedFrac = Math.max(m.mods.shedFrac, 0.1); return `Capacity down ${pct(ev.magnitude * 0.5)}.`; }
      m.mods.battHealth -= ev.magnitude; return `Capacity down ${pct(ev.magnitude)}.`;
    },
  },
  {
    id: 'data-spike', title: 'Increased data generation', base: 0.0014, phases: ['science', 'extended'],
    weight: () => 1,
    build: (m, rng) => {
      const slot = pickInstrument(m, rng, (id) => (m.inst[id].status === 'ok' ? 1 : 0.1));
      const days = 3 + Math.floor(rng() * 4);
      return { severity: 'minor', magnitude: days, target: slot ?? undefined,
        description: `${iname(m, slot ?? undefined)} found a transient target (dust storm / outburst / fresh feature). It will produce 2.5x data for ${days} days.`,
        educational: 'Science return is limited by the downlink, not by the sensor. A rare event is only valuable if its data can be sent home before storage overflows.',
        responses: [
          { id: 'prioritize', label: 'Prioritise it in the downlink', desc: 'Its data is downlinked first so none of the surge is lost.', quality: 1.0 },
          { id: 'throttle', label: 'Throttle to normal rate', desc: 'Safe for storage; most of the opportunity is lost.', quality: 0.6 },
          { id: 'ignore', label: 'Do nothing', desc: 'Storage may overflow.', quality: 0.4 },
        ] };
    },
    apply: (m, ev, id) => {
      const slot = ev.target; if (!slot) return 'Nothing to do.';
      const d = ev.magnitude;
      if (id === 'throttle') { m.mods.spike[slot] = { until: m.day + d, mult: 1.2 }; return 'Data rate capped; opportunity mostly lost.'; }
      m.mods.spike[slot] = { until: m.day + d, mult: 2.5 };
      if (id === 'prioritize') { m.ops.downlink = 'priority'; m.ops.priorityInstrument = slot; return `${iname(m, slot)} prioritised for ${d} days.`; }
      return `Data surge for ${d} days, no special handling.`;
    },
  },
  {
    id: 'thermal-anomaly', title: 'Thermal anomaly', base: 0.0009, phases: WITH_CRUISE,
    weight: (m) => (m.a.thermal.ratio < 1.2 ? 3 : m.a.thermal.ratio < 1.8 ? 1.8 : 1),
    build: (m, rng) => {
      const mag = 0.3 + rng() * 0.3;
      return { severity: mag > 0.5 ? 'major' : 'moderate', magnitude: mag, target: String(8 + Math.floor(rng() * 8)),
        description: 'A radiator is partially blocked / a louver stuck. Components run hotter or colder than planned.',
        educational: 'All power that enters a spacecraft leaves as heat. If rejection capacity is thin, small faults push temperatures out of range and instruments drift.',
        responses: [
          { id: 'reorient', label: 'Re-orient to a cooler attitude', desc: 'Cuts the effect 70%; one day of lost pointing.', quality: 0.9 },
          { id: 'reduce-load', label: 'Reduce load 30% until cooled', desc: 'Halves the effect.', quality: 0.8 },
          { id: 'accept', label: 'Accept', desc: 'Full effect; risk of instrument damage.', quality: 0.4 },
        ] };
    },
    apply: (m, ev, id, rng) => {
      const d = Number(ev.target);
      const factor = id === 'reorient' ? 0.3 : id === 'reduce-load' ? 0.5 : 1;
      m.mods.thermalExtra = ev.magnitude * factor; m.mods.thermalUntil = m.day + d;
      if (id === 'reorient') { m.mods.shedUntil = Math.max(m.mods.shedUntil, m.day + 1); m.mods.shedFrac = Math.max(m.mods.shedFrac, 0.5); }
      if (id === 'reduce-load') { m.mods.shedUntil = Math.max(m.mods.shedUntil, m.day + d); m.mods.shedFrac = Math.max(m.mods.shedFrac, 0.3); }
      if (id === 'accept' && m.a.thermal.ratio < 1.5 && rng() < 0.35) {
        const slot = pickInstrument(m, rng, (x) => m.a.instruments.find((i) => i.slotId === x)!.part.thermal + 0.1);
        if (slot) { m.inst[slot].status = 'degraded'; m.inst[slot].health = 0.6; return `Overheating degraded ${m.inst[slot].name}.`; }
      }
      return `Thermal effect ${pct(m.mods.thermalExtra)} for ${d} days.`;
    },
  },
  {
    id: 'nav-uncertainty', title: 'Navigation uncertainty', base: 0.0007, phases: ['cruise', 'science', 'extended'],
    weight: (m) => (m.a.science.navigation ? 0.4 : 1.8) * (m.a.orbit.def.bodyId === 'asteroid' ? 2 : 1),
    build: (m, rng) => {
      const dv = Math.round(10 + rng() * 20);
      return { severity: 'moderate', magnitude: dv,
        description: `Tracking shows the orbit estimate drifting. A ${dv} m/s correction would fix it.`,
        educational: 'Navigation error grows until measurements correct it. Burns fix it but spend delta-v - a finite, non-renewable resource.',
        responses: [
          { id: 'burn', label: `Execute correction burn (${dv} m/s)`, desc: 'Uses propellant; restores accuracy.', quality: 1.0 },
          { id: 'accept', label: 'Live with it', desc: 'Coverage efficiency -15% for 25 days.', quality: 0.5 },
        ] };
    },
    apply: (m, ev, id) => {
      if (id === 'burn') {
        const eng = m.a.parts.engine; if (!eng) return 'No engine: cannot correct.';
        const used = propellantUsed(ev.magnitude, eng.isp, m.a.mass.dry + m.propKg);
        if (used > m.propKg) { m.propKg = 0; return 'Not enough propellant: partial correction only.'; }
        m.propKg -= used; return `Correction burn executed: ${used.toFixed(1)} kg propellant used.`;
      }
      m.mods.navPenaltyUntil = m.day + 25; return 'Accepted degraded navigation for 25 days.';
    },
  },
  {
    id: 'comm-opportunity', title: 'Unexpected communication opportunity', base: 0.0016, phases: ['science', 'extended'],
    weight: () => 1,
    build: () => ({ severity: 'minor', magnitude: 1.5,
      description: 'A partner relay / spare ground station is available for a bonus downlink pass.',
      educational: 'Contact time converts directly into science: every extra pass drains the on-board backlog.',
      responses: [
        { id: 'use-pass', label: 'Use the bonus pass', desc: '+150% downlink capacity tomorrow.', quality: 1.0 },
        { id: 'skip', label: 'Skip it', desc: 'No effect.', quality: 0.5 },
      ] }),
    apply: (m, _ev, id) => { if (id === 'use-pass') { m.mods.bonusCapacityToday = 1.5; return 'Bonus downlink scheduled.'; } return 'Opportunity skipped.'; },
  },
  {
    id: 'computer-fault', title: 'Flight computer fault', base: 0.0006, phases: WITH_CRUISE,
    weight: (m) => 0.6 + 120 * (1 - (m.a.parts.computer?.reliability ?? 0.99)) + 3 * (m.a.radiation.doseYear * (m.day / 365.25)) / Math.max(m.a.radiation.tidKrad, 1) * 5,
    build: (m) => {
      const backup = !!m.design.redundancy?.computer && !m.mods.backupUsed.computer;
      return { severity: 'major', magnitude: 1,
        description: 'A processor latch-up (radiation-induced single-event effect) crashed the flight software.',
        educational: 'Radiation flips bits and can latch up electronics. Redundant units are the standard cure: a cross-strapped spare takes over within seconds. Without one you must restart the unit you have and hope it recovers.',
        responses: [
          ...(backup ? [{ id: 'switch-backup', label: 'Switch to the redundant computer', desc: 'The cold spare takes over; no data lost. The spare is then used up.', quality: 1.0 }] : []),
          { id: 'reboot', label: 'Reboot and scrub memory', desc: '60% chance to recover cleanly; otherwise five days in safe mode.', quality: 0.8 },
          { id: 'accept', label: 'Continue on the damaged unit', desc: 'Processing capacity falls by half for the rest of the mission.', quality: 0.35 },
        ] };
    },
    apply: (m, _ev, id, rng) => {
      if (id === 'switch-backup') { m.mods.backupUsed.computer = true; return 'Redundant computer active. No loss.'; }
      if (id === 'reboot') { if (rng() < 0.6) return 'Reboot successful.'; m.mods.safeUntil = Math.max(m.mods.safeUntil, m.day + 5); return 'Reboot failed to clear the fault: five days in safe mode.'; }
      m.mods.procPenalty = Math.min(m.mods.procPenalty, 0.5); return 'Running degraded: 50% processing capacity.';
    },
  },
  {
    id: 'transmitter-fault', title: 'Transmitter fault', base: 0.0006, phases: WITH_CRUISE,
    weight: (m) => 0.6 + 120 * (1 - (m.a.parts.transmitter?.reliability ?? 0.99)),
    build: (m) => {
      const backup = !!m.design.redundancy?.transmitter && !m.mods.backupUsed.transmitter;
      return { severity: 'major', magnitude: 1,
        description: 'The transmitter amplifier shows an over-temperature trip and output power is collapsing.',
        educational: 'The downlink amplifier is a classic single point of failure. A hot spare restores the link; otherwise you run at reduced power and lose data rate (and the link margin falls with it).',
        responses: [
          ...(backup ? [{ id: 'switch-backup', label: 'Switch to the redundant transmitter', desc: 'Full downlink restored. The spare is then used up.', quality: 1.0 }] : []),
          { id: 'hard-reset', label: 'Power-cycle the amplifier', desc: '50% chance to recover; otherwise a three-day outage.', quality: 0.8 },
          { id: 'reduced', label: 'Operate at half power', desc: 'Downlink capacity falls by half for the rest of the mission.', quality: 0.5 },
        ] };
    },
    apply: (m, _ev, id, rng) => {
      if (id === 'switch-backup') { m.mods.backupUsed.transmitter = true; return 'Redundant transmitter active.'; }
      if (id === 'hard-reset') { if (rng() < 0.5) return 'Amplifier recovered.'; m.mods.blackoutUntil = Math.max(m.mods.blackoutUntil, m.day + 3); return 'No recovery: three-day outage while engineers re-route.'; }
      m.mods.txPenalty = Math.min(m.mods.txPenalty, 0.5); return 'Downlink at half capacity.';
    },
  },
  {
    id: 'seu-bitflip', title: 'Memory bit-flip (single-event upset)', base: 0.0011, phases: WITH_CRUISE,
    weight: (m) => m.a.orbit.radiation * ((m.a.parts.computer?.tidKrad ?? 100) >= 300 ? 0.2 : (m.a.parts.computer?.tidKrad ?? 100) >= 100 ? 0.55 : 1.5),
    build: () => ({ severity: 'minor', magnitude: 1,
      description: 'An energetic particle flipped bits in on-board memory. Error-correcting code caught the first ones, but errors are starting to accumulate.',
      educational: 'Single-event upsets are the everyday face of radiation in space. Commercial parts see many; radiation-hardened computers see almost none. Scrubbing memory regularly keeps errors from piling up.',
      responses: [
        { id: 'scrub', label: 'Run a memory scrub', desc: 'Rewrites memory from error-corrected copies; costs half a day of science.', quality: 1.0 },
        { id: 'reboot', label: 'Reboot the computer', desc: 'Clears the errors but forces one day of safe mode.', quality: 0.7 },
        { id: 'ignore', label: 'Ignore it', desc: 'About 5% of stored data is corrupted.', quality: 0.3 },
      ] }),
    apply: (m, _ev, id) => {
      if (id === 'scrub') { m.mods.shedUntil = Math.max(m.mods.shedUntil, m.day + 1); m.mods.shedFrac = Math.max(m.mods.shedFrac, 0.5); return 'Memory scrubbed; no data lost.'; }
      if (id === 'reboot') { m.mods.safeUntil = Math.max(m.mods.safeUntil, m.day + 1); return 'Rebooted: one day in safe mode.'; }
      let lost = 0;
      for (const k of Object.keys(m.buffers)) { const l = m.buffers[k] * 0.05; m.buffers[k] -= l; lost += l; }
      m.lostMB += lost; return `${Math.round(lost)} MB of stored data corrupted.`;
    },
  },
  {
    id: 'wheel-friction', title: 'Reaction wheel friction rising', base: 0.0007, phases: ALL_OPS,
    weight: (m) => (m.a.parts.adcs?.id === 'adcs-basic' ? 0 : m.a.parts.adcs?.id === 'adcs-sun' ? 0.6 : 1) * (1 + m.day / 700),
    build: () => ({ severity: 'moderate', magnitude: 1,
      description: 'Telemetry shows motor current climbing in one reaction wheel: lubricant is degrading and the wheel is losing torque.',
      educational: 'Reaction wheels are mechanical: they spin for years on bearings. Many real missions have lost a wheel and been rescued by new control software that works with three instead of four.',
      responses: [
        { id: 'relube', label: 'Reduce wheel speed and run a lubrication cycle', desc: 'Restores the bearing for now; three days of reduced pointing accuracy.', quality: 1.0 },
        { id: 'three', label: 'Retire the wheel and reconfigure to three-axis control', desc: 'Permanent but safe; two weeks of reduced pointing accuracy while the new software settles.', quality: 0.8 },
        { id: 'ignore', label: 'Keep using it', desc: 'Pointing degrades for two months as the wheel keeps wearing.', quality: 0.3 },
      ] }),
    apply: (m, _ev, id) => {
      const d = id === 'relube' ? 3 : id === 'three' ? 15 : 60;
      m.mods.navPenaltyUntil = Math.max(m.mods.navPenaltyUntil, m.day + d); return `Pointing accuracy reduced for ${d} days.`;
    },
  },
  {
    id: 'star-tracker-blind', title: 'Star tracker blinded', base: 0.0008, phases: ALL_OPS,
    weight: (m) => (['adcs-star', 'adcs-adv', 'adcs-lite', 'adcs-cmg'].includes(m.a.parts.adcs?.id ?? '') ? 1.5 : 0),
    build: () => ({ severity: 'minor', magnitude: 1,
      description: 'The Sun (or the bright limb of the planet) crossed the star tracker\'s field of view and the attitude solution was lost.',
      educational: 'Star trackers recognise star patterns to find attitude, but bright objects blind them. Flight rules keep them pointed away from the Sun, and gyros bridge the gaps.',
      responses: [
        { id: 'slew', label: 'Slew away and re-acquire stars', desc: 'Back in a day; costs one day of science.', quality: 1.0 },
        { id: 'gyro', label: 'Coast on gyros until the tracker recovers', desc: 'Pointing drifts slightly for five days.', quality: 0.7 },
        { id: 'wait', label: 'Wait for it to clear', desc: 'Pointing is poor for about twelve days.', quality: 0.45 },
      ] }),
    apply: (m, _ev, id) => {
      if (id === 'slew') { m.mods.shedUntil = Math.max(m.mods.shedUntil, m.day + 1); m.mods.shedFrac = Math.max(m.mods.shedFrac, 0.6); return 'Attitude re-acquired after one day.'; }
      const d = id === 'gyro' ? 5 : 12; m.mods.navPenaltyUntil = Math.max(m.mods.navPenaltyUntil, m.day + d); return `Reduced pointing for ${d} days.`;
    },
  },
  {
    id: 'micrometeoroid', title: 'Micrometeoroid strike', base: 0.0005, phases: WITH_CRUISE,
    weight: (m) => (m.scenario.target === 'asteroid' ? 1.8 : m.scenario.target === 'deepspace' ? 1.2 : 1),
    build: () => ({ severity: 'moderate', magnitude: 1,
      description: 'Accelerometers recorded a sharp impulse: a dust grain hit the spacecraft at several kilometres per second.',
      educational: 'Every spacecraft is sandblasted by dust. Most hits are harmless; a few puncture tanks or crack optics, which is why critical parts get shields and why engineers inspect telemetry after each hit.',
      responses: [
        { id: 'inspect', label: 'Stand down and inspect', desc: 'Costs a day of science; engineers confirm only cosmetic damage.', quality: 1.0 },
        { id: 'continue', label: 'Continue operations', desc: '25% chance that an instrument is degraded.', quality: 0.5 },
      ] }),
    apply: (m, _ev, id, rng) => {
      if (id === 'inspect') { m.mods.shedUntil = Math.max(m.mods.shedUntil, m.day + 1); m.mods.shedFrac = Math.max(m.mods.shedFrac, 0.6); return 'Inspection complete: cosmetic damage only.'; }
      if (rng() < 0.25) { const slot = pickInstrument(m, rng); if (slot) { const i = m.inst[slot]; i.status = i.status === 'degraded' ? 'failed' : 'degraded'; i.health = i.status === 'failed' ? 0 : 0.65; return `${i.name} damaged by the impact: now ${i.status}.`; } }
      return 'No effect found.';
    },
  },
];

export function rollEvent(m: MissionState): ActiveEvent | null {
  if (m.pending) return null;
  const rules = DIFFICULTY[m.difficulty];
  const rng = rngFor(m.seed, 'event', m.day);
  const cands = EVENT_DEFS.filter((e) => e.phases.includes(m.phase));
  const probs = cands.map((e) => Math.min(0.05, e.base * 1.5 * rules.anomalyMul * e.weight(m) * testMultiplier(m, e.id)));
  const u = rng();
  let acc = 0;
  for (let i = 0; i < cands.length; i++) {
    acc += probs[i];
    if (u < acc) {
      const def = cands[i];
      const built = def.build(m, rngFor(m.seed, 'event-build', m.day));
      return { key: `${def.id}-${m.day}`, typeId: def.id, title: def.title, day: m.day, deadlineDay: m.day + 3, ...built };
    }
  }
  return null;
}

/** Apply a player (or automatic) response. Returns the outcome text. */
export function applyResponse(m: MissionState, ev: ActiveEvent, responseId: string, auto: boolean): string {
  const def = EVENT_DEFS.find((d) => d.id === ev.typeId)!;
  const resp = ev.responses.find((r) => r.id === responseId) ?? ev.responses[ev.responses.length - 1];
  const rng = rngFor(m.seed, 'event-resolve', ev.key);
  const text = def.apply(m, ev, resp.id, rng);
  const q = auto ? resp.quality * 0.8 : resp.quality;
  m.stats.qualitySum += q; m.stats.qualityCount += 1; m.stats.eventsTotal += 1;
  m.responses.push({ day: m.day, typeId: ev.typeId, title: ev.title, response: resp.label, quality: q, auto });
  m.pending = null;
  return text;
}

/** The "flight director" default: pick the response with the best quality. */
export function bestResponse(ev: ActiveEvent): string {
  return [...ev.responses].sort((a, b) => b.quality - a.quality)[0].id;
}
export function worstResponse(ev: ActiveEvent): string {
  return [...ev.responses].sort((a, b) => a.quality - b.quality)[0].id;
}
