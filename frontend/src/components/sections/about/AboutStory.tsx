import { useAboutPageData } from '@/hooks/useAboutPageData';
import storyImage from '@/assets/images/athanext_story.png';
import { PRIMARY } from '@/config/colors';
import { strings } from "@/config/strings";

export function AboutStory() {
  const { data, loading } = useAboutPageData();

  if (loading) {
    return (
      <div className="w-full py-20 animate-pulse" style={{ backgroundColor: '#F2F5F9' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="h-10 bg-gray-200 rounded-lg mb-4 w-1/3 mx-auto" />
          <div className="h-6 bg-gray-200 rounded-lg mb-12 w-2/3 mx-auto" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="h-96 bg-gray-200 rounded-2xl" />
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded w-full" />
              <div className="h-6 bg-gray-200 rounded w-full" />
              <div className="h-6 bg-gray-200 rounded w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.story) {
    return (
      <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#F2F5F9' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              The {strings.brand.name} Story
            </h2>
            <p className="text-lg text-gray-600">
              Unable to load story. Please try refreshing the page.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { story } = data;

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#F2F5F9' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header at the top */}
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold mb-3">
            <span className="text-gray-900">The </span>
            <span style={{ color: PRIMARY.main }}>{strings.brand.name}</span>
            <span className="text-gray-900"> Story</span>
          </h2>
          <p className="text-base text-gray-600">
            {story.tagline}
          </p>
        </div>

        {/* Two-column layout: Image on left, Content on right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: Image */}
          <div>
            {story.image_url ? (
              <img
                src={story.image_url}
                alt={story.title}
                className="w-full h-[60vh] object-cover rounded-2xl"
              />
            ) : (
              <img
                src={storyImage}
                alt={story.title}
                className="w-full h-[60vh] object-cover rounded-2xl"
              />
            )}
          </div>

          {/* Right: Content */}
          <div className="space-y-6">
            {/* Story paragraphs */}
            {story.paragraphs && story.paragraphs.length > 0 ? (
              story.paragraphs.map((paragraph, index) => (
                <p key={index} className="text-gray-700 leading-relaxed text-sm">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="text-gray-700 leading-relaxed text-sm">
                {story.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}



