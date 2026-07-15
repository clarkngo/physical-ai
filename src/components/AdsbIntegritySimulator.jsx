import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * ADS-B Out integrity lab.
 * Real receivers cross-check DF=17 Extended Squitter fields (NIC / NACp / SIL)
 * against independent MLAT / primary radar. Low correlation + high NIC claim
 * is a classic spoof / ghost signature.
 */

const TRACKS = [
  {
    callsign: 'ASA412',
    icao: 'A45BC1',
    rangeNm: 4.2,
    altFt: 3200,
    nic: 8,
    nacp: 9,
    sil: 3,
    mlatCorr: 0.97,
    primaryHit: true,
    df17RateHz: 2.0,
  },
  {
    callsign: 'UAL????',
    icao: 'AABC12',
    rangeNm: 7.8,
    altFt: 6100,
    nic: 9, // claimed high integrity
    nacp: 10,
    sil: 3,
    mlatCorr: 0.18, // no geometry match
    primaryHit: false,
    df17RateHz: 6.5, // abnormally high squitter rate
  },
  {
    callsign: 'DAL215',
    icao: 'A71F02',
    rangeNm: 11.4,
    altFt: 9000,
    nic: 7,
    nacp: 8,
    sil: 3,
    mlatCorr: 0.91,
    primaryHit: true,
    df17RateHz: 2.0,
  },
  {
    callsign: 'N999XX',
    icao: 'A00001',
    rangeNm: 9.1,
    altFt: 4500,
    nic: 8,
    nacp: 9,
    sil: 2,
    mlatCorr: 0.12,
    primaryHit: false,
    df17RateHz: 8.0,
  },
  {
    callsign: 'JBU118',
    icao: 'A12D88',
    rangeNm: 15.6,
    altFt: 12000,
    nic: 6,
    nacp: 7,
    sil: 3,
    mlatCorr: 0.84,
    primaryHit: true,
    df17RateHz: 1.9,
  },
  {
    callsign: 'SWA447',
    icao: 'A9E441',
    rangeNm: 18.2,
    altFt: 14000,
    nic: 8,
    nacp: 8,
    sil: 3,
    mlatCorr: 0.93,
    primaryHit: true,
    df17RateHz: 2.1,
  },
  {
    callsign: 'GHOST7',
    icao: 'ADF00D',
    rangeNm: 6.4,
    altFt: 2800,
    nic: 10,
    nacp: 11,
    sil: 3,
    mlatCorr: 0.05,
    primaryHit: false,
    df17RateHz: 12.0,
  },
  {
    callsign: 'FFT902',
    icao: 'A33C10',
    rangeNm: 22.0,
    altFt: 16000,
    nic: 7,
    nacp: 8,
    sil: 3,
    mlatCorr: 0.88,
    primaryHit: true,
    df17RateHz: 2.0,
  },
];

/** Integrity score 0–1. Low = more suspicious. */
function integrityScore(t) {
  const nicOk = Math.min(1, t.nic / 8);
  const nacOk = Math.min(1, t.nacp / 9);
  const ratePenalty = t.df17RateHz > 3.5 ? 0.35 : t.df17RateHz > 2.5 ? 0.15 : 0;
  const primaryBonus = t.primaryHit ? 0.15 : -0.25;
  return Math.max(
    0,
    Math.min(1, t.mlatCorr * 0.55 + nicOk * 0.15 + nacOk * 0.1 + primaryBonus - ratePenalty + 0.1),
  );
}

function classify(score, track) {
  if (score >= 0.72 && track.primaryHit) {
    return { label: 'Validated (ADS-B + radar/MLAT)', tier: 'ok' };
  }
  if (score >= 0.45) {
    return { label: 'Surveillance unmatched — review', tier: 'suspect' };
  }
  return { label: 'Ghost / injection candidate', tier: 'ghost' };
}

function ScopeDisplay({ tracks, threshold }) {
  const CX = 50;
  const CY = 50;
  const MAX_R = 42;

  const blips = tracks.map((t, i) => {
    const angleDeg = 20 + i * ((340 - 20) / Math.max(tracks.length - 1, 1));
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const r = (t.rangeNm / 28) * MAX_R;
    return {
      ...t,
      cx: CX + r * Math.cos(rad),
      cy: CY + r * Math.sin(rad),
      flagged: t.score < threshold,
    };
  });

  return (
    <div className="relative mx-auto" style={{ width: 220, height: 220 }}>
      <div
        className="absolute inset-0 overflow-hidden rounded-full radar-sweep-div"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, rgba(56,189,248,0) 0deg, rgba(56,189,248,0) 290deg, rgba(56,189,248,0.06) 320deg, rgba(56,189,248,0.22) 350deg, rgba(56,189,248,0.55) 358deg, rgba(56,189,248,0) 360deg)',
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx={CX} cy={CY} r={48} fill="rgba(0,5,15,0.92)" />
        {[12, 24, 36].map((r) => (
          <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="rgba(56,189,248,0.18)" strokeWidth="0.4" />
        ))}
        {[0, 45, 90, 135].map((angleDeg) => {
          const rad = (angleDeg * Math.PI) / 180;
          return (
            <line
              key={angleDeg}
              x1={CX + 44 * Math.cos(rad)}
              y1={CY - 44 * Math.sin(rad)}
              x2={CX - 44 * Math.cos(rad)}
              y2={CY + 44 * Math.sin(rad)}
              stroke="rgba(56,189,248,0.14)"
              strokeWidth="0.3"
            />
          );
        })}
        {blips.map((blip, i) => (
          <motion.circle
            key={i}
            cx={blip.cx}
            cy={blip.cy}
            fill={blip.flagged ? 'rgba(248,113,113,1)' : 'rgba(56,189,248,1)'}
            animate={{
              opacity: [1, 0.4, 1],
              r: [2.4, 3.2, 2.4],
            }}
            transition={{ duration: 1.8, delay: i * 0.25, repeat: Infinity }}
          />
        ))}
        <circle cx={CX} cy={CY} r={1.5} fill="rgba(56,189,248,0.8)" />
        <circle cx={CX} cy={CY} r={46} fill="none" stroke="rgba(56,189,248,0.35)" strokeWidth="0.7" />
        <text x="50" y="96" fontSize="3.5" fill="rgba(148,163,184,0.55)" textAnchor="middle">
          ASR / ADS-B  ·  25 NM
        </text>
      </svg>
    </div>
  );
}

export default function AdsbIntegritySimulator() {
  const [threshold, setThreshold] = useState(0.55);
  const [viewMode, setViewMode] = useState('all');
  const [requirePrimary, setRequirePrimary] = useState(true);

  const results = useMemo(
    () =>
      TRACKS.map((t) => {
        const score = integrityScore(t);
        const { label, tier } = classify(score, t);
        const flagged =
          score < threshold || (requirePrimary && !t.primaryHit && score < 0.85);
        return { ...t, score, label, tier, flagged };
      }),
    [threshold, requirePrimary],
  );

  const ghostCount = results.filter((r) => r.flagged).length;
  const validatedCount = results.filter((r) => !r.flagged).length;

  return (
    <section id="lab-adsb" className="simulator-panel space-y-5 rounded-3xl p-6">
      <div>
        <h2 className="text-2xl font-semibold text-whiteHull">ADS-B Integrity Lab</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">
          DF=17 Extended Squitter claims NIC / NACp quality, but ATC fuses that with multilateration
          and primary radar. High claimed integrity with low MLAT correlation is the classic
          ghost-injection pattern.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col items-center gap-3">
          <p className="self-start text-xs font-semibold uppercase tracking-widest text-sky-400">
            Terminal surveillance fusion
          </p>
          <ScopeDisplay tracks={results} threshold={threshold} />
          <div className="grid w-full grid-cols-2 gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
              Correlated track
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
              Integrity alert
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs text-slate-200">
            <span className="font-semibold text-sky-400">View:</span>
            {[
              ['all', 'All tracks'],
              ['ghosts', 'Alerts only'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                className={`rounded-full px-3 py-1.5 transition ${
                  viewMode === id ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="glass-card block rounded-2xl p-4 text-sm text-slate-300">
            Fusion score threshold:{' '}
            <span className="font-semibold text-sky-400">{threshold.toFixed(2)}</span>
            <input
              type="range"
              min="0.3"
              max="0.85"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="mt-2 w-full accent-sky-400"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>Accept more squitters</span>
              <span>Demand stronger fusion</span>
            </div>
          </label>

          <label className="glass-card flex cursor-pointer items-center justify-between rounded-2xl p-4 text-sm text-slate-300">
            <span>
              Require primary / MLAT hit
              <span className="mt-0.5 block text-xs text-slate-500">
                Fail tracks with no independent range/bearing
              </span>
            </span>
            <input
              type="checkbox"
              checked={requirePrimary}
              onChange={(e) => setRequirePrimary(e.target.checked)}
              className="h-4 w-4 accent-sky-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="metric-card rounded-2xl p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Validated</p>
              <p className="text-2xl font-bold text-sky-400">{validatedCount}</p>
            </div>
            <div className="metric-card rounded-2xl p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Integrity alerts</p>
              <p className="text-2xl font-bold text-rose-400">{ghostCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {results
          .filter((item) => (viewMode === 'ghosts' ? item.flagged : true))
          .map((item, idx) => (
            <motion.article
              key={item.icao}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.04 }}
              className="glass-card rounded-xl p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-whiteHull">
                    {item.callsign}{' '}
                    <span className="font-mono text-xs text-slate-500">{item.icao}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.label}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.flagged
                      ? 'bg-rose-400/20 text-rose-300'
                      : 'bg-sky-400/20 text-sky-300'
                  }`}
                >
                  {item.flagged ? 'ALERT' : 'OK'}
                </span>
              </div>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-400">
                {item.rangeNm.toFixed(1)} NM · FL{String(Math.round(item.altFt / 100)).padStart(3, '0')} · NIC{' '}
                {item.nic} · NACp {item.nacp} · SIL {item.sil}
                <br />
                MLAT {(item.mlatCorr * 100).toFixed(0)}% · primary {item.primaryHit ? 'HIT' : 'MISS'} · DF17{' '}
                {item.df17RateHz.toFixed(1)} Hz · score {(item.score * 100).toFixed(0)}%
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className={`h-full rounded-full ${item.flagged ? 'bg-rose-400' : 'bg-sky-400'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.score * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.article>
          ))}
      </div>
    </section>
  );
}
