/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        brand: { coral: '#FF5A5F', mint: '#00E5D9', amber: '#FFB703' },
        bg: { light: '#FBFBFD', dark: '#0B0F17' },
        surface: { light: '#FFFFFF', dark: '#151C28' },
        text: { light: '#0B0F17', dark: '#FBFBFD' },
        muted: { light: '#475569', dark: '#94A3B8' }
      },
      boxShadow: {
        'glass': '0 8px 24px -6px rgba(11, 15, 23, 0.05), 0 2px 6px -2px rgba(11, 15, 23, 0.02)',
        'float': '0 16px 36px -8px rgba(11, 15, 23, 0.08)',
        'glow-coral': '0 0 40px rgba(255, 90, 95, 0.15)',
        'glow-mint': '0 0 40px rgba(0, 229, 217, 0.1)',
      }
    }
  },
  plugins: [],
}
