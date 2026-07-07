/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0075de',
          active: '#005bab',
        },
        secondary: '#213183',
        'on-primary': '#ffffff',
        canvas: {
          DEFAULT: '#ffffff',
          soft: '#f6f5f4',
        },
        surface: '#ffffff',
        ink: {
          DEFAULT: '#000000',
          secondary: '#31302e',
          muted: '#615d59',
          faint: '#a39e98',
        },
        hairline: '#e6e6e6',
        accent: {
          sky: '#62aef0',
          purple: {
            DEFAULT: '#d6b6f6',
            deep: '#391c57',
          },
          pink: '#ff64c8',
          orange: {
            DEFAULT: '#dd5b00',
            deep: '#793400',
          },
          teal: '#2a9d99',
          green: '#1aae39',
          brown: '#523410',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'system-ui', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xs: '4px',
        sm: '5px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      spacing: {
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '28px',
        xxl: '32px',
      },
      fontSize: {
        'display-1': ['64px', { lineHeight: '1.0', fontWeight: '700', letterSpacing: '-2.125px' }],
        'display-2': ['54px', { lineHeight: '1.04', fontWeight: '700', letterSpacing: '-1.875px' }],
        'heading-1': ['40px', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-1px' }],
        'heading-2': ['26px', { lineHeight: '1.23', fontWeight: '700', letterSpacing: '-0.625px' }],
        'heading-3': ['22px', { lineHeight: '1.27', fontWeight: '700', letterSpacing: '-0.25px' }],
        title: ['20px', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '-0.125px' }],
        'body-md': ['16px', { lineHeight: '1.5', fontWeight: '400', letterSpacing: '0' }],
        'body-sm': ['15px', { lineHeight: '1.33', fontWeight: '400', letterSpacing: '0' }],
        button: ['16px', { lineHeight: '1.5', fontWeight: '500', letterSpacing: '0' }],
        caption: ['14px', { lineHeight: '1.43', fontWeight: '400', letterSpacing: '0' }],
        eyebrow: ['12px', { lineHeight: '1.33', fontWeight: '600', letterSpacing: '0.125px' }],
      },
      boxShadow: {
        'soft-1': 'rgba(0,0,0,0.01) 0 0.175px 1.041px, rgba(0,0,0,0.02) 0 0.8px 2.925px, rgba(0,0,0,0.027) 0 2.025px 7.847px, rgba(0,0,0,0.04) 0 4px 18px',
        'elevated': 'rgba(0,0,0,0.01) 0 0.175px 1.041px, rgba(0,0,0,0.02) 0 0.8px 2.925px, rgba(0,0,0,0.027) 0 2.025px 7.847px, rgba(0,0,0,0.04) 0 4px 18px, rgba(0,0,0,0.05) 0 23px 52px',
      },
    },
  },
  plugins: [],
}
