// WebGL capability check and a friendly fallback, so a device without WebGL loses the 3D view but not the whole screen.
let cached: boolean | null = null;
export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement('canvas');
    cached = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { cached = false; }
  return cached;
}

export function WebglFallback({ height, what }: { height: number; what: string }) {
  return (
    <div className="note" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
      <div>
        <b>The 3D {what} needs WebGL, which this browser or device does not provide.</b>
        <div className="muted" style={{ marginTop: 6 }}>Everything else works: use the Schematic tab in the Workshop and the numeric panels. Try another browser or enable hardware acceleration to see the 3D view.</div>
      </div>
    </div>
  );
}
