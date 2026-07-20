import ScrollToTop from '@/components/common/ScrollToTop';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { AboutHero } from '@/components/sections/about/AboutHero';
import { AboutStory } from '@/components/sections/about/AboutStory';
import { AboutMissionVision } from '@/components/sections/about/AboutMissionVision';
import { AboutCoreValues } from '@/components/sections/about/AboutCoreValues';
import { AboutLeadership } from '@/components/sections/about/AboutLeadership';
import { AboutCTA } from '@/components/sections/about/AboutCTA';

export default function About() {
  return (
    <div className="w-full">
      <ScrollToTop />
      <ErrorBoundary>
        <AboutHero />
        <AboutMissionVision />
        <AboutStory />
        <AboutCoreValues />
        <AboutLeadership />
        <AboutCTA />
      </ErrorBoundary>
    </div>
  );
}
