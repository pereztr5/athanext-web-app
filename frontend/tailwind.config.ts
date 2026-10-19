import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
				inter: ['Inter', 'sans-serif'],
				dm: ['"DM Sans"', 'Inter', 'sans-serif'],
			},
			// AthaNext Design System type ramp (DM Sans). Product UI uses these 16 styles only.
			fontSize: {
				'page-title': ['32px', { lineHeight: '32px', fontWeight: '700', letterSpacing: '-0.05em' }],
				'page-title-phone': ['26px', { lineHeight: '28px', fontWeight: '700', letterSpacing: '-0.05em' }],
				highlight: ['28px', { lineHeight: '30px', fontWeight: '700', letterSpacing: '-0.05em' }],
				section: ['24px', { lineHeight: '30px', fontWeight: '600', letterSpacing: '-0.05em' }],
				'card-title': ['20px', { lineHeight: '22px', fontWeight: '500', letterSpacing: '-0.05em' }],
				subtitle: ['16px', { lineHeight: '18px', fontWeight: '500', letterSpacing: '-0.05em' }],
				'body-l': ['16px', { lineHeight: '18px', fontWeight: '400', letterSpacing: '-0.03em' }],
				'body-m': ['14px', { lineHeight: '18px', fontWeight: '400', letterSpacing: '-0.03em' }],
				'body-sm': ['12px', { lineHeight: '14px', fontWeight: '400', letterSpacing: '-0.03em' }],
				paragraph: ['14px', { lineHeight: '20px', fontWeight: '400', letterSpacing: '-0.03em' }],
				'paragraph-sm': ['12px', { lineHeight: '16px', fontWeight: '400', letterSpacing: '-0.03em' }],
				label: ['16px', { lineHeight: '18px', fontWeight: '500', letterSpacing: '-0.03em' }],
				'label-sm': ['14px', { lineHeight: '18px', fontWeight: '500', letterSpacing: '-0.03em' }],
				'label-xsm': ['12px', { lineHeight: '13px', fontWeight: '500', letterSpacing: '-0.03em' }],
				caption: ['12px', { lineHeight: '14px', fontWeight: '400', letterSpacing: '-0.03em' }],
				stat: ['32px', { lineHeight: '32px', fontWeight: '700', letterSpacing: '-0.03em' }],
			},
			colors: {
				// AthaNext Design System scales (project/tokens.json). Use these names, never raw hex.
				dark: {
					DEFAULT: '#1A202C',
					25: '#F3F4F4',
					50: '#E8E8E9',
					100: '#D1D2D5',
					200: '#A3A6AB',
					250: '#868A90',
					300: '#686B72',
					400: '#484D56',
					600: '#151A23',
					700: '#10131A',
				},
				light: {
					DEFAULT: '#F1F1E6',
					50: '#FDFDFC',
					100: '#FCFCFA',
					200: '#F9F9F5',
					300: '#F7F7F0',
					400: '#F4F4EB',
					525: '#EAEADF',
					550: '#D9D9CF',
					600: '#C1C1B8',
				},
				error: {
					DEFAULT: '#FB4747',
					50: '#FEECEC',
					100: '#FEDADA',
					200: '#FDB5B5',
					300: '#FD9191',
					400: '#FC6C6C',
					600: '#C93939',
					700: '#972B2B',
				},
				success: {
					DEFAULT: '#32C152',
					50: '#DEECE1',
					100: '#CBE7D1',
					200: '#A5DEB1',
					300: '#7ED492',
					400: '#58CB72',
					600: '#289A42',
					700: '#1E7431',
					800: '#185C27',
				},
				info: {
					DEFAULT: '#F0B144',
					50: '#FDF7EC',
					100: '#FCEFDA',
					200: '#F9E0B4',
					300: '#F6D08F',
					400: '#F3C06A',
					600: '#C08D37',
					700: '#906A29',
					800: '#725421',
				},
				rating: {
					DEFAULT: '#E7DF3E',
					50: '#FCFBEB',
					100: '#FAF9D8',
					200: '#F5F2B2',
					300: '#F1EC8B',
					400: '#ECE565',
					600: '#B9B232',
					700: '#8B8625',
				},
				border: 'hsl(var(--border) / <alpha-value>)',
				input: 'hsl(var(--input) / <alpha-value>)',
				ring: 'hsl(var(--ring) / <alpha-value>)',
				background: 'hsl(var(--background) / <alpha-value>)',
				'app-background': '#F1F1E6',
				'app-pill': {
					DEFAULT: 'hsl(var(--app-pill) / <alpha-value>)',
					foreground: 'hsl(var(--app-pill-foreground) / <alpha-value>)'
				},
				foreground: 'hsl(var(--foreground) / <alpha-value>)',
				primary: {
					DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
					foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
					50: '#E5EDF7',
					100: '#CCDDF0',
					200: '#99BBE1',
					300: '#6698D2',
					400: '#3376C3',
					600: '#004390',
					700: '#00326C'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
					foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
					50: '#E7F4F8',
					100: '#D0EBF2',
					200: '#A1D6E4',
					300: '#73C2D7',
					400: '#44ADC9',
					600: '#117A96',
					700: '#0D5C71'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
					foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
					foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
					foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
					foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
				},
				card: {
					DEFAULT: 'hsl(var(--card) / <alpha-value>)',
					foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
				},
				'athlete': {
					title: 'hsl(var(--athlete-title) / <alpha-value>)',
					subtitle: 'hsl(var(--athlete-subtitle) / <alpha-value>)',
					'card-light': 'hsl(var(--athlete-card-light) / <alpha-value>)',
					'card-light-text': 'hsl(var(--athlete-card-light-text) / <alpha-value>)',
					'card-dark-start': 'hsl(var(--athlete-card-dark-start) / <alpha-value>)',
					'card-dark-end': 'hsl(var(--athlete-card-dark-end) / <alpha-value>)',
					quote: 'hsl(var(--athlete-quote) / <alpha-value>)'
				},
				'pastel': {
					blue: 'hsl(var(--pastel-blue) / <alpha-value>)',
					'blue-foreground': 'hsl(var(--pastel-blue-foreground) / <alpha-value>)',
					green: 'hsl(var(--pastel-green) / <alpha-value>)',
					'green-foreground': 'hsl(var(--pastel-green-foreground) / <alpha-value>)',
					yellow: 'hsl(var(--pastel-yellow) / <alpha-value>)',
					'yellow-foreground': 'hsl(var(--pastel-yellow-foreground) / <alpha-value>)',
					purple: 'hsl(var(--pastel-purple) / <alpha-value>)',
					'purple-foreground': 'hsl(var(--pastel-purple-foreground) / <alpha-value>)',
					pink: 'hsl(var(--pastel-pink) / <alpha-value>)',
					'pink-foreground': 'hsl(var(--pastel-pink-foreground) / <alpha-value>)'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background) / <alpha-value>)',
					foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
					primary: 'hsl(var(--sidebar-primary) / <alpha-value>)',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground) / <alpha-value>)',
					accent: 'hsl(var(--sidebar-accent) / <alpha-value>)',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground) / <alpha-value>)',
					border: 'hsl(var(--sidebar-border) / <alpha-value>)',
					ring: 'hsl(var(--sidebar-ring) / <alpha-value>)'
				}
			},
			borderRadius: {
				card: '10px',
				control: '8px',
				pill: '4px',
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			backgroundImage: {
				'gradient-light': 'var(--gradient-light)',
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-dark': 'var(--gradient-dark)'
			},
			boxShadow: {
				// The one shadow: floating layers only (modals, menus, popovers, toasts).
				overlay: '0 0 15px rgba(0, 0, 0, 0.05)',
				'soft': 'var(--shadow-soft)',
				'medium': 'var(--shadow-medium)',
				'strong': 'var(--shadow-strong)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			},
			maxWidth: {
				'8xl': '90rem',
				// Two content widths only: every main page, and single-task flows.
				wrapper: '1000px',
				'wrapper-focused': '640px',
			},
			width: {
				'col-main': '659px',
				'col-side': '317px',
			},
			spacing: {
				control: '34px',
				'control-sm': '30px',
				input: '38px',
				target: '44px',
			}
		}
	},
	plugins: [tailwindAnimate],
} satisfies Config;
