import { useAboutPageData } from '@/hooks/useAboutPageData';
import { PRIMARY, NEUTRAL } from '@/config/colors';

export function AboutLeadership() {
  const { data, loading } = useAboutPageData();

  if (loading) {
    return (
      <div className="w-full py-20 animate-pulse" style={{ backgroundColor: NEUTRAL.sectionBackground }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="h-10 bg-gray-200 rounded-lg mb-4 w-1/3 mx-auto" />
          <div className="h-6 bg-gray-200 rounded-lg mb-12 w-2/3 mx-auto" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-96 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data?.team || data.team.length === 0) {
    return (
      <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: NEUTRAL.sectionBackground }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Meet Our Leadership Team
            </h2>
            <p className="text-lg text-gray-600">
              Unable to load team members. Please try refreshing the page.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { leadershipIntro, team } = data;
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: NEUTRAL.sectionBackground }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            <span className="text-gray-900">Meet Our </span>
            <span style={{ color: PRIMARY.main }}>Leadership Team</span>
          </h2>
          <p className="text-base text-gray-600">
            {leadershipIntro.subtitle}
          </p>
        </div>

        {/* Team Grid - 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-3xl mx-auto">
          {team && team.map((member, index) => {
            const isLastOdd = team.length % 2 === 1 && index === team.length - 1;

            return (
              <div
                key={member.id}
                className={
                  "bg-white rounded-2xl overflow-hidden shadow-sm " +
                  (isLastOdd
                    ? "md:col-span-2 md:justify-self-center md:w-[calc(50%-1.25rem)]"
                    : "")
                }
              >
              {/* Image Section */}
              <div className="w-full h-96 overflow-hidden">
                <img
                  src={member.image_url}
                  alt={member.title}
                  className="w-full h-full object-cover object-top"
                />
              </div>

              {/* Content Section */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {member.title}
                </h3>
                <p 
                  className="text-sm font-semibold mb-3"
                  style={{ color: PRIMARY.main }}
                >
                  {member.position}
                </p>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {member.description}
                </p>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
