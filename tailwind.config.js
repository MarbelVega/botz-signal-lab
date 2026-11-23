/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        call: { DEFAULT: '#16a34a', soft: '#dcfce7' },
        put: { DEFAULT: '#dc2626', soft: '#fee2e2' },
        otc: '#f59e0b',
        panel: '#0f172a',
      },
      fontFamily: { mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] },
    },
  },
  plugins: [],
};
