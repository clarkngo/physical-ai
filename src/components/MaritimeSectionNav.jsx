import { NavLink } from 'react-router-dom';

const SECTIONS = [
  { to: '/maritime', label: 'Overview', end: true },
  { to: '/maritime/explorer', label: 'CPS Explorer', end: true },
];

export default function MaritimeSectionNav() {
  return (
    <nav
      aria-label="Maritime sections"
      className="flex flex-wrap gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-1"
    >
      {SECTIONS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `rounded-lg px-3 py-1.5 text-sm transition ${
              isActive
                ? 'bg-pacificCyan font-semibold text-slate-950'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
