/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0fdf4",
          500: "#15803d", // Oscurecido ligeramente (antes era el valor de 600) para mejor contraste
          600: "#166534", // Ajustamos el 600 para mantener la escala
          700: "#14532d", // Ajustamos el 700
        },
        secondary: {
          50: "#fefce8",
          500: "#d97706", // Oscurecido (antes era eab308) para pasar pruebas de contraste con texto blanco
          600: "#b45309",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
