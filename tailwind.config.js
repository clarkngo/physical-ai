/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        deepSea: '#002D62',
        pacificCyan: '#00A3E0',
        whiteHull: '#F2F2F2',
      },
    },
  },
  plugins: [],
};
