/**
 * Database Utilities & Default Data
 * Centralized location for all default/fallback data and type definitions
 * This file serves as the single source of truth for hardcoded data and persona types
 */

import { Constants } from "@/integrations/supabase/types";

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

export const ATHLETE_PROFILE_MOCK_MESSAGES = [
  {
    id: "mock-msg-1",
    sender: "Coach Maya",
    message: "Great focus last session—keep stretching daily.",
    time: "2025-01-04T13:00:00.000Z",
  },
  {
    id: "mock-msg-2",
    sender: "Coach Liam",
    message: "Saturday drill plan is ready when you are.",
    time: "2025-01-03T16:30:00.000Z",
  },
  {
    id: "mock-msg-3",
    sender: "Coach Avery",
    message: "Remember to hydrate ahead of tomorrow’s scrimmage.",
    time: "2025-01-02T18:45:00.000Z",
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

// ========================================================================
// DEFAULT BOOKING CONFIRMATION DATA
// ========================================================================

export const DEFAULT_BOOKING_CONFIRMATION = {
  sessionTitle: "Advanced Goalkeeping",
  price: 75,
  date: "Dec 1, 2025",
  day: "Monday",
  timeRange: "9:00 AM - 10:00 AM",
  duration: "60 minutes",
  type: "Individual",
  location: "In-Person",
  coachName: "Ronald Garces",
  coachRole: "Goalkeeper Coach",
};

// ============================================================================
// PERSONA TYPE DEFINITIONS
// ============================================================================

export const PERSONA_TYPES = Constants.public.Enums.persona_type;
export const DEFAULT_PERSONA = PERSONA_TYPES[0]; // "athlete"

// ============================================================================
// AVAILABILITY LOCATION OPTIONS (UI LABELS)
// ============================================================================

export const LOCATION_OPTIONS = [
  { value: "in-person", label: "In-Person" },
  { value: "online", label: "Online" },
];

// ============================================================================
// SPORTS AND POSITIONS
// ============================================================================

export const SPORTS_OPTIONS = [
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
export const ATHLETE_SPORTS_OPTIONS = [
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

export const normalizePosition = (sport, position) => {
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

export const normalizeAthletePosition = (sport, position) => {
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

// Mock coach sport; switch to "rowing" to view rowing pillars
export const MYSESSION_COACH_SPORT = "soccer";

export const MYSESSION_DATA = [
  {
    id: "s1",
    title: "Pro GK Masterclass",
    type: "Group",
    status: "in-progress",
    start: "2025-12-22T23:13:00",
    end: "2025-12-23T00:13:00",
    location: "Elite Training Center",
    rate: 60,
    totalAthletes: 5,
    sportPillars: ["On Field Development", "Performance Coaching"],
    athletes: [
      {
        id: "alex",
        name: "Alex Martinez",
        avatar:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=80&q=80",
      },
      {
        id: "jordan",
        name: "Jordan Lee",
        avatar:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=80&q=80",
      },
      {
        id: "sam",
        name: "Sam Patel",
        avatar:
          "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=80&q=80",
      },
      {
        id: "max",
        name: "Max Wong",
        avatar:
          "https://images.unsplash.com/photo-1461800919507-79b16743b257?auto=format&fit=crop&w=80&q=80",
      },
      {
        id: "sarah",
        name: "Sarah Johnson",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80",
      },
    ],
  },
  {
    id: "s2",
    title: "U18 Elite GK Training",
    type: "Group",
    status: "upcoming",
    start: new Date(Date.now() + 13 * 60 * 1000).toISOString(),
    end: new Date(Date.now() + 73 * 60 * 1000).toISOString(),
    location: "Boca Raton Sports Complex",
    rate: 50,
    totalAthletes: 12,
    sportPillars: ["On Field Development", "Race Preparation"],
    athletes: [
      { id: "alex", name: "Alex Martinez" },
      { id: "jordan", name: "Jordan Lee" },
      { id: "sam", name: "Sam Patel" },
    ],
  },
  {
    id: "s3",
    title: "U14 GK Basics Workshop",
    type: "Group",
    status: "upcoming",
    start: "2025-12-12T14:00:00",
    end: "2025-12-12T15:30:00",
    location: "Downtown Sports Field",
    rate: 35,
    totalAthletes: 10,
    sportPillars: ["On Field Development", "Mentorship"],
    athletes: [
      { id: "michelle", name: "Michael Chen" },
      { id: "emily", name: "Emily Davis" },
      { id: "jake", name: "Jake Wilson" },
    ],
  },
  {
    id: "s4",
    title: "1-on-1 Advanced GK Training",
    type: "Individual",
    status: "upcoming",
    start: "2025-12-14T16:00:00",
    end: "2025-12-14T17:00:00",
    location: "Elite Sports Arena",
    rate: 75,
    totalAthletes: 1,
    sportPillars: ["On Field Development", "Mentorship"],
    athletes: [{ id: "sarah", name: "Sarah Johnson" }],
  },
  {
    id: "s5",
    title: "U16 GK Group Training",
    type: "Group",
    status: "upcoming",
    start: "2025-12-15T09:30:00",
    end: "2025-12-15T10:30:00",
    location: "Boca Raton Sports Complex",
    rate: 40,
    totalAthletes: 14,
    sportPillars: ["On Field Development", "Performance Coaching"],
    athletes: [
      { id: "alex", name: "Alex Martinez" },
      { id: "jordan", name: "Jordan Lee" },
      { id: "sam", name: "Sam Patel" },
    ],
  },
  {
    id: "s6",
    title: "U16 GK Group Training",
    type: "Group",
    status: "draft",
    start: "2024-11-05T21:00:00",
    end: "2024-11-05T22:00:00",
    location: "Boca Raton Sports Complex",
    rate: 40,
    totalAthletes: 4,
    sportPillars: ["On Field Development", "Performance Coaching"],
    athletes: [
      { id: "alex", name: "Alex Martinez" },
      { id: "jordan", name: "Jordan Lee" },
      { id: "sam", name: "Sam Patel" },
    ],
  },
  {
    id: "s7",
    title: "Individual Skills Assessment",
    type: "Individual",
    status: "past",
    start: "2024-11-02T18:00:00",
    end: "2024-11-02T19:00:00",
    location: "Boca Raton Sports Complex",
    rate: 80,
    totalAthletes: 1,
    sportPillars: ["On Field Development", "Mentorship"],
    athletes: [{ id: "liam", name: "Liam Andersen" }],
  },
  {
    id: "s8",
    title: "U18 Advanced Group Training",
    type: "Group",
    status: "past",
    start: "2024-11-01T19:00:00",
    end: "2024-11-01T20:30:00",
    location: "Premier Training Center",
    rate: 45,
    totalAthletes: 6,
    sportPillars: ["On Field Development", "Performance Coaching"],
    athletes: [
      { id: "chris", name: "Chris Brown" },
      { id: "jessica", name: "Jessica Lee" },
      { id: "david", name: "David Kim" },
    ],
  },
];

// ============================================================================
// AthleteSessions mock data (UI previews)
// ============================================================================

export const ATHLETE_SESSIONS_SOCCER_PILLARS = MYSESSION_SOCCER_PILLARS;
export const ATHLETE_SESSIONS_ROWING_PILLARS = MYSESSION_ROWING_PILLARS;
export const ATHLETE_SESSIONS_COACH_SPORT = "soccer";
export const ATHLETE_SESSIONS_CURRENT_ATHLETE_ID = "athlete-001";

export const ATHLETE_SESSIONS_DATA = [
  {
    id: "a1",
    athleteId: "athlete-001",
    title: "Pro GK Masterclass",
    status: "in-progress",
    type: "Group",
    start: "2025-12-22T23:13:00",
    end: "2025-12-23T00:13:00",
    location: "Elite Training Center",
    locationType: "In Person",
    coach: "Coach Martinez",
    rate: 60,
    tags: ["Group", "Paid"],
    sportPillars: ["On Field Development", "Performance Coaching"],
  },
  {
    id: "a2",
    athleteId: "athlete-001",
    title: "1-on-1 Advanced GK Training",
    status: "upcoming",
    type: "Individual",
    start: "2025-12-18T16:00:00",
    end: "2025-12-18T17:00:00",
    location: "Elite Sports Arena",
    locationType: "In Person",
    coach: "Coach Davis",
    rate: 75,
    tags: ["Individual"],
    sportPillars: ["On Field Development", "Mentorship"],
  },
  {
    id: "a3",
    athleteId: "athlete-001",
    title: "Virtual GK Tactics Session",
    status: "upcoming",
    type: "Group",
    start: "2025-12-22T00:23:00",
    end: "2025-12-22T01:23:00",
    location: "Zoom Meeting",
    locationType: "Online",
    coach: "Coach Thompson",
    rate: 30,
    tags: ["Group", "Online"],
    sportPillars: ["Video Analysis", "On Field Development"],
  },
  {
    id: "a4",
    athleteId: "athlete-001",
    title: "U18 GK Shot-Stopping Intensive",
    status: "past",
    type: "Group",
    start: "2024-12-19T15:40:00",
    end: "2024-12-19T16:40:00",
    location: "Elite Training Center",
    locationType: "In Person",
    coach: "Coach Martinez",
    rate: 50,
    tags: ["Group", "Attended", "Feedback Available", "Paid"],
    sportPillars: ["On Field Development", "Performance Coaching"],
  },
  {
    id: "a5",
    athleteId: "athlete-001",
    title: "1-on-1 Technical Skills Session",
    status: "past",
    type: "Individual",
    start: "2024-12-17T16:00:00",
    end: "2024-12-17T17:00:00",
    location: "Elite Sports Arena",
    locationType: "In Person",
    coach: "Coach Davis",
    rate: 75,
    tags: ["Individual", "Attended", "Feedback Available", "Paid"],
    sportPillars: ["On Field Development", "Mentorship"],
  },
  {
    id: "a6",
    athleteId: "athlete-001",
    title: "GK Positioning & Communication Workshop",
    status: "past",
    type: "Group",
    start: "2024-12-15T17:45:00",
    end: "2024-12-15T18:45:00",
    location: "Training Complex",
    locationType: "In Person",
    coach: "Coach Thompson",
    rate: 45,
    tags: ["Group", "Attended", "Feedback Available", "Paid"],
    sportPillars: ["On Field Development", "Psychology + Leadership"],
  },
  {
    id: "a7",
    athleteId: "athlete-001",
    title: "Advanced GK Masterclass",
    status: "past",
    type: "Group",
    start: "2024-12-14T10:00:00",
    end: "2024-12-14T11:30:00",
    location: "Premier GK Academy",
    locationType: "In Person",
    coach: "Coach Rodriguez",
    rate: 60,
    tags: ["Group", "Attended", "Feedback Available", "Paid"],
    sportPillars: ["On Field Development", "Performance Coaching"],
  },
  {
    id: "a8",
    athleteId: "athlete-001",
    title: "U18 GK Group Training",
    status: "past",
    type: "Group",
    start: "2024-11-30T15:30:00",
    end: "2024-11-30T16:30:00",
    location: "Sports Complex",
    locationType: "In Person",
    coach: "Coach Martinez",
    rate: 40,
    tags: ["Group", "Attended", "Feedback Available", "Paid"],
    sportPillars: ["On Field Development", "Performance Coaching"],
  },
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

export const ATHLETE_PROFILE_MOCK = {
  id: "athlete-1",
  name: "Marcus Johnson",
  sport: "Soccer",
  position: "Goalkeeper",
  school: "Lincoln High School",
  classOf: 2025,
  location: "Boston, MA",
  tags: ["Goalkeeper", "Lincoln High School", "On Field Development"],
  summary:
    "Varsity goalkeeper with a 52-game career record, 94.2% save percentage, and proven leadership as team captain.",
  bio: [
    "Marcus Johnson is a dedicated goalkeeper with a proven track record of excellence both on the field and in the classroom. With over 5 years of competitive experience, Marcus has developed into a reliable and commanding presence in goal.",
    "Known for exceptional reflexes, strong communication skills, and excellent decision-making under pressure, Marcus has helped lead his high school team to two state championships. His work ethic and leadership qualities make him an asset to any team.",
    "Marcus is seeking a collegiate program that values both athletic excellence and academic achievement. With a strong interest in Sports Management and a 3.8 GPA, he is committed to making an impact both on and off the field.",
  ],
  heroImages: [
    "https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1543328900-c6ebee256134?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1508349949831-6acd0cf10ecb?auto=format&fit=crop&w=1600&q=80",
  ],
  recruitingStatus: {
    description: "Available for Class of 2025 commitments",
    cta: "Actively Recruiting",
  },
  contact: {
    email: "marcus.j@email.com",
    phone: "(206) 555-0123",
    location: "Seattle, WA",
  },
  availability: [
    { label: "Campus Visits", status: "Open" },
    { label: "Video Calls", status: "Open" },
    { label: "Showcase Events", status: "Open" },
  ],
  academics: {
    school: "Lincoln High School",
    gpa: "3.8 / 4.0",
    classRank: "Top 15%",
    sat: "1340",
    intendedMajor: "Sports Management",
    graduation: "June 2025",
  },
  performance: {
    metrics: [
      { label: "Games Played", value: "52", caption: "2023-24 Season" },
      { label: "Clean Sheets", value: "28", caption: "2023-24 Season" },
      { label: "Save Percentage", value: "94.2%", caption: "2023-24 Season" },
      { label: "Goals Against Avg", value: "0.82", caption: "2023-24 Season" },
      { label: "Total Saves", value: "187", caption: "2023-24 Season" },
      { label: "Penalty Saves", value: "8/12", caption: "2023-24 Season" },
    ],
    attributes: [
      { label: "Height", value: "6'2\"" },
      { label: "Weight", value: "185 lbs" },
      { label: "Wingspan", value: "7'4\"" },
      { label: "Vertical Jump", value: '32"' },
    ],
  },
  testimonials: [
    {
      name: "Sarah Mitchell",
      timeAgo: "2 weeks ago",
      subtitle: "Enrolled in: Elite Striker Development",
      quote:
        "Ronald's training program completely transformed my game. His attention to detail and personalized feedback helped me secure a college scholarship. Highly recommended!",
      rating: 5,
    },
    {
      name: "David Rodriguez",
      timeAgo: "2 months ago",
      subtitle: "Enrolled in: Video Analysis Deep Dive",
      quote:
        "The mentorship aspect of Ronald's coaching goes beyond just skills. He helped me develop mental toughness and confidence on the field.",
      rating: 5,
    },
  ],
  faq: [
    {
      question: "How do I know the coaches on the platform are safe?",
      answer:
        "Every coach completes a thorough background check, provides verified credentials, and maintains a minimum review rating to remain active on the platform.",
    },
    {
      question: "Is there a subscription fee?",
      answer:
        "No subscriptions required. You only pay for coaching sessions or packages you book directly with a coach.",
    },
    {
      question: "Do the coaches get paid?",
      answer:
        "Yes, coaches are paid directly for every session you schedule through the platform.",
    },
  ],
  quickInfo: {
    responseTime: 24,
    sessionTypes: ["Campus Visits", "Virtual Interviews"],
    languages: ["English"],
    experienceYears: 5,
  },
};

/**
 * Type Definitions
 */
export const FAQ_TYPE = {
  id: "string",
  question: "string",
  answer: "string",
  category: "string (optional)",
  order: "number",
};

export const ATHLETE_DASHBOARD_DATA = {
  stats: [
    {
      value: "0",
      label: "Sessions Completed",
      subtitle: "Training sessions",
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
      iconType: "Calendar",
    },
    {
      value: "0",
      label: "Hours Trained",
      subtitle: "Total training time",
      iconColor: "text-green-600",
      bgColor: "bg-green-50",
      iconType: "Clock",
    },
    {
      value: "3",
      label: "Coaches Worked With",
      subtitle: "Different coaches",
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50",
      iconType: "Trophy",
    },
    {
      value: "4.8",
      label: "Average Rating",
      subtitle: "Coach feedback",
      iconColor: "text-yellow-600",
      bgColor: "bg-yellow-50",
      iconType: "Star",
    },
  ],
  upcomingSessions: [
    {
      date: "Dec 18, 2024 - 2:00 PM",
      coach: "Mike Thompson",
      type: "Technical Skills",
      status: "Confirmed",
      statusColor: "bg-green-500",
    },
    {
      date: "Dec 20, 2024 - 4:00 PM",
      coach: "Jennifer Davis",
      type: "Shot Stopping",
      status: "Pending",
      statusColor: "bg-yellow-500",
    },
    {
      date: "Dec 22, 2024 - 10:00 AM",
      coach: "Carlos Martinez",
      type: "Distribution",
      status: "Confirmed",
      statusColor: "bg-green-500",
    },
  ],
  messages: [
    {
      sender: "Mike Thompson",
      message: "Great progress in today's session! Keep working on...",
      time: "30 min ago",
      unread: true,
    },
    {
      sender: "Jennifer Davis",
      message: "Don't forget to practice the diving technique we...",
      time: "2 hours ago",
      unread: false,
    },
    {
      sender: "Support Team",
      message: "Your next session has been confirmed for...",
      time: "1 day ago",
      unread: false,
    },
  ],
  coaches: [
    {
      name: "Sarah Williams",
      specialty: "Defensive Training",
      initials: "SW",
      color: "bg-pink-500",
    },
    {
      name: "Michael Chen",
      specialty: "Midfield Mastery",
      initials: "MC",
      color: "bg-blue-500",
    },
    {
      name: "Alex Martinez",
      specialty: "Youth Development",
      initials: "AM",
      color: "bg-green-500",
    },
  ],
  recentActivities: [

  ],
};

export const PROFILE_TYPE = {
  coach: "coach",
  athlete: "athlete",
  parent: "parent",
};

export const defaultPhotos = [
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80",
];

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
