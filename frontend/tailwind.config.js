/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B1120",
        surface: "#111A2E",
        "surface-card": "#162036",
        "surface-border": "#1E2C48",
        brand: {
          cyan: "#3DD6C4",
          violet: "#8B7CFF",
          amber: "#FFB020",
          crimson: "#FF3D3D",
        },
        risk: {
          low: "#3DD6C4",
          medium: "#FFB020",
          high: "#FF7844",
          critical: "#FF3D3D",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
