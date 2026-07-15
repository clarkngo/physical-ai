const TICKS = [
  { status: 'OK',   icon: '✈️', text: 'UAL782 · FL340 · SPD 458 kt · HDG 271° · ADS-B LOCKED' },
  { status: 'OK',   icon: '📡', text: 'ASR-9 SECTOR CLEAR · NO UNCORRELATED TRACKS WITHIN 12 nm' },
  { status: 'GOOD', icon: '⛽', text: 'FUEL UPLIFT B11 COMPLETE · 18.4k lb · CPS INTEGRITY HASH OK' },
  { status: 'INFO', icon: '🌤', text: 'METAR KSEA · VIS 10 SM · WIND 240/12 · CEILING 8,000' },
  { status: 'WARN', icon: '🛸', text: 'ADS-B GHOST CANDIDATE · 47.45°N 122.31°W · MLAT REJECT · CLEAR' },
  { status: 'OK',   icon: '🤖', text: 'CONFLICT PROBE: LOW 0.02 · TCas RA NOT REQUIRED · CPA 3.1 nm' },
  { status: 'INFO', icon: '📊', text: 'SURFACE MOVEMENT: 14 TARGETS · ALL SMR CORRELATED TO ADS-B' },
  { status: 'OK',   icon: '🧭', text: 'STAR OPT: HAWKZ4 · ETA IMPROVEMENT +4.2 min vs BASELINE' },
  { status: 'INFO', icon: '🌐', text: 'AVIATION CPS LAB · COHORT 2026 · 12 STUDENTS ACTIVE' },
  { status: 'GOOD', icon: '✅', text: 'FMS INTEGRITY: 96% · NAV DATABASE CYCLE CURRENT · BOUNDS OK' },
];

const STATUS_STYLE = {
  OK:   'text-sky-400',
  GOOD: 'text-emerald-400',
  WARN: 'text-amber-400',
  INFO: 'text-slate-400',
};

const ALL_TICKS = [...TICKS, ...TICKS];

export default function AviationTelemetryTicker() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-sky-500/20 bg-slate-950/70 backdrop-blur-sm"
      title="Hover to pause"
    >
      <div className="flex items-center gap-2 border-b border-sky-500/15 px-4 py-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Live Telemetry Feed
        </span>
        <span className="ml-auto text-xs text-slate-500">KSEA ADS-B / SMR · Real-time</span>
      </div>

      <div className="py-2">
        <div className="ticker-track flex min-w-max gap-0">
          {ALL_TICKS.map((tick, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-5 text-xs">
              <span className="text-base leading-none">{tick.icon}</span>
              <span className={`font-mono font-medium tracking-wide ${STATUS_STYLE[tick.status]}`}>
                {tick.text}
              </span>
              <span className="mx-1 text-sky-400/30">◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
