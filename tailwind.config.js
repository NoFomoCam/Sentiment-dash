/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './Components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        dashboard: {
          // Instrument surfaces — near-black cool ground, layered steel panels
          bg: '#0a0d14',
          card: '#10151f',
          elevated: '#16202f',
          border: '#22304a',
          hairline: '#1a2334',
          // Ink — lifted for legibility + punch
          text: '#eef2fa',
          muted: '#a3b6d6',
          faint: '#7e93ba',
          // Brand chrome = electric blue (energy accent, still cool vs the amber data midpoint)
          brand: '#4f9dff',
          brandbright: '#6fb2ff',
          // Reserved fear → greed data scale (poppier)
          accent: '#f7b737',
          buy: '#23d18b',
          watch: '#8fe04f',
          neutral: '#f7b737',
          caution: '#fb8a3c',
          sell: '#f64f68',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 30px -12px rgba(0,0,0,0.65)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'sheen': {
          '0%': { backgroundPosition: '-120% 0' },
          '100%': { backgroundPosition: '220% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'pulse-glow': 'pulse-glow 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
