/**
 * About Page Type Definitions
 * Centralized type definitions for all About page related data structures
 */

export interface AboutValue {
  id: string;
  title: string;
  description: string;
  icon_name: string;
}

export interface TeamMember {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  position: string;
  email?: string;
  social_links?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
}

export interface AboutHeroSection {
  id: string;
  section_title: string;
  section_description: string;
  section_subtitle?: string;
  image_url?: string;
}

export interface AboutMissionVisionSection {
  id: string;
  title: string;
  description: string;
  icon_name?: string;
}

export interface AboutStoryStat {
  value: string;
  label: string;
}

export interface AboutStory {
  id: string;
  brand_name: string;
  title: string;
  tagline: string;
  description: string;
  paragraphs?: string[];
  image_url?: string;
  stats?: AboutStoryStat[];
}

export interface AboutData {
  hero: AboutHeroSection;
  story?: AboutStory;
  mission: AboutMissionVisionSection;
  vision: AboutMissionVisionSection;
  valuesIntro: {
    title: string;
    subtitle: string;
  };
  values: AboutValue[];
  leadershipIntro: {
    title: string;
    subtitle: string;
  };
  team: TeamMember[];
}
