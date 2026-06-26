/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kinder: {
          blue:     '#4F9DFF',
          yellow:   '#FFD93D',
          green:    '#6BCB77',
          coral:    '#FF6B6B',
          lavender: '#B388FF',
          sky:      '#EAF8FF',
          dark:     '#0f172a',
          card:     '#1e293b',
          border:   '#334155',
        },
        // legacy aliases (used in some pages)
        brand: {
          purple: '#B388FF',
          cyan:   '#4F9DFF',
          pink:   '#FF6B6B',
          yellow: '#FFD93D',
          green:  '#6BCB77',
          dark:   '#0f172a',
          card:   '#1e293b',
          border: '#334155',
        },
      },
      backgroundImage: {
        'hero-dark': 'linear-gradient(135deg, #0f172a 0%, #1e0a3c 50%, #0a1a3c 100%)',
        'hero-light': 'linear-gradient(135deg, #EAF8FF 0%, #dbeafe 100%)',
      },
      boxShadow: {
        glow:       '0 0 20px rgba(79, 157, 255, 0.35)',
        'glow-yellow': '0 0 20px rgba(255, 217, 61, 0.4)',
        'glow-green':  '0 0 15px rgba(107, 203, 119, 0.35)',
        card:       '0 2px 12px rgba(0,0,0,0.06)',
        'card-dark':'0 2px 12px rgba(0,0,0,0.3)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
