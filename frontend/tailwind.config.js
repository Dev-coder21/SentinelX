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
        background: "#080E1C",
        surface: {
          0: "#080E1C",
          1: "#0D1628",
          2: "#121D34",
          3: "#172644",
        },
        border: {
          subtle: "#16233B",
          default: "#1E2E4E",
          elevated: "#283E66",
        },
        brand: {
          cyan: "#3DD6C4",
          violet: "#6366F1",
          amber: "#F59E0B",
          crimson: "#F43F5E",
        },
        risk: {
          low: "#10B981",
          medium: "#F59E0B",
          high: "#F97316",
          critical: "#F43F5E",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
