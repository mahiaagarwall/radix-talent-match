// Tailwind is used ONLY by the Company Directory feature (src/features/company-directory).
// It is scoped so it cannot restyle the rest of the app:
// - content: only that folder is scanned, so only its classes are generated;
// - important: '.cd-root' compiles every utility as ".cd-root .class";
// - preflight is off; directory.css applies a reset inside .cd-root only.
const hsl = (v) => `hsl(var(--${v}))`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/features/company-directory/**/*.{ts,tsx}'],
  important: '.cd-root',
  darkMode: ['selector', '[data-theme="dark"]'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font)'],
        body: ['var(--font)'],
      },
      colors: {
        border: hsl('border'),
        input: hsl('input'),
        ring: hsl('ring'),
        background: hsl('background'),
        surface: hsl('surface'),
        subtle: hsl('subtle'),
        indigo: hsl('indigo'),
        purple: hsl('purple'),
        success: hsl('success'),
        warning: hsl('warning'),
        error: hsl('error'),
        foreground: hsl('foreground'),
        primary: { DEFAULT: hsl('primary'), hover: hsl('primary-hover'), foreground: hsl('primary-foreground') },
        secondary: { DEFAULT: hsl('secondary'), foreground: hsl('secondary-foreground') },
        muted: { DEFAULT: hsl('muted'), foreground: hsl('muted-foreground') },
        accent: { DEFAULT: hsl('accent'), foreground: hsl('accent-foreground') },
        destructive: { DEFAULT: hsl('destructive'), foreground: hsl('destructive-foreground') },
        card: { DEFAULT: hsl('card'), foreground: hsl('card-foreground') },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: '0 1px 2px 0 hsl(222 47% 11% / 0.05)',
        'card-hover': '0 4px 12px -2px hsl(222 47% 11% / 0.10)',
      },
    },
  },
  plugins: [],
};
