/**
 * Color Configuration System
 * 
 * This file centralizes all colors used throughout the application.
 * Instead of changing colors scattered across multiple files, just update them here.
 * 
 * Usage:
 * import { colors } from '@/config/colors';
 * 
 * // In JSX
 * <div style={{ color: colors.primary.main }}>Text</div>
 * 
 * // In Tailwind classes
 * className="bg-primary text-primary-foreground"
 * 
 * All colors are defined as HSL values for consistency with Tailwind CSS variables.
 */

/**
 * Primary Color Palette
 * Used for main actions, buttons, and primary UI elements
 */
export const PRIMARY = {
  main: 'hsl(210 90% 50%)',
  light: 'hsl(210 95% 60%)',
  lighter: 'hsl(210 100% 70%)',
  dark: 'hsl(210 85% 40%)',
  darker: 'hsl(210 80% 30%)',
  foreground: 'hsl(0 0% 100%)',
} as const;

/**
 * Secondary Color Palette
 * Used for secondary actions and supporting elements
 */
export const SECONDARY = {
  main: 'hsl(210 40% 96.1%)',
  light: 'hsl(210 50% 98%)',
  dark: 'hsl(210 35% 90%)',
  foreground: 'hsl(222.2 47.4% 11.2%)',
} as const;

/**
 * Neutral Colors
 * Background, foreground, borders, and text
 */
export const NEUTRAL = {
  background: 'hsl(0 0% 100%)',
  foreground: 'hsl(222.2 84% 4.9%)',
  card: 'hsl(0 0% 100%)',
  cardForeground: 'hsl(222.2 84% 4.9%)',
  border: 'hsl(214.3 31.8% 91.4%)',
  input: 'hsl(214.3 31.8% 91.4%)',
  ring: 'hsl(222.2 84% 4.9%)',
  muted: 'hsl(210 40% 96.1%)',
  mutedForeground: 'hsl(215.4 16.3% 46.9%)',
  sectionBackground: '#F2F5F9',
} as const;

/**
 * Accent Colors
 * Used for highlights, focus states, and special attention
 */
export const ACCENT = {
  main: 'hsl(210 40% 96.1%)',
  light: 'hsl(210 50% 98%)',
  dark: 'hsl(210 35% 90%)',
  foreground: 'hsl(222.2 47.4% 11.2%)',
} as const;

/**
 * Icon Colors for Core Values
 * Used in About page Core Values section
 */
export const VALUE_ICON_COLORS = [
  '#5B5EFF', // Blue
  '#00D4D4', // Cyan/Turquoise
  '#6AC76A', // Green
  '#FF6B9D', // Pink
] as const;

/**
 * Status Colors
 * Used for error, success, warning, and info states
 */
export const STATUS = {
  error: 'hsl(0 84.2% 60.2%)',
  errorForeground: 'hsl(210 40% 98%)',
  success: 'hsl(142.4 76.1% 36.3%)',
  successForeground: 'hsl(0 0% 100%)',
  warning: 'hsl(38.6 92.1% 50.2%)',
  warningForeground: 'hsl(0 0% 0%)',
  info: 'hsl(217.2 91.2% 59.8%)',
  infoForeground: 'hsl(0 0% 100%)',
} as const;

/**
 * Pastel Colors
 * Friendly, soft colors for partnership cards and secondary content
 */
export const PASTEL = {
  blue: {
    main: 'hsl(210 100% 95%)',
    foreground: 'hsl(210 80% 25%)',
  },
  green: {
    main: 'hsl(140 60% 92%)',
    foreground: 'hsl(140 70% 20%)',
  },
  yellow: {
    main: 'hsl(45 100% 90%)',
    foreground: 'hsl(45 80% 20%)',
  },
  purple: {
    main: 'hsl(270 60% 95%)',
    foreground: 'hsl(270 70% 25%)',
  },
  pink: {
    main: 'hsl(330 70% 95%)',
    foreground: 'hsl(330 80% 25%)',
  },
} as const;

/**
 * Popover Colors
 * Used for tooltips, popovers, and floating elements
 */
export const POPOVER = {
  main: 'hsl(0 0% 100%)',
  foreground: 'hsl(222.2 84% 4.9%)',
} as const;

/**
 * Soccer Theme (Green Override)
 * Used for soccer-specific pillars and accents
 */
export const SOCCER_THEME = {
  title: 'hsl(142 65% 38%)',
  subtitle: 'hsl(142 45% 52%)',
  cardLight: 'hsl(142 45% 92%)',
  cardLightText: 'hsl(142 45% 20%)',
  cardDarkStart: 'hsl(142 60% 48%)',
  cardDarkEnd: 'hsl(142 70% 38%)',
  quote: 'hsl(142 50% 42%)',
  primary: 'hsl(142 70% 40%)',
  primaryForeground: 'hsl(0 0% 100%)',
  shadowSoft: '0 6px 24px -8px hsl(142 65% 55% / 0.28)',
  shadowMedium: '0 10px 32px -10px hsl(142 70% 45% / 0.24)',
  shadowStrong: '0 14px 42px -12px hsl(142 70% 40% / 0.22)',
  hover: 'hsl(142 70% 32%)',
} as const;

/**
 * Rowing Blue Theme (Requested Primary Blue)
 * Used for rowing tab, cards, and accents
 */
export const ROWING_BLUE_THEME = {
  primary: PRIMARY.main, // #0d7ff2
  primaryLight: 'hsl(210 95% 60%)',
  primaryHover: 'hsl(210 90% 42%)',
  primaryText: 'hsl(0 0% 100%)',
  shades: [
    'hsl(210 90% 94%)',
    'hsl(210 90% 88%)',
    'hsl(210 90% 82%)',
    'hsl(210 90% 68%)',
    'hsl(210 90% 58%)',
    PRIMARY.main,
  ],
  iconLight: 'hsl(210 90% 38%)',
  iconDark: 'hsl(0 0% 100%)',
  textLight: 'hsl(210 30% 28%)',
  textDark: 'hsl(0 0% 100%)',
  heading: 'hsl(210 90% 42%)',
  badgeBackground: 'hsl(210 90% 92%)',
  badgeText: 'hsl(210 90% 50%)',
  shadowLight: '0 14px 34px -14px hsl(210 90% 55% / 0.26)',
  shadowDark: '0 16px 38px -14px hsl(210 90% 45% / 0.28)',
} as const;

/**
 * Coach Profile Themes (utility class tokens)
 * Centralized to keep sport theming consistent across coach profile pages.
 */
export const COACH_PROFILE_THEMES = {
  default: {
    buttonClass: 'bg-blue-500 hover:bg-blue-600 text-white rounded-full',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    iconColor: 'text-blue-600 dark:text-blue-400',
    certBg: 'bg-blue-50 dark:bg-blue-900/20',
    certIcon: 'text-blue-600 dark:text-blue-400',
    gradientFrom: 'from-blue-50',
    gradientTo: 'to-slate-100/20',
  },
  soccer: {
    buttonClass: 'bg-green-600 hover:bg-green-700 text-white rounded-full',
    badgeClass: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
    iconColor: 'text-green-600 dark:text-green-400',
    certBg: 'bg-green-50 dark:bg-green-900/20',
    certIcon: 'text-green-600 dark:text-green-400',
    gradientFrom: 'from-green-50',
    gradientTo: 'to-slate-100/20',
  },
  rowing: {
    buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white rounded-full',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    iconColor: 'text-blue-600 dark:text-blue-400',
    certBg: 'bg-blue-50 dark:bg-blue-900/20',
    certIcon: 'text-blue-600 dark:text-blue-400',
    gradientFrom: 'from-blue-50',
    gradientTo: 'to-slate-100/20',
  },
} as const;

/**
 * Athlete Development Theme
 * Specific colors for athlete development features
 */
export const ATHLETE_THEME = {
  title: 'hsl(218 89% 60%)',
  subtitle: 'hsl(218 70% 70%)',
  cardLight: 'hsl(218 60% 92%)',
  cardLightText: 'hsl(218 50% 25%)',
  cardDarkStart: 'hsl(218 85% 65%)',
  cardDarkEnd: 'hsl(218 90% 50%)',
  quote: 'hsl(218 80% 55%)',
} as const;

/**
 * Crew/Rowing Theme
 * Specific colors for crew coxswains and rowing features
 */
export const CREW_THEME = {
  background: 'hsl(15 30% 94%)',
  red: 'hsl(0 70% 50%)',
  black: 'hsl(0 0% 15%)',
  cardLight: 'hsl(15 25% 96%)',
  cardLightText: 'hsl(0 0% 25%)',
  button: 'hsl(15 45% 35%)',
  // Red gradient pillars - lightest to darkest
  pillar1: 'hsl(0 30% 95%)',   // Lightest red tint
  pillar2: 'hsl(0 35% 90%)',
  pillar3: 'hsl(0 40% 85%)',
  pillar4: 'hsl(0 45% 75%)',
  pillar5: 'hsl(0 50% 65%)',
  pillar6: 'hsl(0 55% 55%)',   // Darkest red tint
  pillarTextLight: 'hsl(0 0% 25%)',   // For lighter pillars
  pillarTextDark: 'hsl(0 0% 95%)',    // For darker pillars
} as const;

/**
 * Sidebar Colors
 * Specific colors for sidebar navigation
 */
export const SIDEBAR = {
  background: 'hsl(0 0% 98%)',
  foreground: 'hsl(240 5.3% 26.1%)',
} as const;

/**
 * Shadow Colors
 * Used for elevation and depth
 */
export const SHADOWS = {
  // Athlete theme shadows
  athleteSoft: '0 4px 20px -2px hsl(218 60% 80% / 0.3)',
  athleteMedium: '0 8px 30px -4px hsl(218 80% 60% / 0.2)',
  athleteStrong: '0 12px 40px -6px hsl(218 80% 60% / 0.15)',
  // Crew theme shadows
  crewSoft: '0 4px 20px -2px hsl(0 70% 50% / 0.15)',
  crewMedium: '0 8px 30px -4px hsl(0 70% 50% / 0.1)',
  crewStrong: '0 12px 40px -6px hsl(0 70% 50% / 0.08)',
} as const;

/**
 * Cover Background Colors
 * Preset options for cover image backgrounds
 */
export const COVER_BG_COLORS = [
  '#f1f5f9',
  '#ffffff',
  '#111827',
  '#0f172a',
  '#1f2937',
  '#0ea5e9',
  '#22c55e',
  '#f97316',
  '#e11d48',
  '#a855f7',
  '#facc15',
  '#38bdf8',
] as const;

/**
 * Complete Color Palette for Easy Access
 * Organized by category for quick reference
 */
export const colors = {
  primary: PRIMARY,
  secondary: SECONDARY,
  neutral: NEUTRAL,
  accent: ACCENT,
  status: STATUS,
  pastel: PASTEL,
  popover: POPOVER,
  athleteTheme: ATHLETE_THEME,
  soccerTheme: SOCCER_THEME,
  rowingBlueTheme: ROWING_BLUE_THEME,
  crewTheme: CREW_THEME,
  sidebar: SIDEBAR,
  shadows: SHADOWS,
} as const;

/**
 * Gradient Presets
 * Pre-defined gradients for consistent styling
 */
export const GRADIENTS = {
  athleteCardDark: `linear-gradient(135deg, ${ATHLETE_THEME.cardDarkStart}, ${ATHLETE_THEME.cardDarkEnd})`,
  crewMain: `linear-gradient(135deg, ${CREW_THEME.red}, ${CREW_THEME.button})`,
  primaryGradient: `linear-gradient(135deg, ${PRIMARY.main}, ${PRIMARY.dark})`,
  secondaryGradient: `linear-gradient(135deg, ${SECONDARY.main}, ${SECONDARY.dark})`,
} as const;

/**
 * Example Usage:
 * 
 * // 1. Import the colors
 * import { colors, GRADIENTS } from '@/config/colors';
 * 
 * // 2. Use in inline styles
 * <div style={{ backgroundColor: colors.primary.main, color: colors.primary.foreground }}>
 *   Primary Button
 * </div>
 * 
 * // 3. Use in Tailwind classes (already defined in index.css)
 * <button className="bg-primary text-primary-foreground hover:bg-primary/90">
 *   Click me
 * </button>
 * 
 * // 4. Use gradients
 * <div style={{ background: GRADIENTS.athleteCardDark }}>
 *   Card with gradient
 * </div>
 * 
 * // 5. Use status colors
 * <div style={{ color: colors.status.error }}>
 *   Error message
 * </div>
 * 
 * // 6. Use theme colors
 * <div style={{ backgroundColor: colors.crewTheme.pillar1 }}>
 *   Crew pillar element
 * </div>
 * 
 * To change colors globally:
 * 1. Update the value in this file
 * 2. The change applies everywhere the color is imported
 * 3. For Tailwind classes, the change is automatic via CSS variables in index.css
 */

/**
 * Booking Confirmation Theme
 * Colors for booking confirmation page
 */
export const BOOKING_CONFIRMATION = {
  headerBg: '#eef4ff',
  cardBg: '#eef4ff',
  cardBorder: '#0d7ff2',
  innerWhiteBg: '#ffffff',
  innerBorder: '#e0e9f5',
  buttonPrimaryStart: '#4387f5',
  buttonPrimaryEnd: '#0d7ff2',
  buttonPrimaryHoverStart: '#3971d9',
  buttonPrimaryHoverEnd: '#0c6dd7',
  buttonBorder: '#0d7ff2',
  buttonText: '#0d7ff2',
  buttonHoverBg: '#f0f7ff',
  successIconColor: '#16a34a',
  successBadgeBg: '#16a34a',
  heading: '#0f172a',
  subtext: '#475569',
  price: '#0d7ff2',
  borderLight: '#bfe0ff',
  avatarBg: '#0d7ff2',
  avatarText: '#ffffff',
} as const;

export default colors;
