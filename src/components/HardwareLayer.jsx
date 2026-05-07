import { motion } from 'framer-motion';

/* ── Technology data ─────────────────────────────────────────── */
const TECHNOLOGIES = [
  {
    id:       'hot-stamping',
    codename: 'SHIELD PROTOCOL',
    title:    'Hot Stamping',
    subtitle: 'Structural Skeleton',
    accent:   '#f59e0b',          // amber
    dimAccent:'rgba(245,158,11,0.12)',
    icon: (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <polygon points="20,3 35,12 35,28 20,37 5,28 5,12"
          stroke="#f59e0b" strokeWidth="1.5" fill="rgba(245,158,11,0.1)" />
        <polygon points="20,9 30,15 30,25 20,31 10,25 10,15"
          stroke="#f59e0b" strokeWidth="0.8" fill="rgba(245,158,11,0.06)" strokeDasharray="2 2" />
        <circle cx="20" cy="20" r="3.5" fill="#f59e0b" opacity="0.9" />
        <line x1="20" y1="9" x2="20" y2="14" stroke="#f59e0b" strokeWidth="1" />
        <line x1="20" y1="26" x2="20" y2="31" stroke="#f59e0b" strokeWidth="1" />
      </svg>
    ),
    description:
      'A press-hardening process that heats boron steel blanks to 900 °C, then simultaneously forms and quenches them in water-cooled dies. The rapid cooling locks the microstructure into martensite, producing ultra-high-strength structural members that give AI vehicles a predictable, crash-optimised skeleton.',
    metrics: [
      { label: 'Yield Strength', value: '1500 MPa', primary: true  },
      { label: 'Weight Reduction', value: '–22 %',  primary: false },
      { label: 'Process Temp.',  value: '900 °C',   primary: false },
      { label: 'Thickness Ctrl', value: '±0.1 mm',  primary: false },
    ],
    tags: ['Press Hardening', 'Martensite', 'Crash Safety', 'Boron Steel'],
  },
  {
    id:       'hydroforming',
    codename: 'FLOW ENGINE',
    title:    'Hydroforming',
    subtitle: 'Fluid Geometry Engine',
    accent:   '#00a3e0',          // pacificCyan
    dimAccent:'rgba(0,163,224,0.10)',
    icon: (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <ellipse cx="20" cy="20" rx="14" ry="9"
          stroke="#00a3e0" strokeWidth="1.5" fill="rgba(0,163,224,0.08)" />
        <path d="M10 20 Q14 14 20 13 Q26 14 30 20 Q26 26 20 27 Q14 26 10 20Z"
          stroke="#00a3e0" strokeWidth="0.8" fill="rgba(0,163,224,0.07)" strokeDasharray="2 2" />
        <circle cx="20" cy="20" r="3.5" fill="#00a3e0" opacity="0.9" />
        {/* flow arrows */}
        <path d="M6 20 L11 20" stroke="#00a3e0" strokeWidth="1.2" markerEnd="url(#arr)" />
        <path d="M34 20 L29 20" stroke="#00a3e0" strokeWidth="1.2" />
      </svg>
    ),
    description:
      'Hydraulic fluid pressurised to 400 MPa forces metal tube or sheet blanks into die cavities with contours impossible to achieve in conventional stamping. Hollow, seamless cross-sections emerge in a single operation — eliminating assembly welds in load-bearing members and producing continuous, optimised load paths for AI platform frames.',
    metrics: [
      { label: 'Fluid Pressure',   value: '400 MPa', primary: true  },
      { label: 'Weight Reduction', value: '–15 %',   primary: false },
      { label: 'Weld Reduction',   value: '–40 %',   primary: false },
      { label: 'Profile Accuracy', value: '±0.05 mm',primary: false },
    ],
    tags: ['Tubular Hydroform', 'Hollow Section', 'Seamless Frame', 'Load-Path'],
  },
  {
    id:       'twb-laser',
    codename: 'PRECISION LAYER',
    title:    'TWB / Laser Welding',
    subtitle: 'Robotic Assembly Layer',
    accent:   '#a78bfa',          // violet
    dimAccent:'rgba(167,139,250,0.10)',
    icon: (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        {/* two dissimilar blanks */}
        <rect x="4"  y="15" width="13" height="10" rx="1"
          stroke="#a78bfa" strokeWidth="1.5" fill="rgba(167,139,250,0.10)" />
        <rect x="23" y="15" width="13" height="10" rx="1"
          stroke="#a78bfa" strokeWidth="1.0" fill="rgba(167,139,250,0.06)"
          strokeDasharray="2 2" />
        {/* laser beam */}
        <line x1="20" y1="4" x2="20" y2="15"
          stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
        <circle cx="20" cy="4" r="2" fill="#a78bfa" />
        {/* weld joint */}
        <rect x="17" y="15" width="6" height="10" rx="0.5" fill="rgba(167,139,250,0.25)"
          stroke="#a78bfa" strokeWidth="0.8" />
        {/* sparks */}
        {[[18,26],[20,28],[22,26]].map(([sx,sy],i)=>(
          <line key={i} x1={sx} y1={sy} x2={sx+(i-1)*2} y2={sy+4}
            stroke="#a78bfa" strokeWidth="0.8" />
        ))}
      </svg>
    ),
    description:
      'Tailor Welded Blanks (TWB) fuse dissimilar steel grades or thicknesses at the blank stage — placing 1500 MPa material precisely where AI load-simulation says it is needed, and lighter grades everywhere else. Robotic laser-welding heads maintain a joint gap under 0.1 mm at 10 m/min, delivering assembly precision that matches digital twin tolerances.',
    metrics: [
      { label: 'Joint Gap',     value: '< 0.1 mm',    primary: true  },
      { label: 'Weld Speed',    value: '10 m / min',  primary: false },
      { label: 'Material Grades', value: '≤ 6 / blank', primary: false },
      { label: 'Weight Savings', value: '–18 %',      primary: false },
    ],
    tags: ['Tailor Welded Blank', 'Dissimilar Materials', 'Robotic Laser', 'Digital Twin'],
  },
];

/* ── Animated grid / scanline background ────────────────────── */
function CyberBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {/* dot-grid */}
      <div className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(0,163,224,0.18) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* scanlines */}
      <div className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.10) 3px, rgba(0,0,0,0.10) 4px)',
        }}
      />
      {/* top-left corner brackets */}
      <svg className="absolute top-4 left-4 w-10 h-10" viewBox="0 0 40 40" fill="none">
        <path d="M2 20 L2 2 L20 2" stroke="rgba(0,163,224,0.3)" strokeWidth="1.5" />
      </svg>
      <svg className="absolute top-4 right-4 w-10 h-10" viewBox="0 0 40 40" fill="none">
        <path d="M38 20 L38 2 L20 2" stroke="rgba(0,163,224,0.3)" strokeWidth="1.5" />
      </svg>
      <svg className="absolute bottom-4 left-4 w-10 h-10" viewBox="0 0 40 40" fill="none">
        <path d="M2 20 L2 38 L20 38" stroke="rgba(0,163,224,0.3)" strokeWidth="1.5" />
      </svg>
      <svg className="absolute bottom-4 right-4 w-10 h-10" viewBox="0 0 40 40" fill="none">
        <path d="M38 20 L38 38 L20 38" stroke="rgba(0,163,224,0.3)" strokeWidth="1.5" />
      </svg>
      {/* ambient gradient blob */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-48
                      rounded-full bg-pacificCyan/5 blur-3xl" />
    </div>
  );
}

/* ── Metric readout ──────────────────────────────────────────── */
function Metric({ label, value, primary, accent }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 flex flex-col gap-0.5 ${
      primary
        ? 'border'
        : 'bg-slate-900/60 border border-slate-700/40'
    }`}
      style={primary ? {
        backgroundColor: accent + '12',
        borderColor:     accent + '55',
      } : {}}>
      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
        {label}
      </span>
      <span
        className="text-base font-bold font-mono leading-tight"
        style={{ color: primary ? accent : '#cbd5e1' }}>
        {value}
      </span>
    </div>
  );
}

/* ── Tech card ───────────────────────────────────────────────── */
const cardVariants = {
  hidden:   { opacity: 0, y: 28 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] },
  }),
};

function TechCard({ tech, index }) {
  const { accent, dimAccent } = tech;
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      whileHover={{ y: -5, transition: { duration: 0.22 } }}
      className="relative flex flex-col rounded-2xl overflow-hidden
                 border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm"
      style={{ boxShadow: `0 0 0 1px ${accent}22, 0 8px 32px rgba(0,0,0,0.45)` }}
    >
      {/* top accent bar */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}44)` }} />

      {/* left glow strip on hover */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
        style={{ background: `linear-gradient(180deg, ${accent}88, ${accent}22)` }} />

      <div className="flex flex-col gap-5 p-6 flex-1">
        {/* header row */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 rounded-xl"
            style={{ backgroundColor: dimAccent, boxShadow: `0 0 12px ${accent}22` }}>
            {tech.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[9px] font-bold tracking-[0.22em] font-mono"
                style={{ color: accent }}>
                {tech.codename}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white leading-tight">{tech.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5 tracking-wide">{tech.subtitle}</p>
          </div>
        </div>

        {/* description */}
        <p className="text-sm leading-relaxed text-slate-400 flex-1">{tech.description}</p>

        {/* Physical AI Metrics */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${accent}44, transparent)` }} />
            <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Physical AI Metrics
            </span>
            <div className="h-px flex-1" style={{ background: `linear-gradient(270deg, ${accent}44, transparent)` }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tech.metrics.map(m => (
              <Metric key={m.label} {...m} accent={accent} />
            ))}
          </div>
        </div>

        {/* tags */}
        <div className="flex flex-wrap gap-1.5">
          {tech.tags.map(tag => (
            <span key={tag}
              className="rounded-full px-2.5 py-0.5 text-[10px] font-medium
                         border border-slate-700 bg-slate-800/60 text-slate-400">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Section header ──────────────────────────────────────────── */
function SectionHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 text-center max-w-2xl mx-auto px-4">
      {/* eyebrow */}
      <div className="inline-flex items-center gap-2 mb-4">
        <span className="h-px w-8 bg-pacificCyan/50" />
        <span className="text-[10px] font-bold tracking-[0.28em] uppercase text-pacificCyan font-mono">
          Myoungshin Industry · Manufacturing Layer
        </span>
        <span className="h-px w-8 bg-pacificCyan/50" />
      </div>

      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
        The Hardware Layer:
        <br />
        <span className="bg-gradient-to-r from-amber-400 via-pacificCyan to-violet-400
                         bg-clip-text text-transparent">
          Industrial Embodiment
        </span>
      </h2>

      <p className="mt-4 text-sm leading-relaxed text-slate-400 max-w-xl mx-auto">
        Before software can navigate, plan, or perceive — the physical structure that
        carries every sensor and actuator must survive the real world. These three
        manufacturing processes form the industrial substrate of Physical AI.
      </p>

      {/* status bar */}
      <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-slate-700
                      bg-slate-900/60 px-4 py-1.5 text-xs text-slate-500 font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>3 processes active</span>
        <span className="text-slate-700">·</span>
        <span className="text-pacificCyan">structural integrity: NOMINAL</span>
      </div>
    </motion.div>
  );
}

/* ── Comparison bar at bottom ────────────────────────────────── */
const COMPARE = [
  { label: 'Max Strength',  bars: [100, 58, 75],  unit: '% of 1500 MPa' },
  { label: 'Weight Saving', bars: [73,  50, 60],   unit: '% of –22 % max' },
  { label: 'Weld Reduction',bars: [40,  100, 65],  unit: '% of –40 % max' },
];

function CompareBar({ label, bars, unit }) {
  const colors = ['#f59e0b', '#00a3e0', '#a78bfa'];
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-600 font-mono">{unit}</span>
      </div>
      <div className="flex flex-col gap-1">
        {bars.map((pct, i) => (
          <motion.div key={i} className="flex items-center gap-2">
            <div className="w-24 text-right text-[10px] font-bold font-mono truncate"
              style={{ color: colors[i] }}>
              {TECHNOLOGIES[i].title.split(' ')[0]}
            </div>
            <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: colors[i] }}
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="w-8 text-[10px] font-mono text-slate-500">{pct}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Root export ─────────────────────────────────────────────── */
export default function HardwareLayer() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-800/60
                        bg-slate-950 px-5 py-12 md:px-10 md:py-16"
      style={{ boxShadow: '0 0 0 1px rgba(0,163,224,0.08), 0 24px 80px rgba(0,0,0,0.5)' }}>

      <CyberBackground />

      {/* all content sits above the background */}
      <div className="relative z-10 flex flex-col gap-12">

        <SectionHeader />

        {/* 3-column card grid */}
        <div className="grid gap-5 md:grid-cols-3">
          {TECHNOLOGIES.map((tech, i) => (
            <TechCard key={tech.id} tech={tech} index={i} />
          ))}
        </div>

        {/* comparison panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-slate-800/70 bg-slate-900/60
                     backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="h-px flex-1 bg-slate-800" />
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-slate-500 font-mono">
              Process Comparison Matrix
            </span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {COMPARE.map(c => <CompareBar key={c.label} {...c} />)}
          </div>

          {/* legend */}
          <div className="mt-5 flex flex-wrap justify-center gap-4 border-t border-slate-800 pt-4">
            {TECHNOLOGIES.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.accent }} />
                {t.title}
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}
