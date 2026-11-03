import { TEXT_STEPS, THEMES, setMotion, setTextStep, setTheme, useTheme, type ThemeId } from '../store/theme';

/** Compact appearance controls for the top bar: theme, text size, background motion. */
export default function ThemeSwitcher() {
  const { theme, motion, textStep } = useTheme();
  return (
    <div className="themebox">
      <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeId)} aria-label="Visual theme" title={THEMES.find((t) => t.id === theme)?.hint}>
        {THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <div className="row" style={{ gap: 0 }} role="group" aria-label="Text size">
        <button onClick={() => setTextStep(textStep - 1)} disabled={textStep === 0} aria-label="Smaller text" title="Smaller text" style={{ fontSize: 'calc(12px * var(--ts, 1))' }}>A−</button>
        <button onClick={() => setTextStep(textStep + 1)} disabled={textStep === TEXT_STEPS.length - 1} aria-label="Larger text" title={`Larger text (now ${Math.round(TEXT_STEPS[textStep] * 100)}%)`} style={{ fontSize: 'calc(15px * var(--ts, 1))' }}>A+</button>
      </div>
      <button aria-pressed={motion} onClick={() => setMotion(!motion)} title="Animated background (rockets, orbits, stars)">{motion ? '◉ motion' : '○ motion'}</button>
    </div>
  );
}
