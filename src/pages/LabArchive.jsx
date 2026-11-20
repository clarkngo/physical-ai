import { Link } from 'react-router-dom';

// Shared layout for archive pages that preserve an earlier version of a lab
// next to a summary of what changed. Tailwind needs literal class names, so the
// accent comes in as ready-made classes.
export const ACCENTS = {
  orange: { text: 'text-orange-400', link: 'text-orange-300 hover:text-orange-200', code: 'text-orange-300' },
  cyan: { text: 'text-pacificCyan', link: 'text-pacificCyan hover:brightness-125', code: 'text-pacificCyan' },
};

export default function LabArchive({ accent = 'orange', eyebrow, title, liveTo, tag, intro, versions, knownIssues, children }) {
  const a = ACCENTS[accent];
  return (
    <section className="space-y-6 pb-8">
      <div className="glass-card rounded-2xl px-5 py-4">
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${a.text}`}>{eyebrow}</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-whiteHull">{title}</h1>
          <Link to={liveTo} className={`text-sm transition ${a.link}`}>
            Open the current labs →
          </Link>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          {intro} The source is tagged <code className={a.code}>{tag}</code> in the repository.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {versions.map((v) => (
          <div key={v.tag} className="simulator-panel rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold tracking-widest ${a.text}`}>{v.tag.toUpperCase()}</span>
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
        <h2 className={`text-[11px] font-bold uppercase tracking-widest ${a.text}`}>Known issues in v1 (fixed in v2)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-400">
          {knownIssues.map((k) => <li key={k}>{k}</li>)}
        </ul>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-700 p-3">
        <p className="mb-3 px-2 text-xs uppercase tracking-widest text-slate-500">v1 as shipped ↓</p>
        {children}
      </div>
    </section>
  );
}
