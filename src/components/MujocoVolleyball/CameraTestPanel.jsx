import { useEffect, useMemo, useRef, useState } from 'react';
import { FRAME_RATES, NEAR_LINE, RESOLUTIONS, SHUTTERS, evaluate, lineTestServe, makeRng, recordServe } from './lineCamera.js';

const ACCENT = '#facc15';
const SERVES = 120;

const cm = (m) => (Number.isFinite(m) ? `${(m * 100).toFixed(1)} cm` : '—');
const pct = (f) => (Number.isFinite(f) ? `${Math.round(f * 100)}%` : '—');

function Chip({ active, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1 text-xs transition disabled:opacity-40 ${
        active ? 'bg-yellow-400 text-slate-900' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * "What can an ordinary camera do?" — records serves aimed at the lines with
 * MuJoCo, films them with a virtual line camera at several frame rates, and
 * scores the landing-point estimate against the true contact point.
 */
export default function CameraTestPanel({ simRef, disabled, onRunningChange }) {
  const [records, setRecords] = useState([]);
  const [progress, setProgress] = useState(null);
  const [resolution, setResolution] = useState('1080p');
  const [shutter, setShutter] = useState(60);
  const cancelRef = useRef(false);

  // Stop recording if the lab unmounts (the MuJoCo sim is disposed with it).
  useEffect(() => () => {
    cancelRef.current = true;
  }, []);

  const record = () => {
    const sim = simRef.current;
    if (!sim) return;
    cancelRef.current = false;
    const rng = makeRng(Date.now() % 100000);
    const out = [];
    let tries = 0;
    onRunningChange(true);
    setProgress(0);
    const chunk = () => {
      if (cancelRef.current) return;
      for (let i = 0; i < 3 && out.length < SERVES && tries < SERVES * 3; i++, tries++) {
        const rec = recordServe(sim, sim.aim(lineTestServe(rng)));
        if (rec) out.push(rec);
      }
      setProgress(out.length);
      if (out.length < SERVES && tries < SERVES * 3) {
        setTimeout(chunk, 0);
      } else {
        setRecords(out);
        setProgress(null);
        onRunningChange(false);
      }
    };
    setTimeout(chunk, 0);
  };

  const results = useMemo(
    () =>
      records.length
        ? FRAME_RATES.map((fps) => ({ fps, ...evaluate(records, { fps, shutter: SHUTTERS[shutter].s, resolution }) }))
        : [],
    [records, resolution, shutter],
  );
  const first = results[0];
  const recording = progress !== null;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
            Camera test: what can a 1080p / 30 fps camera call?
          </p>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">
            Serves are aimed within 25 cm of a line and flown in MuJoCo. A virtual camera on the extension of the
            nearest line films each one. The landing point is estimated from the frames alone and compared with
            MuJoCo&apos;s true contact point. Only landings within {NEAR_LINE * 100} cm of a line are scored.
          </p>
        </div>
        <button
          type="button"
          onClick={record}
          disabled={disabled || recording}
          className="rounded-xl bg-yellow-400 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-40"
        >
          {recording ? `Recording ${progress}/${SERVES}…` : records.length ? `Re-record ${SERVES} serves` : `Record ${SERVES} line serves`}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Resolution</span>
          {Object.entries(RESOLUTIONS).map(([k, r]) => (
            <Chip key={k} active={resolution === k} onClick={() => setResolution(k)}>{r.label}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Shutter</span>
          {Object.entries(SHUTTERS).map(([k, s]) => (
            <Chip key={k} active={shutter === Number(k)} onClick={() => setShutter(Number(k))}>{s.label}</Chip>
          ))}
        </div>
      </div>

      {results.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl bg-slate-900/70">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Frame rate</th>
                  <th className="px-3 py-2 font-medium">Camera error<br />median / 95%</th>
                  <th className="px-3 py-2 font-medium">Error vs first touch<br />median / 95%</th>
                  <th className="px-3 py-2 font-medium">Calls right<br />(all / within 10 cm)</th>
                  <th className="px-3 py-2 font-medium">Too close to call</th>
                  <th className="px-3 py-2 font-medium">Calls made, right</th>
                  <th className="px-3 py-2 font-medium">Max blur</th>
                </tr>
              </thead>
              <tbody className="font-mono text-slate-300">
                {results.map((r) => (
                  <tr key={r.fps} className={`border-t border-slate-800 ${r.fps === 30 ? 'bg-yellow-400/5' : ''}`}>
                    <td className="px-3 py-1.5 font-sans text-slate-200">{r.fps} fps</td>
                    <td className="px-3 py-1.5">{cm(r.camMedian)} / {cm(r.camP95)}</td>
                    <td className="px-3 py-1.5">{cm(r.median)} / {cm(r.p95)}</td>
                    <td className="px-3 py-1.5">{pct(r.accuracy)} / {pct(r.nearAccuracy)} <span className="text-slate-500">({r.nearN})</span></td>
                    <td className="px-3 py-1.5">{pct(r.tooClose)}</td>
                    <td className="px-3 py-1.5">{pct(r.decidedAccuracy)}</td>
                    <td className="px-3 py-1.5">{Math.round(r.maxStreak)} px</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {first.n} landings scored{first.missed ? `, ${first.missed} with too few frames to estimate` : ''}. Errors are
            measured across the line. &quot;Too close to call&quot; means the estimate is nearer the line than that frame
            rate&apos;s 95% error, so the system declines to call it; &quot;calls made, right&quot; is the accuracy of the rest.
          </p>
          <div className="mt-3 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3 text-sm text-slate-300">
            <span className="font-semibold text-yellow-200">Skid bias: </span>
            in this simulation the ball stays on the floor for about {first.contactMs.toFixed(0)} ms and skids about{' '}
            {cm(first.skid)} while squashed. A camera sees the middle of that contact; the rule judges the first touch. On
            these serves that puts the visible bounce {cm(first.skidBias)} further out on average, at any frame rate. A
            better camera cannot remove it; the estimator has to model the skid, from footage of real bounces.
          </div>
        </>
      )}

      <ul className="mt-4 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-400">
        <li>
          <span className="text-slate-200">Camera:</span> pinhole, 60° wide, 1.5 m high and 3 m beyond the end of the
          line, looking along it like a line judge. Calibration (position and lens) is assumed known, as it would be from
          the court lines.
        </li>
        <li>
          <span className="text-slate-200">Each frame</span> records the centre of the ball&apos;s blur streak over the
          exposure, plus detector noise of 0.5 px (at 1080p) growing by 5% of the streak length. Frames start at a random
          moment, so the bounce falls anywhere between two frames.
        </li>
        <li>
          <span className="text-slate-200">Estimate:</span> split the track at its lowest image point, fit a curve to
          0.12 s of frames on each side, take where the two curves meet as the bounce, and project it onto the floor.
        </li>
        <li>
          <span className="text-slate-200">Not modelled:</span> a detector that loses a long streak against the floor,
          rolling-shutter skew, lens distortion, players blocking the view, and calibration error. Real numbers will be
          worse; check them against labelled high-speed footage.
        </li>
      </ul>
    </div>
  );
}
