/**
 * Database Utilities & Default Data
 * Centralized location for all default/fallback data and type definitions
 * This file serves as the single source of truth for hardcoded data and persona types
 */

import { Constants } from "@/integrations/supabase/types";

export interface Option {
  value: string;
  label: string;
}

export interface SportOption extends Option {
  positions: Option[];
}

// ============================================================================
// ATHLETE PROFILE CONSTANTS & MOCK DATA
// ============================================================================

export const ATHLETE_PROFILE_CONSTANTS = {
  MAX_COVER_IMAGES: 3,
  STORAGE_PUBLIC_MARKER: '/storage/v1/object/public/athalink-images/',
};

export const ATHLETE_IMAGE_LIMITS = {
  MAX_PROFILE_IMAGE_SIZE: 8 * 1024 * 1024, // 8MB
  MAX_COVER_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
};

export const ATHLETE_PROFILE_BASE_STATS = [
  {
    key: "sessions_completed",
    label: "Sessions Completed",
    subtitle: "Training sessions",
    iconColor: "text-blue-600",
    bgColor: "bg-blue-50",
    iconType: "Calendar",
  },
  {
    key: "hours_trained",
    label: "Hours Trained",
    subtitle: "Total training time",
    iconColor: "text-green-600",
    bgColor: "bg-green-50",
    iconType: "Clock",
  },
  {
    key: "coaches_worked_with",
    label: "Coaches Worked With",
    subtitle: "Different coaches",
    iconColor: "text-purple-600",
    bgColor: "bg-purple-50",
    iconType: "Trophy",
  },
  {
    key: "average_rating",
    label: "Average Rating",
    subtitle: "Coach feedback",
    iconColor: "text-yellow-600",
    bgColor: "bg-yellow-50",
    iconType: "Star",
  },
];

// ============================================================================
// REACT QUERY KEY CONSTANTS
// ============================================================================

export const QUERY_KEYS = {
  WEEKLY_AVAILABILITY_RESOLVED: ['weekly-availability-resolved'],
  PERIOD_WITH_OVERRIDES: ['period-with-overrides'],
  COACH_AVAILABILITY: ['coach-availability'],
};

// ============================================================================
// PERSONA TYPE DEFINITIONS
// ============================================================================

export const PERSONA_TYPES = Constants.public.Enums.persona_type;
export const DEFAULT_PERSONA = PERSONA_TYPES[0]; // "athlete"

// ============================================================================
// AVAILABILITY LOCATION OPTIONS (UI LABELS)
// ============================================================================

export const LOCATION_OPTIONS: Option[] = [
  { value: "in-person", label: "In-Person" },
  { value: "online", label: "Online" },
];

// ============================================================================
// SPORTS AND POSITIONS
// ============================================================================

export const SPORTS_OPTIONS: SportOption[] = [
  {
    value: "Soccer",
    label: "Soccer",
    positions: [
      { value: "Goalkeeper", label: "Goalkeeper" },
      { value: "Field Player", label: "Field Player" },
    ],
  },
  {
    value: "Rowing",
    label: "Rowing",
    positions: [
      { value: "Rower", label: "Rower" },
      { value: "Coxswain", label: "Coxswain" },
    ],
  },
];

// Athlete/parent positions are different from coach positions.
export const ATHLETE_SPORTS_OPTIONS: SportOption[] = [
  {
    value: "Soccer",
    label: "Soccer",
    positions: [
      { value: "Goalkeeper", label: "Goalkeeper" },
      { value: "Defender", label: "Defender" },
      { value: "Midfielder", label: "Midfielder" },
      { value: "Forward", label: "Forward" },
      { value: "Winger", label: "Winger" },
    ],
  },
  {
    value: "Rowing",
    label: "Rowing",
    positions: [
      { value: "Stroke", label: "Stroke" },
      { value: "Coxswain", label: "Coxswain" },
      { value: "Sculler", label: "Sculler" },
      { value: "Port", label: "Port" },
      { value: "Starboard", label: "Starboard" },
    ],
  },
];

export const normalizePosition = (sport: string, position: string): string => {
  if (!position) return "";
  const normalizedSport = (sport || "").toLowerCase();
  const normalizedPosition = String(position).toLowerCase();

  if (normalizedSport.includes("soc")) {
    return normalizedPosition.includes("goal") ? "Goalkeeper" : "Field Player";
  }

  if (normalizedSport.includes("row")) {
    return normalizedPosition.includes("cox") ? "Coxswain" : "Rower";
  }

  return String(position);
};

export const normalizeAthletePosition = (sport: string, position: string): string => {
  if (!position) return "";
  const normalizedSport = (sport || "").toLowerCase();
  const normalizedPosition = String(position).toLowerCase();

  if (normalizedSport.includes("soc")) {
    if (normalizedPosition.includes("goal")) return "Goalkeeper";
    if (normalizedPosition.includes("defend")) return "Defender";
    if (normalizedPosition.includes("mid")) return "Midfielder";
    if (normalizedPosition.includes("wing")) return "Winger";
    if (normalizedPosition.includes("forward") || normalizedPosition.includes("striker")) return "Forward";
    if (normalizedPosition.includes("field")) return "Midfielder";
    return String(position);
  }

  if (normalizedSport.includes("row")) {
    if (normalizedPosition.includes("cox")) return "Coxswain";
    if (normalizedPosition.includes("stroke")) return "Stroke";
    if (normalizedPosition.includes("scull")) return "Sculler";
    if (normalizedPosition.includes("port")) return "Port";
    if (normalizedPosition.includes("starboard") || normalizedPosition.includes("star")) return "Starboard";
    return String(position);
  }

  return String(position);
};

// ============================================================================
// FAQ DEFAULT DATA
// ============================================================================

/**
 * Used when Supabase faqs table doesn't exist or has no active records
 * These are the default frequently asked questions for the "Why AthaLink" page
 */
export const DEFAULT_FAQS = [
  {
    id: "1",
    question: "What does it cost?",
    answer:
      "Coaches set their own session rates depending on experience, availability, and specialty. You'll see the exact price before booking any session.",
    category: "pricing",
    order: 1,
  },
  {
    id: "2",
    question: "Can I try multiple coaches?",
    answer:
      "Yes! Many athletes combine specialists—for example, a technical skills coach and a mental performance coach—to create a well-rounded development plan.",
    category: "coaches",
    order: 2,
  },
  {
    id: "3",
    question: "What if I need to cancel?",
    answer:
      "Each coach sets their cancellation window, which is clearly displayed before you book. This ensures transparency and flexibility for both parties.",
    category: "booking",
    order: 3,
  },
  {
    id: "4",
    question: "Is AthaNext only for soccer and rowing?",
    answer:
      "We're starting with soccer and rowing to build the best possible experience, with more sports coming soon based on athlete and coach demand.",
    category: "platform",
    order: 4,
  },
];

/**
 * Why AthaLink Page Strings
 * All hardcoded text content for the "Why AthaLink" page
 */
export const WHY_MYKONNECT_STRINGS = {
  hero: {
    title: "Why AthaNext",
    subtitle: "A smarter way to discover, evaluate, and book elite coaching.",
    description:
      "AthaNext combines a verified athlete database with athlete-friendly tools, so you can compare specialties, check availability, and book in minutes.",
    ctaPrimary: "Browse the Database",
    ctaSecondary: "Become a Coach",
  },
  differentiators: [
    {
      title: "Sport-Specific Resources",
      description:
        "Access specialized coaching tailored to your exact sport and position. From soccer goalkeepers to rowing coxswains, find experts who understand your unique needs.",
    },
    {
      title: "Holistic Development",
      description:
        "More than just technical training. Our platform provides access to  comprehensive athlete development, centered around technical, tactical, mental, physical, and social development.",
    },
    {
      title: "Database You Can Actually Search",
      description:
        "Filter by sport, position, experience level, and availability. Compare coaches side-by-side with transparent pricing, reviews, and credentials all in one place.",
    },
    {
      title: "Frictionless Booking & Payments",
      description:
        "No back-and-forth emails or payment confusion. Book session in seconds with instant confirmation and secure payment processing, everything handled for you.",
    },
  ],
  valueProposition: [
    {
      title: "Proven Track Record",
      description:
        "Elite coaches with verified credentials and athlete success stories",
    },
    {
      title: "One Centralized Platform",
      description:
        "Find coaches, book sessions, and stay connected all in one place",
    },
    {
      title: "Holistic Development",
      description:
        "Comprehensive athlete growth across athletic and academic pillars",
    },
  ],
  whatMakesUsDifferent: {
    title: "What Makes Us Different",
    subtitle:
      "Built by athletes, for athletes – with the features that truly matter",
  },
  builtForEveryone: {
    title: "Built For Everyone",
    subtitle: "Whether you're an athlete or a coach, AthaNext has you covered",
  },
  athleteSection: {
    title: "For Athletes & Families",
    benefits: [
      "Verified, trusted collection of established coaches",
      "Transparent pricing with no hidden fees",
      "Holistic, sport-specific development options",
      "Flexible scheduling",
    ],
    cta: "Browse Coaches",
  },
  coachSection: {
    title: "For Coaches",
    benefits: [
      "Ability to scale into different sectors",
      "Scheduling, payment, and messaging handled on platform",
      "Simple fee structure with fast payouts",
      "Focus on coaching, not admin work",
    ],
    cta: "Apply to Coach",
  },
  faqSection: {
    title: "Frequently Asked Questions",
    subtitle: "Everything you need to know about AthaNext",
    loading: "Loading FAQs...",
    error: "Unable to load FAQs",
    empty: "No FAQs available",
    emptyDescription: "Please check back later for frequently asked questions.",
  },
  finalCta: {
    title: "Ready to Find Your Coach?",
    description:
      "Join athletes who are taking control of their development with verified, expert coaching",
    primaryButton: "Browse the Database",
    secondaryButton: "Become a Coach",
  },
};

// ============================================================================
// MySessions mock data (UI previews)
// ============================================================================

export const MYSESSION_SOCCER_PILLARS = [
  "On Field Training",
  "Video Analysis",
  "Mentorship",
  "Strength + Conditioning",
  "Academic Tutoring",
  "College Recruiting",
];

export const MYSESSION_ROWING_PILLARS = [
  "Technical Development",
  "Race Preparation",
  "Mentorship",
  "Strength + Conditioning",
  "Academic Tutoring",
  "College Recruiting",
];

/**
 * About Page Default Data
 * Used when Supabase about tables don't exist or have no active records
 * This is the default About page content serving as a fallback
 */
export const ABOUT_PAGE_DATA = {
  hero: {
    id: "demo-hero",
    section_title: "Connecting Greatness, Producing Results",
    section_description:
      "We're on a mission to revolutionize athletic training by connecting passionate athletes with world-class coaches from around the globe.",
    section_subtitle: "We’re on a mission to revolutionize athletic development by giving athletes in any sport immediate access to the best coaches and resources their sport has to offer.",
  },
  story: {
    id: "1",
    brand_name: "AthaNext",
    title: "Our Story",
    tagline: "From a simple idea to a global community",
    description:
      "AthaNext was founded in 2020 by a group of former professional athletes and tech entrepreneurs who shared a common frustration: the difficulty of finding quality coaching that fit their schedules and specific needs.",
    paragraphs: [
      "AthaNext was founded in 2020 by a group of former professional athletes and tech entrepreneurs who shared a common frustration: the difficulty of finding quality coaching that fit their schedules and specific needs.",
      "We realized that countless talented coaches around the world had expertise to share, and millions of athletes needed guidance—but there was no efficient way to connect them. Traditional coaching models were limited by geography, cost, and availability.",
      "Today, AthaNext serves over 50,000 athletes across 120 countries, facilitating more than 500,000 coaching sessions annually. We've built a thriving community where passion meets expertise, and dreams become achievements.",
    ],
    stats: [
      {
        value: "50K+",
        label: "Active Athletes",
      },
      {
        value: "2,500+",
        label: "Elite Coaches",
      },
      {
        value: "120+",
        label: "Countries",
      },
    ],
  },
  mission: {
    id: "demo-mission",
    title: "Our Mission",
    description:
      "To provide a centralized platform for athletes and coaches to seamlessly connect as they chase their full potential. We believe everyone should have access to the best resources their sport has to offer and have created this platform to streamline athletic development, promoting growth, equality, and opportunity across all sports and levels.",
    icon_name: "Target",
  },
  vision: {
    id: "demo-vision",
    title: "Our Vision",
    description:
      "To become the world’s leading platform for athletic development, aggregating the greatest collection of athletes, coaches, and resources across all sports and levels. In combining modern technology with elite levels of human excellence, we envision a future where athletic development is optimized, pushing athletes and coaches to new heights.",
    icon_name: "Star",
  },
  valuesIntro: {
    title: "Our Core Values",
    subtitle: "The principles that guide everything we do at AthaNext",
  },
  values: [
    {
      id: "1",
      title: "Excellence",
      description: "We strive for the highest standards in every interaction.",
      icon_name: "Award",
    },
    {
      id: "2",
      title: "Integrity",
      description: "We believe in honest, transparent relationships.",
      icon_name: "Shield",
    },
    {
      id: "3",
      title: "Innovation",
      description:
        "We embrace new ideas and technologies to continuously improve.",
      icon_name: "Lightbulb",
    },
    {
      id: "4",
      title: "Community",
      description: "We foster a supportive ecosystem for athletes and coaches.",
      icon_name: "Users",
    },
  ],
  leadershipIntro: {
    title: "Meet Our Leadership Team",
    subtitle: "Visionary leaders dedicated to transforming athletic training",
  },
  team: [
    {
      id: "1",
      title: "Sarah Johnson",
      description:
        "Sarah is a former Olympic athlete with 15+ years of coaching experience.",
      position: "Founder & CEO",
      email: "sarah@athanext.com",
      social_links: {
        linkedin: "sarah-johnson",
        twitter: "sarahjohnson",
      },
    },
    {
      id: "2",
      title: "Michael Chen",
      description:
        "Michael brings 20+ years of professional coaching experience.",
      position: "Head of Rowing",
      email: "michael@athanext.com",
      social_links: {
        linkedin: "michael-chen",
        twitter: "mikechen",
      },
    },
    {
      id: "3",
      title: "CheHee Han",
      description:
        "Spent three decades in the investment banking industry with Morgan Stanley, HSBC, and Chase, focused on equity sales and trading, capital markets, and equity research. At AthaNext, CheHee leads market analysis, financial modeling, and growth planning.",
      position: "Director of Market Analysis",
      image_url:
        "https://api.athanext.com/storage/v1/object/public/athalink-images/CheHee.jpeg",
    },
    
  ],
};

/**
 * Terms & Conditions Default Data
 * Used when Supabase terms_and_conditions table doesn't exist or has no active records
 * This is the default Terms & Conditions content serving as a fallback
 */
export const TERMS_AND_CONDITIONS_DATA = {
  id: "demo-terms",
  title: "Terms & Conditions",
  version: "1.0",
  last_updated: new Date().toISOString().split("T")[0],
  is_active: true,
  content: `
    <div class="prose prose-sm max-w-none">
      <p class="text-muted-foreground mb-6">
        Last updated: ${new Date().toISOString().split("T")[0]}
      </p>

      <div class="space-y-8">
        <section>
          <p class="text-muted-foreground mb-4">
            Dolor sit amet consectetur. Nibh imperdiet rhoncus libero ultricies arcu premium cras in. Neque commodo accumsan vitae magna morbi velit dignissim ullamcorper duis. Quam ac dignissim eget diam velit sit at. Sit vitae neque sem id vel viverra elit. Consequat velit nisl at eu. Et urna blandit orci ornare interdum curabitor amet egestas laboris.
          </p>
          <p class="text-muted-foreground mb-4">
            Mattis odio et pellentesque nisl. Aliquan tincidunt porttitor vel non sem potenti morbi in. Sagittis tempor sed et amet dignissim amet. Netus netus neque nisl non purus. Vivamus ante mattis egestas velit amet aliquam urna velit ultricies.
          </p>
          <p class="text-muted-foreground mb-4">
            Dignissim odio sem nec felis dictumst tincidunt. Vulputate dolor id felis tincidunt. Ultricies nibh viverra dui netus hendrerit. Tristique ullamcorper tincidunt a amet lorem mauris. A vitae iodales nibh metus sem gist tristie nisl. Enim blandit eget ut enim sed tellus erat facilisis. Tempor eu ullamcorper in facilisis sed sagittis pharetra. Blandit in posuere turpis dolor et sed tellus.
          </p>
        </section>

        <section>
          <h2 class="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">Changes to This Terms & Conditions</h2>
          <ul class="list-disc list-inside space-y-3 text-muted-foreground">
            <li>We may update this Terms & Conditions from time to time, including to reflect</li>
            <li>Lorem ipsum dolor sit amet consectetur.</li>
            <li>Aliquam tincidunt porttitor vel non sem potenti morbi in.</li>
            <li>Consequat velit nisl at eu. Et urna blandit orci ornare interdum curabitor amet egestas laboris.</li>
            <li>Sit vitae neque sem id vel viverra elit. Consequat velit nisl at eu. Et urna blandit orci ornare interdum curabitor amet egestas laboris.</li>
            <li>Quam ac dignissim eget diam velit sit at</li>
          </ul>
        </section>

        <section>
          <h2 class="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">How We Collect and Use Your Personal Information</h2>
          <p class="text-muted-foreground mb-4">
            Lorem ipsum dolor sit amet consectetur. Nibh imperdiet rhoncus libero ultricies arcu premium cras in. Neque commodo accumsan vitae magna morbi velit dignissim ullamcorper duis. Quam ac dignissim eget diam velit sit at. Sit vitae neque sem id vel viverra elit.
          </p>
          <p class="text-muted-foreground">
            Consequat velit nisl at eu. Et urna blandit orci ornare interdum curabitor amet egestas laboris. Mattis odio et pellentesque nisl. Aliquan tincidunt porttitor vel non sem potenti morbi in. Sagittis tempor sed et amet dignissim
          </p>
        </section>

        <section>
          <h2 class="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">Information We Collect about Your Usage</h2>
          <p class="text-muted-foreground mb-4">
            Lorem ipsum dolor sit amet consectetur. Nibh imperdiet rhoncus libero ultricies arcu premium cras in. Neque commodo accumsan vitae magna morbi velit dignissim ullamcorper duis. Quam ac dignissim eget diam velit sit at. Sit vitae neque sem id vel viverra elit.
          </p>
          <p class="text-muted-foreground">
            Consequat velit nisl at eu. Et urna blandit orci ornare interdum curabitor amet egestas laboris. Mattis odio et pellentesque nisl. Aliquan tincidunt porttitor vel non sem potenti morbi in. Sagittis tempor sed et amet dignissim
          </p>
        </section>

        <section>
          <h2 class="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">Cookies</h2>
          <p class="text-muted-foreground mb-4">
            Lorem ipsum dolor sit amet consectetur. Nibh imperdiet rhoncus libero ultricies arcu premium cras in. Neque commodo accumsan vitae magna morbi velit dignissim ullamcorper duis. Quam ac dignissim eget diam velit sit at. Sit vitae neque sem id vel viverra elit. Consequat velit nisl at eu. Et urna blandit orci ornare interdum curabitor amet egestas laboris.
          </p>
          <p class="text-muted-foreground">
            Mattis odio et pellentesque nisl. Aliquan tincidunt porttitor vel non sem potenti morbi in. Sagittis tempor sed et amet dignissim
          </p>
        </section>
      </div>
    </div>
  `,
};

export const PROFILE_TYPE = {
  coach: "coach",
  athlete: "athlete",
  parent: "parent",
};

// ============================================================================
// CONTACT INFORMATION FALLBACK
// ============================================================================

/**
 * Default contact methods used as fallback when database fetch fails
 * This ensures contact information is always available to users
 */
export const FALLBACK_CONTACT_METHODS = [
  {
    icon: "email",
    title: "Email Us",
    value: "support@athanext.com",
    description: "We typically respond within 24 hours",
    link: "mailto:support@athanext.com",
  },
  {
    icon: "phone",
    title: "Call Us",
    value: "+1 (555) 123-4568",
    description: "Mon-Fri from 8am to 8pm PST",
    link: "tel:+15551234568",
  },
  {
    icon: "location",
    title: "Visit Us",
    value: "San Francisco, CA",
    description: "Building the future of athletic development",
    link: "https://maps.google.com/?q=San+Francisco,CA",
  },
];

// ============================================================================
// AVAILABILITY SETUP INSTRUCTIONS
// ============================================================================

/**
 * Setup instructions for coaches managing their availability
 * Used in ManageAvailabilityModal component
 */
export const SETUP_INSTRUCTIONS = {
  title: 'How to Set Up Your Availability',
  steps: [
    'Check the day(s) you want to offer sessions',
    'Add a session name (e.g., "Group Training")',
    'Set your price & session type',
    'Choose a start time & duration will auto-fill end time',
  ],
  recurring: {
    title: 'Recurring Sessions',
    description:
      'Use the Previous/Next controls to edit each week separately. Slots you add or change are saved for that specific calendar week.',
  },
};
