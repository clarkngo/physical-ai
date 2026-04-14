// TelemetryTicker — scrolling live data feed, Physical AI style

const TICKS = [
  { status: 'OK',   icon: '🛳️', text: 'MV COLUMBIA · SPD 18.4 kn · HDG 247° · AI ROUTING ACTIVE' },
  { status: 'OK',   icon: '📡', text: 'SONAR SCOPE CLEAR · NO OBSTACLES WITHIN 2.0 km' },
  { status: 'GOOD', icon: '⛽', text: 'FUEL EFFICIENCY ↑22% vs BASELINE · CO₂ SAVED: 41.2 t TODAY' },
  { status: 'INFO', icon: '🌊', text: 'SEA STATE 2 · WAVE HT 1.2 m · WIND 14 kn SW · VIS GOOD' },
  { status: 'WARN', icon: '🐋', text: 'WHALE DETECTION 47.64°N 122.41°W · ROUTE ADJUSTED · CLEAR' },
  { status: 'OK',   icon: '🤖', text: 'COLLISION RISK: LOW 0.03 · POLICY: BALANCED · CPA 1.8 nm' },
  { status: 'INFO', icon: '📊', text: 'AIS SECTOR: 7 VESSELS TRACKED · ALL CPA PARAMETERS NOMINAL' },
  { status: 'OK',   icon: '🧭', text: 'ROUTE OPT: SEGMENT 4/7 · ETA IMPROVEMENT +0.82 h vs BASELINE' },
  { status: 'INFO', icon: '🌐', text: 'MARITIME AI CENTER SEATTLE · COHORT 2026 · 12 STUDENTS ACTIVE' },
  { status: 'GOOD', icon: '✅', text: 'POLICY COMPLIANCE: 88% · SAFETY MARGIN: WITHIN BOUNDS' },
];

const STATUS_STYLE = {
  OK:   'text-pacificCyan',
  GOOD: 'text-emerald-400',
  WARN: 'text-amber-400',
  INFO: 'text-slate-400',
};

// Duplicate for seamless infinite scroll (CSS -50% trick)
const ALL_TICKS = [...TICKS, ...TICKS];

export default function TelemetryTicker() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-pacificCyan/20 bg-slate-950/70 backdrop-blur-sm"
      title="Hover to pause"
    >
      {/* Header strip */}
      <div className="flex items-center gap-2 border-b border-pacificCyan/15 px-4 py-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pacificCyan opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-pacificCyan" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-pacificCyan">
          Live Telemetry Feed
        </span>
        <span className="ml-auto text-xs text-slate-500">Puget Sound AIS · Real-time</span>
      </div>

      {/* Scrolling track */}
      <div className="py-2">
        <div className="ticker-track flex min-w-max gap-0">
          {ALL_TICKS.map((tick, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 px-5 text-xs"
            >
              <span className="text-base leading-none">{tick.icon}</span>
              <span
                className={`font-mono font-medium tracking-wide ${STATUS_STYLE[tick.status]}`}
              >
                {tick.text}
              </span>
              {/* Separator */}
              <span className="mx-1 text-pacificCyan/30">◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
