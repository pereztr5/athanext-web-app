import { useAboutPageData } from '@/hooks/useAboutPageData';
import * as LucideIcons from 'lucide-react';
import { PRIMARY, VALUE_ICON_COLORS } from '@/config/colors';

export function AboutCoreValues() {
  const { data, loading } = useAboutPageData();

  if (loading) {
    return (
      <div className="w-full py-20 bg-white animate-pulse">
        <div className="max-w-6xl mx-auto px-4">
          <div className="h-10 bg-gray-200 rounded-lg mb-4 w-1/3 mx-auto" />
          <div className="h-6 bg-gray-200 rounded-lg mb-12 w-2/3 mx-auto" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-56 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data?.values || data.values.length === 0) {
    return (
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Our Core Values
            </h2>
            <p className="text-lg text-gray-600">
              Unable to load values. Please try refreshing the page.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { valuesIntro, values } = data;

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            <span className="text-gray-900">Our Core </span>
            <span style={{ color: PRIMARY.main }}>Values</span>
          </h2>
          <p className="text-base text-gray-600">
            {valuesIntro.subtitle}
          </p>
        </div>

        {/* Values Grid - 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {values.map((value, index) => {
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            const IconComponent = (LucideIcons as any)[value.icon_name];
            const iconColor = VALUE_ICON_COLORS[index % VALUE_ICON_COLORS.length];

            return (
              <div
                key={value.id}
                className="bg-[#EFF6FF] rounded-2xl p-8"
              >
                {/* Icon - no background container */}
                {IconComponent && (
                  <div className="mb-6">
                    <IconComponent
                      className="h-10 w-10"
                      style={{ color: iconColor }}
                      strokeWidth={2}
                    />
                  </div>
                )}

                {/* Title */}
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {value.title}
                </h3>

                {/* Description */}
                <p className="text-gray-700 leading-relaxed text-sm">
                  {value.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
