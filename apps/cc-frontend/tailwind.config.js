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
          DEFAULT: '#004ac6',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          container: '#2563eb',
          fixed: '#dbe1ff',
          'fixed-dim': '#b4c5ff',
        },
        'on-primary': '#ffffff',
        'on-primary-container': '#eeefff',
        'on-primary-fixed': '#00174b',
        secondary: {
          DEFAULT: '#555f6f',
          container: '#d6e0f3',
        },
        'on-secondary': '#ffffff',
        'on-secondary-container': '#596373',
        tertiary: {
          DEFAULT: '#005a82',
          container: '#0074a6',
        },
        surface: {
          DEFAULT: '#f9f9ff',
          base: '#F3F4F6',
          card: '#FFFFFF',
          variant: '#dce2f3',
          dim: '#d3daea',
          bright: '#f9f9ff',
          container: '#e7eefe',
          'container-low': '#f0f3ff',
          'container-high': '#e2e8f8',
          'container-highest': '#dce2f3',
          'container-lowest': '#ffffff',
        },
        'on-surface': '#151c27',
        'on-surface-variant': '#434655',
        'on-background': '#151c27',
        background: '#f9f9ff',
        outline: {
          DEFAULT: '#737686',
          variant: '#c3c6d7',
        },
        'status-success': '#10B981',
        'status-error': '#EF4444',
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        'container-max': '1440px',
      },
      boxShadow: {
        card: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
        elevate: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}
