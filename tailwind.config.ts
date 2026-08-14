import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080b0a",
        panel: "#101613",
        moss: "#1f7a4c",
        mint: "#9bf2b5",
        amber: "#ffd166"
      },
      boxShadow: {
        glow: "0 0 40px rgba(155, 242, 181, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
