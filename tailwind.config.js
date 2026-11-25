/**
 * Design tokens for the "Ink & Brass" visual system.
 *
 * The renderer markup predates the redesign, so the classic Tailwind colour
 * names are remapped onto the new ramps: slate = warm ink, blue = brass,
 * indigo = bronze, emerald = teal, amber = clay, rose/red = brick and
 * purple = plum. Every existing utility therefore resolves to the new palette
 * instead of the default blue-grey SaaS look.
 */
const ink = {
  50: "#faf7f2",
  100: "#f2ece3",
  200: "#ded4c6",
  300: "#c0b4a3",
  400: "#9d9182",
  500: "#7b7063",
  600: "#5c5349",
  700: "#413a30",
  800: "#2a241d",
  900: "#191510",
  950: "#0b0a08"
}

const brass = {
  50: "#fdf9ef",
  100: "#f8efd8",
  200: "#f0dfb0",
  300: "#e6c98a",
  400: "#d6ab5b",
  500: "#c08f38",
  600: "#9c6f24",
  700: "#7c571f",
  800: "#5f431d",
  900: "#413015",
  950: "#241a09"
}

const bronze = {
  50: "#fbf5ed",
  100: "#f4e7d6",
  200: "#e8cdab",
  300: "#d8ad7c",
  400: "#c38d55",
  500: "#a86f3d",
  600: "#8a5630",
  700: "#6d4328",
  800: "#523421",
  900: "#3a2518",
  950: "#20140c"
}

const teal = {
  50: "#f0fdf8",
  100: "#d8f8ec",
  200: "#aeeeda",
  300: "#78dcbc",
  400: "#46c39f",
  500: "#2ba688",
  600: "#1f876e",
  700: "#1b6b59",
  800: "#185447",
  900: "#123a31",
  950: "#08211c"
}

const clay = {
  50: "#fdf7ee",
  100: "#f9ead3",
  200: "#f1d1a5",
  300: "#e6b276",
  400: "#d8954e",
  500: "#c07834",
  600: "#a35e29",
  700: "#824a23",
  800: "#653a20",
  900: "#472817",
  950: "#27150a"
}

const brick = {
  50: "#fdf3f1",
  100: "#fae2dd",
  200: "#f4c6bd",
  300: "#e9a094",
  400: "#d97a6b",
  500: "#c85f4e",
  600: "#ad4839",
  700: "#8c392d",
  800: "#6c2d24",
  900: "#4a1f18",
  950: "#281010"
}

const plum = {
  50: "#f8f3fb",
  100: "#efe3f7",
  200: "#dbc4e9",
  300: "#c2a3d8",
  400: "#a883c2",
  500: "#8f66a9",
  600: "#754f8c",
  700: "#5d3f70",
  800: "#463055",
  900: "#31213c",
  950: "#1c1223"
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        slate: ink,
        gray: ink,
        zinc: ink,
        blue: brass,
        indigo: bronze,
        sky: brass,
        cyan: { ...brass, 400: "#e8d3a4", 500: "#dcc08a" },
        emerald: teal,
        green: teal,
        amber: clay,
        orange: clay,
        yellow: clay,
        rose: brick,
        red: brick,
        purple: plum,
        violet: plum
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Noto Naskh Arabic",
          "Vazirmatn",
          "Tahoma",
          "Arial",
          "sans-serif"
        ],
        mono: ["Consolas", "Cascadia Mono", "SFMono-Regular", "ui-monospace", "monospace"],
        display: ["Segoe UI Semibold", "Segoe UI", "Noto Naskh Arabic", "Tahoma", "sans-serif"]
      },
      borderRadius: {
        "3xl": "1.125rem",
        "2xl": "0.95rem",
        xl: "0.7rem",
        lg: "0.5rem"
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.35)",
        DEFAULT: "0 4px 12px -6px rgba(0, 0, 0, 0.55)",
        md: "0 10px 24px -14px rgba(0, 0, 0, 0.65)",
        lg: "0 18px 36px -26px rgba(0, 0, 0, 0.8)",
        xl: "0 24px 48px -32px rgba(0, 0, 0, 0.85)",
        "2xl": "0 34px 70px -40px rgba(0, 0, 0, 0.9)",
        inner: "inset 0 1px 0 rgba(255, 246, 230, 0.05)"
      },
      letterSpacing: {
        tightest: "-0.03em"
      },
      backgroundImage: {
        "brass-sheen": "linear-gradient(135deg, rgba(214, 171, 91, 0.18), rgba(214, 171, 91, 0) 60%)"
      }
    }
  },
  plugins: []
}
