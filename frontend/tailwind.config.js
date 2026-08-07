/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          900: '#881337',
        },
        navy: {
          800: '#0f172a',
          900: '#020617',
          950: '#01040d'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
