// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ESLint flat config — REPORT-ONLY mode (added 2026-06-22).
//
// Quality rules that surface existing technical debt (explicit `any`, raw
// `console.*`, unused vars, React-hook deps) are set to "warn", NOT "error",
// so this config does not block commits or fail CI. It produces a report.
//
// Promote individual rules to "error" once the corresponding debt is burned
// down. Track counts via `npm run lint:report` and the weekly routine.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Remap a recommended ruleset so no rule is "error" (report-only mode).
// Each rule becomes "warn" while preserving any per-rule options.
function downgradeToWarn(rules) {
  return Object.fromEntries(
    Object.entries(rules).map(([name, value]) => {
      if (Array.isArray(value)) return [name, ['warn', ...value.slice(1)]];
      if (value === 'off' || value === 0) return [name, 'off'];
      return [name, 'warn'];
    }),
  );
}

export default [
  // ── Global ignores ──────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '_archive/**',
      'backups/**',
      'website/**',
      'apps/web/public/**',
      'apps/api/prisma/migrations/**',
      '**/*.min.js',
    ],
  },

  // ── Baseline (all files) ────────────────────────────────────────
  // eslint:recommended, but downgraded to warn for report-only mode. The few
  // rules we want as hard errors are re-asserted in the per-area blocks below.
  { rules: downgradeToWarn(js.configs.recommended.rules) },

  // ── Backend: TypeScript (apps/api) ──────────────────────────────
  {
    files: ['apps/api/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: { ...globals.node },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // ── Existing-debt rules: WARN only ──
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn', // 483 raw calls today — surface them all
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // ── Genuine-bug rules: ERROR (these should be ~0 already) ──
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'smart'],
      // `any` is allowed by tsconfig, so let TS own type-checking; ESLint
      // here is about hygiene, not type soundness.
      'no-undef': 'off', // TS handles this; avoids false positives on globals
    },
  },

  // ── Backend tests: relax console + any ──────────────────────────
  {
    files: ['apps/api/src/**/*.test.ts', 'apps/api/src/__tests__/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ── Frontend: React / Next (apps/web) ───────────────────────────
  {
    files: ['apps/web/**/*.{js,jsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // Inherit the recommended sets, but downgrade EVERYTHING to "warn" for
      // report-only mode (react-hooks v7 ships several new error-level rules
      // that would otherwise block commits on pre-existing patterns).
      ...downgradeToWarn(react.configs.recommended.rules),
      ...downgradeToWarn(reactHooks.configs.recommended.rules),
      // Next.js + React 19: no import-React-in-scope requirement
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // ── Highest-value frontend rule: catches stale-closure bugs ──
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      // ── Accessibility: warn (checklist already asks for aria-labels) ──
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // ── Node scripts (scripts/, *.config.js) ────────────────────────
  {
    files: ['scripts/**/*.js', '*.config.{js,mjs,cjs}', 'apps/web/*.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },

  // ── Prettier compatibility: turn off all formatting-conflict rules ──
  // Must be LAST so it overrides any stylistic rules above.
  prettier,
];
