import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Hero from './components/Hero';
import LearningPathway from './components/LearningPathway';
import ResearchRepo from './components/ResearchRepo';
import SimulatorsPage from './components/SimulatorsPage';
import TelemetryTicker from './components/TelemetryTicker';

// ── Sonar ping on the brand logo ──────────────────────────────────────────
function NavBrand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      {/* Animated sonar dot */}
      <span className="relative flex h-5 w-5 items-center justify-center">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-pacificCyan opacity-60"
          animate={{ scale: [1, 1.9, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pacificCyan" />
      </span>
      <span className="text-sm font-semibold uppercase tracking-[0.15em] text-pacificCyan transition group-hover:text-cyan-300">
        Physical AI Maritime
      </span>
    </Link>
  );
}

// ── Page transition wrapper ───────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 14 },
  enter:   { opacity: 1, y: 0,  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.25, ease: 'easeIn' } },
};

function PageWrapper({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────
function HomePage() {
  return (
    <PageWrapper>
      <Hero />
      <TelemetryTicker />
      <LearningPathway />
      <ResearchRepo />
    </PageWrapper>
  );
}

function SimPage() {
  return (
    <PageWrapper>
      <SimulatorsPage />
    </PageWrapper>
  );
}

// ── Root app ──────────────────────────────────────────────────────────────
export default function App() {
  const location = useLocation();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-8 md:px-8 md:py-10">
      {/* Sticky nav */}
      <header className="glass-card sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <NavBrand />
        <nav className="flex items-center gap-2 text-sm">
          <NavLink
            to="/simulators"
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 transition ${
                isActive
                  ? 'bg-pacificCyan text-slate-950 font-semibold'
                  : 'text-slate-200 hover:bg-slate-800/80'
              }`
            }
          >
            Simulators
          </NavLink>
        </nav>
      </header>

      {/* Animated route transitions */}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/"           element={<HomePage />} />
          <Route path="/simulators" element={<SimPage />} />
        </Routes>
      </AnimatePresence>
    </main>
  );
}
