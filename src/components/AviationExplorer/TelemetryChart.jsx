import { useEffect, useRef, useState } from 'react';

const WIDTH = 280;
const HEIGHT = 88;
const POINTS = 36;

function buildPath(phase, noiseSeed) {
  const coords = [];
  for (let i = 0; i < POINTS; i += 1) {
    const x = (i / (POINTS - 1)) * WIDTH;
    const base = Math.sin(i * 0.38 + phase) * 14;
    const micro = Math.sin(i * 0.9 + phase * 1.7) * 5;
    const noise = Math.sin(i * 2.1 + noiseSeed) * 2.5;
    const y = HEIGHT / 2 - base - micro - noise;
    coords.push([x, y]);
  }
  return coords;
}

function coordsToPath(coords) {
  return coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

export default function TelemetryChart({ active = true }) {
  const [path, setPath] = useState('');
  const [fillPath, setFillPath] = useState('');
  const phaseRef = useRef(0);
  const seedRef = useRef(0);

  useEffect(() => {
    if (!active) return undefined;

    let frameId;
    const tick = () => {
      phaseRef.current += 0.07;
      seedRef.current += 0.011;
      const coords = buildPath(phaseRef.current, seedRef.current);
      const line = coordsToPath(coords);
      const fill = `${line} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;
      setPath(line);
      setFillPath(fill);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [active]);

  return (
    <div className="rounded-xl border border-cyan-500/25 bg-slate-950/80 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
          Live Strain Telemetry
        </p>
        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          250 Hz
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Animated strain gauge telemetry chart"
      >
        <defs>
          <linearGradient id="telemetryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0, 229, 255, 0.35)" />
            <stop offset="100%" stopColor="rgba(0, 229, 255, 0)" />
          </linearGradient>
        </defs>
        {[22, 44, 66].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2={WIDTH}
            y2={y}
            stroke="rgba(148, 163, 184, 0.12)"
            strokeWidth="1"
          />
        ))}
        {fillPath && <path d={fillPath} fill="url(#telemetryFill)" />}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="#00e5ff"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500">
        <span>-1200 µε</span>
        <span>Δ strain (hull frame 7A)</span>
        <span>+980 µε</span>
      </div>
    </div>
  );
}
