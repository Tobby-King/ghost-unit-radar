import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v("--bg"),
        surface: v("--surface"),
        raised: v("--raised"),
        line: v("--line"),
        ink: v("--ink"),
        muted: v("--muted"),
        accent: v("--accent"),
        "accent-ink": v("--accent-ink"),
        ok: v("--st-ok"),
        review: v("--st-review"),
        field: v("--st-field"),
        nodata: v("--st-none"),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        display: ['"Source Serif 4"', "Georgia", "serif"],
      },
      borderRadius: { panel: "10px", chip: "6px" },
      maxWidth: { prose: "70ch" },
    },
  },
  plugins: [],
} satisfies Config;
