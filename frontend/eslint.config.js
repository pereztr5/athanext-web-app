import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";


// Class strings the design system rules out. Checked in string literals and template literals.
const DS_PATTERNS = [
  ["-\\[#[0-9a-fA-F]{3,8}\\]", "Raw hex colour: use a design system token (e.g. text-dark-300)."],
  ["(^|\\s|:)text-\\[\\d+(\\.\\d+)?px\\]", "Off-scale font size: use a t-* style (text-body-m, text-label-xsm, ...)."],
  ["(^|\\s|:)shadow-(sm|md|lg|xl|2xl|soft|medium|strong)(\\s|$)", "Shadows are for floating layers only: use shadow-overlay or none."],
  ["(^|\\s|:)(bg|text|border)-white(\\s|$)", "Never pure white: use light-50 / light-300 / text-light."],
  ["disabled:opacity-", "Disabled uses light-400 / light-525 / dark-200, not opacity."],
];
const DS_CLASS_RULES = DS_PATTERNS.flatMap(([re, message]) => [
  { selector: `Literal[value=/${re}/]`, message },
  { selector: `TemplateElement[value.raw=/${re}/]`, message },
]);

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  // AthaNext Design System guard for product UI: tokens, not raw values.
  // Marketing pages and the primitives that define the tokens are exempt.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/components/ui/**",
      "src/components/icons/**",
      "src/components/sections/**",
      "src/config/colors.ts",
      "src/pages/{WhyMyKonnect,BecomeACoach,Partnerships,PartnershipSuccess,About,RowingPillars,SoccerPillars}.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "lucide-react", message: "Use @/components/icons (Hugeicons, per the design system)." }] },
      ],
      "no-restricted-syntax": ["error", ...DS_CLASS_RULES],
    },
  },
  // Playwright tests run in Node. Fixtures call `use()` and take `{}` when they need no fixture,
  // which the React hooks rule and no-empty-pattern would flag.
  {
    files: ["e2e/**/*.ts", "playwright*.config.ts"],
    languageOptions: { globals: globals.node },
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "no-empty-pattern": "off",
      "no-console": "off",
    },
  }
);
