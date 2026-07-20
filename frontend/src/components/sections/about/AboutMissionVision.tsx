import { useAboutPageData } from '@/hooks/useAboutPageData';
import * as LucideIcons from 'lucide-react';
import { PRIMARY } from '@/config/colors';

export function AboutMissionVision() {
  const { data, loading } = useAboutPageData();

  if (loading) {
    return (
      <div className="w-full py-20 bg-gray-50 animate-pulse">
        <div className="max-w-6xl mx-auto px-4">
          <div className="h-10 bg-gray-200 rounded-lg mb-4 w-1/3 mx-auto" />
          <div className="h-6 bg-gray-200 rounded-lg mb-12 w-2/3 mx-auto" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-40 bg-gray-200 rounded-lg" />
            <div className="h-40 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!data?.mission || !data?.vision) {
    return (
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Our Mission & Vision
            </h2>
            <p className="text-lg text-gray-600">
              Unable to load mission and vision content. Please try refreshing the page.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { mission, vision } = data;
  // Check if using fallback data
  const isUsingFallback = mission.id === 'default-mission';

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const MissionIcon = (LucideIcons as any)[mission.icon_name];
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const VisionIcon = (LucideIcons as any)[vision.icon_name];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            <span className="text-gray-900">Our </span>
            <span style={{ color: PRIMARY.main }}>Mission & Vision</span>
          </h2>
          <p className="text-base text-gray-600">
           Building the future of personalized athletic training, one connection at a time
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Mission Card */}
          <div className="bg-[#EFF6FF] rounded-2xl p-8 text-center">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: PRIMARY.main }}
              >
                {MissionIcon && (
                  <MissionIcon
                    className="h-7 w-7 text-white"
                  />
                )}
              </div>
            </div>
            
            {/* Title */}
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {mission.title}
            </h3>
            
            {/* Description */}
            <p className="text-gray-700 text-sm leading-relaxed">
              {mission.description}
            </p>
          </div>

          {/* Vision Card */}
          <div className="bg-[#EFF6FF] rounded-2xl p-8 text-center">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: PRIMARY.main }}
              >
                {VisionIcon && (
                  <VisionIcon
                    className="h-7 w-7 text-white"
                  />
                )}
              </div>
            </div>
            
            {/* Title */}
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {vision.title}
            </h3>
            
            {/* Description */}
            <p className="text-gray-700 text-sm leading-relaxed">
              {vision.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
