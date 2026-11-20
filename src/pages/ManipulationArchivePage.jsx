import { Link } from 'react-router-dom';
import ManipulationV1Labs from '../components/archive/ManipulationV1Labs.jsx';

const VERSIONS = [
  {
    tag: 'v1',
    title: '2D canvas labs',
    status: 'Archived (this page)',
    stack: ['React', 'HTML Canvas 2D', 'Hand-written kinematics', 'framer-motion'],
    notes: [
      'Forward kinematics, inverse kinematics and pick-and-place drawn on a 460 px canvas.',
      'No physics: joints are set directly, and the cube is attached to the gripper by script.',
    ],
  },
  {
    tag: 'v2',
    title: 'Fixed IK + MuJoCo physics',
    status: 'Live',
    stack: ['React', 'Canvas 2D (Labs 01–02)', 'MuJoCo 4 (WebAssembly)', 'three.js'],
    notes: [
      'Inverse kinematics now places the gripper (not the wrist) on the target, with a chosen tool angle.',
      'Lab 03 became two MuJoCo labs: torque control with gravity, and pick-and-place held only by friction.',
    ],
  },
];

const KNOWN_ISSUES = [
  'Lab 02 solves inverse kinematics for the wrist joint, so the gripper overshoots the clicked target by the last link plus the fingers (75 px).',
  'Lab 02 checks reach with two links only, so many clicks inside the drawn workspace report “no solution”.',
  'Lab 02 sets the last joint to −0.45 × the elbow angle, so the gripper angle is not actually held constant.',
  'Lab 03 moves the cube with the gripper by script; grip force, friction and mass play no part.',
];

export default function ManipulationArchivePage() {
  return (
    <section className="space-y-6 pb-8">
      <div className="glass-card rounded-2xl px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">Archive · Manipulation labs</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-whiteHull">How the robotic arm labs evolved</h1>
          <Link to="/simulators/manipulation" className="text-sm text-orange-300 transition hover:text-orange-200">
            Open the current labs →
          </Link>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          The first version of the arm labs is preserved below exactly as it shipped, bugs included, so the
          iteration can be compared side by side with the current MuJoCo-based labs. The source is tagged{' '}
          <code className="text-orange-300">manipulation-v1-2d</code> in the repository.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {VERSIONS.map((v) => (
          <div key={v.tag} className="simulator-panel rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest text-orange-400">{v.tag.toUpperCase()}</span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                v.status === 'Live' ? 'bg-green-500/10 text-green-300' : 'bg-slate-700/40 text-slate-400'
              }`}>
                {v.status}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-whiteHull">{v.title}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {v.stack.map((s) => (
                <span key={s} className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300">{s}</span>
              ))}
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-slate-400">
              {v.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="simulator-panel rounded-2xl p-5 text-sm">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-orange-400">Known issues in v1 (fixed in v2)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-400">
          {KNOWN_ISSUES.map((k) => <li key={k}>{k}</li>)}
        </ul>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-700 p-3">
        <p className="mb-3 px-2 text-xs uppercase tracking-widest text-slate-500">v1 as shipped ↓</p>
        <ManipulationV1Labs />
      </div>
    </section>
  );
}
