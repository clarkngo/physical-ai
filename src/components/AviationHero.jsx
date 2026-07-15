import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const STATS = [
  { label: 'Flights Monitored', value: '18,420' },
  { label: 'Approaches Optimized', value: '6,812' },
  { label: 'Fuel Saved', value: '2.1M gal' },
  { label: 'Anomalies Flagged', value: '847' },
];

export default function AviationHero() {
  return (
    <section className="glass-card relative overflow-hidden rounded-2xl px-6 py-10 md:px-10 md:py-12">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-950/40 via-transparent to-slate-900/60" />
      <div className="relative z-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">
          Aviation CPS · Digital Twin
        </p>
        <motion.h1
          className="mt-2 text-3xl font-semibold tracking-tight text-whiteHull md:text-4xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Airport Cyber-Physical Systems
        </motion.h1>
        <motion.p
          className="mt-4 text-sm leading-relaxed text-slate-300 md:text-base"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          Explore avionics, surveillance, ramp automation, and maintenance security through an
          interactive airport digital twin — from ADS-B integrity to FMS navigation hardening.
        </motion.p>
        <motion.div
          className="mt-6 flex flex-wrap gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <Link
            to="/aviation/explorer"
            className="rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            CPS Explorer
          </Link>
          <Link
            to="/aviation/simulators"
            className="rounded-xl border border-slate-600 px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-sky-400/40 hover:text-white"
          >
            Aviation Labs
          </Link>
        </motion.div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-lg font-semibold text-sky-300">{value}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
