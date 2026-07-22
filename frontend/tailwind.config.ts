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
				'inter': ['Inter', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				'app-background': 'hsl(var(--app-background))',
				'app-pill': {
					DEFAULT: 'hsl(var(--app-pill))',
					foreground: 'hsl(var(--app-pill-foreground))'
				},
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				'athlete': {
					title: 'hsl(var(--athlete-title))',
					subtitle: 'hsl(var(--athlete-subtitle))',
					'card-light': 'hsl(var(--athlete-card-light))',
					'card-light-text': 'hsl(var(--athlete-card-light-text))',
					'card-dark-start': 'hsl(var(--athlete-card-dark-start))',
					'card-dark-end': 'hsl(var(--athlete-card-dark-end))',
					quote: 'hsl(var(--athlete-quote))'
				},
				'pastel': {
					blue: 'hsl(var(--pastel-blue))',
					'blue-foreground': 'hsl(var(--pastel-blue-foreground))',
					green: 'hsl(var(--pastel-green))',
					'green-foreground': 'hsl(var(--pastel-green-foreground))',
					yellow: 'hsl(var(--pastel-yellow))',
					'yellow-foreground': 'hsl(var(--pastel-yellow-foreground))',
					purple: 'hsl(var(--pastel-purple))',
					'purple-foreground': 'hsl(var(--pastel-purple-foreground))',
					pink: 'hsl(var(--pastel-pink))',
					'pink-foreground': 'hsl(var(--pastel-pink-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
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
			}
		}
	},
	plugins: [tailwindAnimate],
} satisfies Config;
