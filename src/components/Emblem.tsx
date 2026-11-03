// Original insignia artwork for MISSION CONTROL (not an agency logo): a blue disc, a red trajectory arc and a white orbit.

export function Emblem({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Mission Control emblem" className="patch">
      <defs><clipPath id="em-c"><circle cx="32" cy="32" r="30" /></clipPath></defs>
      <circle cx="32" cy="32" r="30" fill="#0b3d91" />
      <g clipPath="url(#em-c)">
        {[[10, 12], [20, 6], [50, 14], [54, 40], [14, 44], [44, 54], [30, 50], [46, 28]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.2 : 0.8} fill="#fff" />)}
        <path d="M-4 52 C 14 40, 34 22, 70 8 L 70 22 C 40 34, 22 50, -4 64 Z" fill="#fc3d21" />
      </g>
      <ellipse cx="32" cy="32" rx="27" ry="10" fill="none" stroke="#fff" strokeWidth="2.2" transform="rotate(-24 32 32)" />
      <circle cx="53" cy="23" r="3" fill="#fff" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

interface PatchProps { id: string; size?: number; label?: string }

/** Round mission patch with a flat icon per scenario. */
export function MissionPatch({ id, size = 84, label }: PatchProps) {
  const uid = `mp-${id}`;
  const text = (label ?? id).toUpperCase();
  const icon = (() => {
    switch (id) {
      case 'lunar-explorer':
        return (<g><circle cx="50" cy="50" r="19" fill="#d8dce2" /><circle cx="43" cy="44" r="4" fill="#aeb4be" /><circle cx="56" cy="55" r="5.5" fill="#aeb4be" /><circle cx="57" cy="42" r="2.6" fill="#aeb4be" />
          <ellipse cx="50" cy="50" rx="30" ry="9" fill="none" stroke="#fc3d21" strokeWidth="2.4" transform="rotate(-25 50 50)" /><circle cx="76" cy="39" r="2.8" fill="#fff" /></g>);
      case 'mars-atmosphere':
        return (<g><circle cx="50" cy="50" r="20" fill="#c1440e" /><path d="M32 46 C 40 40, 44 52, 54 46 S 66 48, 70 44 L 70 54 C 60 58, 52 52, 44 58 C 38 62, 34 58, 31 56 Z" fill="#8b2e08" opacity="0.8" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="#fff" strokeWidth="1.2" strokeDasharray="2 3" /><path d="M30 78 Q 50 66 74 76" stroke="#fff" strokeWidth="2" fill="none" /></g>);
      case 'earth-observation':
        return (<g><circle cx="50" cy="50" r="20" fill="#1650b8" /><path d="M38 42 q6 -8 14 -2 q4 6 -2 9 q-6 2 -9 -2 z M54 56 q6 -2 8 4 q-2 6 -8 4 z" fill="#3fcf6b" />
          <ellipse cx="50" cy="50" rx="31" ry="10" fill="none" stroke="#fc3d21" strokeWidth="2.4" transform="rotate(35 50 50)" /><rect x="72" y="62" width="7" height="3.5" fill="#fff" transform="rotate(35 75 63)" /></g>);
      case 'asteroid-rendezvous':
        return (<g><path d="M36 44 L 44 33 L 58 35 L 66 46 L 62 60 L 48 66 L 36 58 Z" fill="#8a8178" /><path d="M44 33 L 48 46 L 62 60 M48 46 L 36 44" stroke="#5f574f" strokeWidth="1.4" fill="none" /><circle cx="47" cy="50" r="2.5" fill="#5f574f" />
          <path d="M16 70 C 30 40, 54 28, 84 30" stroke="#fc3d21" strokeWidth="2.4" fill="none" /><path d="M80 25 l8 5 l-9 4 z" fill="#fc3d21" /></g>);
      default:
        return (<g>{[[0, -11], [-9.5, -5.5], [9.5, -5.5], [-9.5, 5.5], [9.5, 5.5], [0, 11]].map(([dx, dy], i) => <polygon key={i} points="0,-6.4 5.5,-3.2 5.5,3.2 0,6.4 -5.5,3.2 -5.5,-3.2" transform={`translate(${50 + dx} ${46 + dy})`} fill="#ffb000" stroke="#7a5300" strokeWidth="0.8" />)}
          <path d="M50 66 L 50 80 M42 82 L 58 82" stroke="#fff" strokeWidth="2" /><circle cx="22" cy="30" r="1.3" fill="#fff" /><circle cx="80" cy="26" r="1.1" fill="#fff" /><circle cx="76" cy="70" r="1.4" fill="#fff" /><circle cx="26" cy="70" r="1.1" fill="#fff" /></g>);
    }
  })();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${text} mission patch`} className="patch">
      <defs><path id={`${uid}-arc`} d="M 50 50 m -41 0 a 41 41 0 1 1 82 0 a 41 41 0 1 1 -82 0" /></defs>
      <circle cx="50" cy="50" r="48" fill="#fff" />
      <circle cx="50" cy="50" r="45" fill="#0b3d91" />
      <circle cx="50" cy="50" r="31" fill="#0a1a3a" stroke="#fff" strokeWidth="1.2" />
      <text fontSize="8.6" fontWeight="700" fill="#fff" letterSpacing="1.6" fontFamily="Bahnschrift, Arial, sans-serif"><textPath href={`#${uid}-arc`} startOffset="50%" textAnchor="middle">{text.length > 22 ? text.slice(0, 22) : text}</textPath></text>
      <g>{icon}</g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#fc3d21" strokeWidth="1.5" />
    </svg>
  );
}

/** Flat launch-day illustration for the landing hero. */
export function HeroArt() {
  return (
    <svg viewBox="0 0 520 420" style={{ width: '100%', maxWidth: 520, height: 'auto' }} role="img" aria-label="Rocket lifting off above Earth's limb">
      <rect width="520" height="420" fill="#0a0d12" />
      {Array.from({ length: 60 }).map((_, i) => <circle key={i} cx={(i * 97) % 520} cy={(i * 61) % 300} r={i % 9 === 0 ? 1.6 : 0.8} fill="#fff" opacity={0.35 + (i % 5) * 0.12} />)}
      <ellipse cx="260" cy="560" rx="470" ry="260" fill="#0b3d91" />
      <ellipse cx="260" cy="560" rx="470" ry="260" fill="none" stroke="#7aa9f7" strokeWidth="3" />
      <ellipse cx="260" cy="566" rx="480" ry="268" fill="none" stroke="#7aa9f7" strokeWidth="10" opacity="0.2" />
      <path d="M60 330 C 140 300, 220 296, 300 306" stroke="#fff" strokeWidth="1.5" fill="none" strokeDasharray="4 5" opacity="0.5" />
      <ellipse cx="260" cy="170" rx="210" ry="64" fill="none" stroke="#fff" strokeWidth="1.2" transform="rotate(-18 260 170)" opacity="0.55" />
      <g transform="translate(336 40) rotate(14 40 120)">
        <polygon points="26,236 54,236 40,330 " fill="#ffb000" opacity="0.9" /><polygon points="32,236 48,236 40,290" fill="#fff" />
        <path d="M18 70 Q40 -10 62 70 L62 236 L18 236 Z" fill="#f2f4f7" />
        <path d="M18 70 Q40 -10 62 70 Z" fill="#fc3d21" />
        <rect x="18" y="120" width="44" height="14" fill="#0b3d91" /><rect x="18" y="190" width="44" height="8" fill="#0b3d91" />
        <circle cx="40" cy="96" r="7" fill="#0a0d12" stroke="#a5aeba" strokeWidth="2" />
        <polygon points="18,200 -6,248 18,236" fill="#fc3d21" /><polygon points="62,200 86,248 62,236" fill="#fc3d21" />
      </g>
      <g fontFamily="Consolas, monospace" fontSize="11" fill="#a5aeba"><text x="18" y="26">T+ 000:02:14</text><text x="18" y="42">ALT 142 KM   VEL 3,812 M/S</text><text x="18" y="58">STAGE 1 · MECO IN 38 S</text></g>
    </svg>
  );
}
