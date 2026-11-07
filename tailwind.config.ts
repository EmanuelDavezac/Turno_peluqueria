import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        sunken: 'rgb(var(--sunken) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        mute: 'rgb(var(--mute) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        'brand-ink': 'rgb(var(--brand-ink) / <alpha-value>)',
        turnos: { DEFAULT: 'rgb(var(--turnos) / <alpha-value>)', soft: 'rgb(var(--turnos-soft) / <alpha-value>)' },
        llegada: { DEFAULT: 'rgb(var(--llegada) / <alpha-value>)', soft: 'rgb(var(--llegada-soft) / <alpha-value>)' },
        mixto: { DEFAULT: 'rgb(var(--mixto) / <alpha-value>)', soft: 'rgb(var(--mixto-soft) / <alpha-value>)' },
        cerrado: { DEFAULT: 'rgb(var(--cerrado) / <alpha-value>)', soft: 'rgb(var(--cerrado-soft) / <alpha-value>)' },
      },
    },
  },
  plugins: [],
} satisfies Config;
