/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F5C5C',
          50: '#E8F4F4',
          100: '#D1E9E9',
          200: '#A3D3D3',
          300: '#6BB5B5',
          400: '#3D9191',
          500: '#0F5C5C',
          600: '#0C4A4A',
          700: '#093838',
          800: '#062626',
          900: '#031313',
          container: '#147A7A',
          fixed: '#D1E9E9',
        },
        'on-primary': '#ffffff',
        secondary: {
          DEFAULT: '#4A5568',
          container: '#E2E8F0',
        },
        'on-secondary': '#ffffff',
        'on-secondary-container': '#2D3748',
        accent: {
          DEFAULT: '#C45C26',
          soft: '#FDF0E9',
        },
        surface: {
          DEFAULT: '#F7FAFC',
          base: '#EEF3F6',
          card: '#FFFFFF',
          muted: '#E8EEF2',
        },
        'on-surface': '#1A202C',
        'on-surface-variant': '#4A5568',
        outline: {
          DEFAULT: '#718096',
          variant: '#CBD5E0',
        },
        'status-success': '#2F855A',
        'status-error': '#C53030',
        'status-warn': '#B7791F',
        'status-info': '#2B6CB0',
        error: {
          DEFAULT: '#C53030',
          container: '#FED7D7',
        },
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'Manrope', 'sans-serif'],
        display: ['var(--font-source-serif)', 'Source Serif 4', 'serif'],
      },
      maxWidth: {
        'container-max': '1440px',
      },
      boxShadow: {
        card: '0 1px 3px rgb(15 92 92 / 0.06), 0 4px 12px rgb(26 32 44 / 0.04)',
        elevate: '0 8px 24px rgb(15 92 92 / 0.12)',
      },
      backgroundImage: {
        'hero-mesh':
          'radial-gradient(ellipse at 20% 0%, rgba(15,92,92,0.12), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(196,92,38,0.08), transparent 45%), linear-gradient(180deg, #EEF3F6 0%, #F7FAFC 100%)',
      },
    },
  },
  plugins: [],
}
