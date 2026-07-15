import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const LABS = [
  {
    to: '/aviation/simulators?lab=flight-path',
    num: '01',
    title: 'Arrival Path Optimization',
    desc: 'CDO vs stepped vectors on KSEA HAWKZ4 into ILS 16L under TBFM metering.',
    icon: '🧭',
  },
  {
    to: '/aviation/simulators?lab=adsb',
    num: '02',
    title: 'ADS-B Integrity',
    desc: 'Fuse NIC/NACp claims with MLAT and primary radar to catch ghost injections.',
    icon: '📡',
  },
  {
    to: '/aviation/simulators?lab=tcas',
    num: '03',
    title: 'TCAS Conflict',
    desc: 'Pick an RA sense and check whether predicted miss clears ALIM before Tau.',
    icon: '⚠️',
  },
];

export default function AviationLabsPreview() {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-whiteHull">
            Aviation Labs
            <span className="ml-3 text-base font-normal text-sky-400">Interactive</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Hands-on arrivals, surveillance integrity, and conflict avoidance — the same concepts
            used in the CPS Explorer, as runnable teaching labs.
          </p>
        </div>
        <Link
          to="/aviation/simulators"
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
        >
          Open all labs
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {LABS.map((lab, i) => (
          <motion.div
            key={lab.num}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
          >
            <Link
              to={lab.to}
              className="glass-card block h-full rounded-2xl p-5 transition hover:border-sky-400/40"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-lg">
                  {lab.icon}
                </span>
                <span className="text-xs font-bold tracking-widest text-sky-400">LAB {lab.num}</span>
              </div>
              <h3 className="text-base font-semibold text-sky-400">{lab.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{lab.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
