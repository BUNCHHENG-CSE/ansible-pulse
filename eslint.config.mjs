import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Legacy code uses `any` heavily for parsed YAML/JSON; surface as warnings, not failures.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "frontend/**",
      "backend/**",
      "demo_repos/**",
      "scripts/**",
      "prisma/**",
      "next-env.d.ts",
      "*.config.js",
      "*.config.ts",
      "*.config.mjs",
    ],
  },
];

export default eslintConfig;
