import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050d1a',
          900: '#0a1628',
          800: '#0f2040',
          700: '#1a3060',
          600: '#1a3a60',
        },
        gold: {
          300: '#FFF9C4',
          400: '#FFE57F',
          500: '#FFD700',
          600: '#F5C000',
          700: '#E6A800',
        },
      },
    },
  },
  plugins: [],
};

export default config;
