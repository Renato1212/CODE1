import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0b",
        panel: "#111114",
        panel2: "#17171c",
        border: "#23232b",
        muted: "#6b7280",
        text: "#e5e7eb",
        buy: "#10b981",
        sell: "#ef4444",
        accent: "#f59e0b",
      },
      fontFamily: { mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"] },
    },
  },
  plugins: [],
};
export default config;
