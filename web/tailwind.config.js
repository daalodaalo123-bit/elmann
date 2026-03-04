/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff9eb",
          100: "#fff1cf",
          200: "#ffe1a3",
          300: "#f8c968",
          400: "#eab13a",
          500: "#cc9227",
          600: "#b07a1f",
          700: "#8e611a",
          800: "#734d18",
          900: "#5f4017"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
