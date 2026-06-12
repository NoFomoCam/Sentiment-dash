/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        dashboard: {
          bg: '#0a0f1a',
          card: '#0f172a',
          border: '#1e293b',
          text: '#f1f5f9',
          muted: '#475569',
          accent: '#eab308',
          buy: '#22c55e',
          sell: '#ef4444',
          caution: '#f97316',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    }
  },
  plugins: [],
};
