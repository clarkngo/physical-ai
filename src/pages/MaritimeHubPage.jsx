import Hero from '../components/Hero';
import LearningPathway from '../components/LearningPathway';
import MaritimeSectionNav from '../components/MaritimeSectionNav';
import ResearchRepo from '../components/ResearchRepo';
import TelemetryTicker from '../components/TelemetryTicker';

export default function MaritimeHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <MaritimeSectionNav />
      <Hero />
      <TelemetryTicker />
      <LearningPathway />
      <ResearchRepo />
    </div>
  );
}
