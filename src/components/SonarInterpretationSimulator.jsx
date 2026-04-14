import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import sonarSignals from '../data/sonarSignals.json';

function classifySignal(strength) {
  if (strength >= 0.68) return { label: 'Obstacle Candidate', confidence: 0.88 };
  if (strength >= 0.55) return { label: 'Vessel Echo',        confidence: 0.79 };
  return                       { label: 'Background / Biological Noise', confidence: 0.61 };
}

// ── Radar Display ─────────────────────────────────────────────────────────
// Maps each sonar signal onto a polar coordinate around the centre of the display.

function RadarDisplay({ signals, threshold }) {
  const CX = 50;
  const CY = 50;
  const MAX_R = 42; // radius in SVG-units to fit inside the 100×100 viewBox

  const blips = signals.map((s, i) => {
    // Spread signals evenly from 30° to 330° (top of display, clockwise)
    const angleDeg = 30 + i * ((330 - 30) / Math.max(signals.length - 1, 1));
    const rad = ((angleDeg - 90) * Math.PI) / 180; // offset so 0° = 12-o'clock
    const r = (s.distance / 40) * MAX_R;
    return {
      ...s,
      cx: CX + r * Math.cos(rad),
      cy: CY + r * Math.sin(rad),
      isDetected: s.strength >= threshold,
    };
  });

  return (
    <div className="relative mx-auto" style={{ width: 220, height: 220 }}>
      {/* Rotating sweep — conic gradient on a div clipped to circle */}
      <div
        className="absolute inset-0 overflow-hidden rounded-full radar-sweep-div"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, rgba(0,163,224,0) 0deg, rgba(0,163,224,0) 290deg, rgba(0,163,224,0.06) 320deg, rgba(0,163,224,0.22) 350deg, rgba(0,163,224,0.55) 358deg, rgba(0,163,224,0) 360deg)',
        }}
      />

      {/* SVG grid + blips on top */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        {/* Dark circle background */}
        <circle cx={CX} cy={CY} r={48} fill="rgba(0,5,15,0.92)" />

        {/* Concentric range rings */}
        {[12, 24, 36].map((r) => (
          <circle
            key={r}
            cx={CX} cy={CY} r={r}
            fill="none"
            stroke="rgba(0,163,224,0.18)"
            strokeWidth="0.4"
          />
        ))}

        {/* Radial grid lines */}
        {[0, 45, 90, 135].map((angleDeg) => {
          const rad = (angleDeg * Math.PI) / 180;
          return (
            <line
              key={angleDeg}
              x1={CX + 44 * Math.cos(rad)} y1={CY - 44 * Math.sin(rad)}
              x2={CX - 44 * Math.cos(rad)} y2={CY + 44 * Math.sin(rad)}
              stroke="rgba(0,163,224,0.14)"
              strokeWidth="0.3"
            />
          );
        })}

        {/* Blips */}
        {blips.map((blip, i) =>
          blip.isDetected ? (
            <motion.circle
              key={i}
              cx={blip.cx}
              cy={blip.cy}
              fill="rgba(0,163,224,1)"
              animate={{ opacity: [1, 0.35, 1], r: [2.5 + blip.strength * 2, 3.5 + blip.strength * 2, 2.5 + blip.strength * 2] }}
              transition={{ duration: 1.8, delay: i * 0.35, repeat: Infinity }}
            />
          ) : (
            <circle
              key={i}
              cx={blip.cx}
              cy={blip.cy}
              r={1.4}
              fill="rgba(148,163,184,0.35)"
            />
          ),
        )}

        {/* Centre dot */}
        <circle cx={CX} cy={CY} r={1.5} fill="rgba(0,163,224,0.8)" className="glow-pulse" />

        {/* Outer border ring */}
        <circle cx={CX} cy={CY} r={46} fill="none" stroke="rgba(0,163,224,0.35)" strokeWidth="0.7" />
      </svg>
    </div>
  );
}

// ── Signal strength bar ───────────────────────────────────────────────────

function StrengthBar({ strength, isDetected }) {
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <motion.div
        className={`h-full rounded-full ${isDetected ? 'bg-pacificCyan' : 'bg-slate-600'}`}
        initial={{ width: 0 }}
        animate={{ width: `${strength * 100}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function SonarInterpretationSimulator() {
  const [threshold, setThreshold] = useState(0.55);
  const [viewMode, setViewMode] = useState('classification');

  const results = useMemo(
    () =>
      sonarSignals.map((signal) => {
        const classification = classifySignal(signal.strength);
        return { ...signal, ...classification, isDetection: signal.strength >= threshold };
      }),
    [threshold],
  );

  const detectionRate = Math.round(
    (results.filter((item) => item.isDetection).length / results.length) * 100,
  );

  return (
    <section className="simulator-panel space-y-5 rounded-3xl p-6">
      <div>
        <h2 className="text-2xl font-semibold text-whiteHull">Sonar Interpretation Lab</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">
          A confidence heuristic triages sonar echoes before human review. Adjust the threshold
          to see how sensitivity changes detection outcomes.
        </p>
      </div>

      {/* Radar + controls row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left — animated radar display */}
        <div className="flex flex-col items-center gap-3">
          <p className="self-start text-xs font-semibold uppercase tracking-widest text-pacificCyan">
            Sonar Scope — Active Sweep
          </p>
          <RadarDisplay signals={results} threshold={threshold} />
          <div className="grid w-full grid-cols-2 gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-pacificCyan" />
              Detected contact
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-slate-600" />
              Below threshold
            </div>
          </div>
        </div>

        {/* Right — controls */}
        <div className="space-y-4">
          {/* View mode toggle */}
          <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs text-slate-200">
            <span className="font-semibold text-pacificCyan">View:</span>
            {[
              ['classification', 'All Signals'],
              ['detections',     'Detections Only'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                className={`rounded-full px-3 py-1.5 transition ${
                  viewMode === id ? 'bg-pacificCyan text-slate-950' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Threshold slider */}
          <label className="glass-card block rounded-2xl p-4 text-sm text-slate-300">
            Detection Threshold:
            <span className="ml-1 font-semibold text-pacificCyan">{threshold.toFixed(2)}</span>
            <input
              type="range"
              min="0.35"
              max="0.8"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="mt-2 w-full accent-pacificCyan"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>Sensitive (0.35)</span>
              <span>Selective (0.80)</span>
            </div>
          </label>

          {/* Detection rate */}
          <div className="metric-card flex items-center justify-between rounded-2xl p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Detection Rate</p>
              <p className="mt-0.5 text-2xl font-bold text-pacificCyan">{detectionRate}%</p>
            </div>
            <div className="h-14 w-14 overflow-hidden rounded-full border border-pacificCyan/30">
              <div
                className="w-full rounded-full bg-pacificCyan/20 transition-all duration-500"
                style={{ height: `${detectionRate}%`, marginTop: `${100 - detectionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Signal cards */}
      <div className="grid gap-2 md:grid-cols-2">
        {results
          .filter((item) => (viewMode === 'detections' ? item.isDetection : true))
          .map((item, idx) => (
            <motion.article
              key={`${item.distance}-${idx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="glass-card rounded-xl p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-whiteHull">{item.label}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.isDetection
                      ? 'bg-pacificCyan/20 text-pacificCyan'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.isDetection ? 'DETECTED' : 'FILTERED'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Distance: {item.distance} km · Strength: {item.strength.toFixed(2)} · Confidence: {(item.confidence * 100).toFixed(0)}%
              </p>
              <StrengthBar strength={item.strength} isDetected={item.isDetection} />
            </motion.article>
          ))}
      </div>

    </section>
  );
}
