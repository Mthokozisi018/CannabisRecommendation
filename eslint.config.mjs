import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", ".next-stale-*/**", ".vercel/**", "node_modules/**", "tmp/**"]
  }
];

export default config;
