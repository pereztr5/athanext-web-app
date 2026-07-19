import { useAboutPageData } from '@/hooks/useAboutPageData';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertCircle, Database } from 'lucide-react';
import { PRIMARY, SECONDARY } from '@/config/colors';
import { strings } from '@/config/strings';
import heroImage from '@/assets/images/about-hero-section.svg';

export function AboutHero() {
  const { data, loading, error } = useAboutPageData();

  if (loading) {
    return (
      <div className="w-full h-96 bg-gradient-to-r from-slate-200 to-slate-300 animate-pulse" />
    );
  }

  if (!data?.hero) {
    return (
      <div className="w-full h-96 bg-gradient-to-r from-red-50 to-orange-50 flex items-center justify-center border-2 border-red-200">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Unable to Load Hero Section</h3>
          <p className="text-red-800 mb-4 text-sm">
            No hero data available
          </p>
        </div>
      </div>
    );
  }

  const hero = data.hero;
  // Check if using fallback data (when ID is 'default-hero')
  const isUsingFallback = hero.id === 'default-hero';

  return (
    <div className="relative w-full h-[70vh] min-h-96 overflow-hidden mt-[3.8rem]">
      {/* Background gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-r opacity-90"
        style={{
          backgroundImage: hero.image_url
            ? `url(${hero.image_url})`
            : `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center h-full px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl sm:text-5xl lg:text-5xl font-bold text-white mb-6">
            {hero.section_title}
          </h1>
          <p className="text-lg sm:text-lg text-gray-100 mb-8 max-w-2xl mx-auto">
            {hero.section_subtitle || hero.section_description}
          </p>
        </div>
      </div>
    </div>
  );
}
