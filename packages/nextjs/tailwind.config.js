/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./utils/**/*.{js,ts,jsx,tsx}"],
  plugins: [require("daisyui")],
  darkTheme: "dark",
  darkMode: ["selector", "[data-theme='dark']"],
  // DaisyUI theme colors - Wild Dark Meme Style
  daisyui: {
    themes: [
      {
        dark: {
          // Neon cyan for primary actions
          primary: "#00FFFF",
          "primary-content": "#000000",
          // Electric green for secondary
          secondary: "#00FF00",
          "secondary-content": "#000000",
          // Hot pink for accents
          accent: "#FF00FF",
          "accent-content": "#000000",
          // Bright white for text
          neutral: "#FFFFFF",
          "neutral-content": "#000000",
          // Deep dark backgrounds
          "base-100": "#0a0a0a",
          "base-200": "#1a1a1a",
          "base-300": "#2a2a2a",
          "base-content": "#FFFFFF",
          // Neon blue for info
          info: "#0080FF",
          // Bright green for success
          success: "#00FF80",
          // Electric yellow for warnings
          warning: "#FFFF00",
          // Hot red for errors
          error: "#FF0040",

          "--rounded-btn": "1rem",

          ".tooltip": {
            "--tooltip-tail": "6px",
            "--tooltip-color": "oklch(var(--p))",
          },
          ".link": {
            textUnderlineOffset: "2px",
          },
          ".link:hover": {
            opacity: "80%",
          },
        },
      },
    ],
  },
  theme: {
    extend: {
      boxShadow: {
        center: "0 0 12px -2px rgb(0 0 0 / 0.05)",
      },
      animation: {
        "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
};
