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
        sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', '"Inter"', "system-ui", "sans-serif"],
        mono: ["ui-monospace", '"SF Mono"', "Menlo", "monospace"],
        display: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Display"', '"Inter"', "system-ui", "sans-serif"],
      },
      borderRadius: { panel: "22px", chip: "10px" },
      maxWidth: { prose: "70ch" },
    },
  },
  plugins: [],
} satisfies Config;
