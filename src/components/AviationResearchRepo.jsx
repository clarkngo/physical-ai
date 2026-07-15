import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { aviationResearchPapers } from '../data/aviationResearchPapers';

const SOURCE_ACCENT = {
  'MIT Lincoln Lab (Open Access)': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/25',
  'NASA Ames Dataset': 'text-blue-400 bg-blue-400/10 border-blue-400/25',
  'Aviation CPS Consortium': 'text-indigo-400 bg-indigo-400/10 border-indigo-400/25',
};

function DataStream() {
  return (
    <svg viewBox="0 0 200 4" className="my-4 w-full" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <motion.rect
          key={i}
          x={i * 26}
          y={0}
          width={18}
          height={4}
          rx={2}
          fill="rgba(56,189,248,0.35)"
          animate={{ opacity: [0.2, 1, 0.2], scaleX: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, delay: i * 0.18, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </svg>
  );
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function AviationResearchRepo() {
  const [activePaperId, setActivePaperId] = useState(aviationResearchPapers[0].id);
  const activePaper = aviationResearchPapers.find((p) => p.id === activePaperId);

  return (
    <section className="space-y-5 pb-10">
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.55 }}
        className="flex items-end gap-4"
      >
        <h2 className="text-3xl font-semibold text-whiteHull">Research Repo</h2>
        <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-sky-400">
          Open Access · 3 Papers
        </span>
      </motion.div>

      <DataStream />

      <motion.div
        className="grid gap-4 md:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-30px' }}
      >
        {aviationResearchPapers.map((paper) => {
          const isActive = activePaperId === paper.id;
          return (
            <motion.button
              key={paper.id}
              type="button"
              onClick={() => setActivePaperId(paper.id)}
              variants={cardVariants}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              whileTap={{ scale: 0.98 }}
              className={`relative rounded-2xl border p-5 text-left transition-colors duration-200 ${
                isActive
                  ? 'border-sky-400 bg-slate-900/90 shadow-[0_0_24px_rgba(56,189,248,0.15)]'
                  : 'border-slate-700 bg-slate-900/70 hover:border-sky-400/50'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="aviation-active-indicator"
                  className="absolute left-0 top-3 h-8 w-0.5 rounded-r-full bg-sky-400"
                />
              )}

              <p className="pr-2 font-semibold leading-snug text-whiteHull">{paper.title}</p>

              <span
                className={`mt-3 inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                  SOURCE_ACCENT[paper.source] ?? 'text-slate-400 bg-slate-800 border-slate-700'
                }`}
              >
                {paper.source}
              </span>

              {isActive && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.5 }}
                  className="mt-3 h-0.5 rounded-full bg-sky-400/40"
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.article
          key={activePaperId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="prose prose-invert max-w-none rounded-2xl border border-slate-700 bg-slate-900/80 p-6"
        >
          <ReactMarkdown>{activePaper?.markdown ?? ''}</ReactMarkdown>
        </motion.article>
      </AnimatePresence>
    </section>
  );
}
