import { Fragment } from 'react';
import type { AdcsPart, AntennaPart, BatteryPart, ComputerPart, EnginePart, FramePart, InstrumentPart, Part, SolarPart, TankPart, ThermalPart, TransmitterPart } from '../types';
import { n0, n1 } from './ui';

export function specLine(p: Part): string {
  const base = `${p.massKg} kg · $${p.costM}M${p.powerW > 0 ? ` · ${n1(p.powerW)} W` : ''}`;
  switch (p.category) {
    case 'frame': { const f = p as FramePart; return `${base} · carries ${f.maxSupportedKg} kg · ${f.maxAccelG} g`; }
    case 'solar': { const s = p as SolarPart; return `${p.massKg} kg · $${p.costM}M · ${n0(s.areaM2 * s.wattsPerM2)} W@1AU`; }
    case 'battery': return `${base} · ${(p as BatteryPart).capacityWh} Wh`;
    case 'antenna': { const a = p as AntennaPart; return `${base} · ${n1(a.gainDbi)} dBi · ≤${a.maxRateMbps} Mbps`; }
    case 'transmitter': return `${base} · ${(p as TransmitterPart).rfPowerW} W RF`;
    case 'computer': { const c = p as ComputerPart; return `${base} · ${n0(c.processingMBd / 1000)} GB/d · ${n0(c.storageMB / 1000)} GB`; }
    case 'adcs': return `${base} · ${(p as AdcsPart).pointingDeg}° pointing`;
    case 'thermal': { const t = p as ThermalPart; return `${base} · rejects ${t.heatRejectionW} W`; }
    case 'engine': { const e = p as EnginePart; return `${base} · ${e.thrustN} N · Isp ${e.isp}s`; }
    case 'tank': return `${base} · ${(p as TankPart).capacityKg} kg`;
    case 'instrument': { const i = p as InstrumentPart; return `${base} · ${n0(i.dataMBd)} MB/d · sci ${i.sci}`; }
  }
}

export function PartDetail({ part }: { part: Part }) {
  const rows: [string, string][] = [['Mass', `${part.massKg} kg`], ['Cost', `$${part.costM}M`], ['Power', part.powerW ? `${n1(part.powerW)} W` : '—'], ['Reliability / yr', `${(part.reliability * 100).toFixed(1)}%`], ['Dev. time', `${part.devMonths} mo`]];
  if (part.category === 'instrument') { const i = part as InstrumentPart; rows.push(['Data', `${n0(i.dataMBd)} MB/day`], ['Scientific value', `${i.sci}/100`], ['Complexity', `${i.complexity}/5`], ['Pointing needed', `${i.pointingDeg}°`]); }
  if (part.category === 'solar') { const s = part as SolarPart; rows.push(['Area', `${s.areaM2} m²`], ['Output @1 AU (BOL)', `${n0(s.areaM2 * s.wattsPerM2)} W`], ['Degradation', `${(s.degradationPerYear * 100).toFixed(1)}%/yr`], ['Span', `${s.spanM} m`]); }
  if (part.category === 'battery') { const b = part as BatteryPart; rows.push(['Energy', `${b.capacityWh} Wh`], ['Max discharge', `${b.maxDischargeW} W`]); }
  if (part.category === 'antenna') { const a = part as AntennaPart; rows.push(['Band / freq', `${a.band} · ${a.freqGHz} GHz`], ['Gain', `${n1(a.gainDbi)} dBi`], ['Max rate', `${a.maxRateMbps} Mbps`], ['Diameter', `${a.diameterM} m`]); }
  if (part.category === 'engine') { const e = part as EnginePart; rows.push(['Thrust', `${e.thrustN} N`], ['Isp', `${e.isp} s`], ['Type', e.electric ? 'Electric (needs power, low thrust)' : 'Chemical']); }
  return (
    <div className="fadein">
      <h2 style={{ marginBottom: 4 }}>{part.name}</h2>
      <p className="muted">{part.desc}</p>
      <dl className="kv">{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
      {part.category === 'instrument' && (
        <>
          <h3 style={{ margin: '10px 0 4px' }}>Capabilities</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{(part as InstrumentPart).capabilities.map((c) => <li key={c}>{c}</li>)}</ul>
        </>
      )}
      <h3 style={{ margin: '10px 0 4px' }}>Trade-offs</h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>{part.tradeoffs.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  );
}
