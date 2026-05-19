/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#0b1b4d',
          gold: '#f1ad26',
          'gold-dark': '#c98918',
          'gold-darker': '#8a5f10',
          cream: '#faf6ee',
          ink: '#1c1810',
        },
      },
    },
  },
  plugins: [],
}

