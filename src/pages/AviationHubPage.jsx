import AviationHero from '../components/AviationHero';
import AviationLabsPreview from '../components/AviationLabsPreview';
import AviationLearningPathway from '../components/AviationLearningPathway';
import AviationResearchRepo from '../components/AviationResearchRepo';
import AviationSectionNav from '../components/AviationSectionNav';
import AviationTelemetryTicker from '../components/AviationTelemetryTicker';

export default function AviationHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <AviationSectionNav />
      <AviationHero />
      <AviationTelemetryTicker />
      <AviationLabsPreview />
      <AviationLearningPathway />
      <AviationResearchRepo />
    </div>
  );
}
