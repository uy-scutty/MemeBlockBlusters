import type { Config } from "tailwindcss";

// Design tokens — "midnight premiere" direction:
// near-black theatre backdrop, marquee gold + meme-magenta accents,
// condensed poster display type, film-strip structural motif.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        theatre: {
          950: "#0B0B0D",
          900: "#131317",
          800: "#1D1D23",
          700: "#2A2A33",
        },
        marquee: {
          DEFAULT: "#F2C14E",
          dim: "#B8912F",
        },
        meme: {
          DEFAULT: "#FF3EA5",
          dim: "#C22E7C",
        },
        film: {
          paper: "#F4F1EA",
        },
      },
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
        body: ["'Space Grotesk'", "sans-serif"],
        counter: ["'Space Mono'", "monospace"],
      },
      backgroundImage: {
        grain:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
export default config;
