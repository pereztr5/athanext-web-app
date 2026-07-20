/**
 * Contact page hero section component
 * Displays banner with title and description
 */
interface ContactHeroProps {
  backgroundImage: string;
  title?: string;
  description?: string;
}

export const ContactHero = ({ 
  backgroundImage, 
  title = "Get in Touch",
  description = "Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible."
}: ContactHeroProps) => {
  return (
    <div 
      className="relative w-full h-80 md:h-96 bg-cover bg-center flex items-center justify-center"
      style={{ 
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${backgroundImage})` 
      }}
    >
      <div className="text-center text-white px-4 max-w-3xl">
        <h1 className="text-3xl md:text-5xl font-bold mb-4">
          {title}
        </h1>
        <p className="text-base md:text-lg text-gray-200">
          {description}
        </p>
      </div>
    </div>
  );
};
