import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import perfectionist from 'eslint-plugin-perfectionist';
import unusedImports from 'eslint-plugin-unused-imports';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * Import layout: one block per layer, shortest line first inside a block, so a file's
 * dependencies read from "framework" down to "this folder".
 */
const importGroupPatterns = {
  routes: '^src/routes(/|$)',
  hooks: '^src/hooks(/|$)',
  utils: '^src/utils(/|$)',
  components: '^src/components(/|$)',
  sections: '^src/sections(/|$)',
  auth: '^src/auth(/|$)',
  types: '^src/types(/|$)',
};

const sortImports = [
  'error',
  {
    type: 'line-length',
    order: 'asc',
    newlinesBetween: 1,
    internalPattern: ['^src/'],
    customGroups: Object.entries(importGroupPatterns).map(([name, pattern]) => ({
      groupName: `src-${name}`,
      elementNamePattern: pattern,
      // Type-only imports always go to the "type" block, wherever they come from.
      modifiers: ['value'],
    })),
    groups: [
      'side-effect',
      'side-effect-style',
      'style',
      'type',
      ['builtin', 'external'],
      'src-routes',
      'src-hooks',
      'src-utils',
      'internal',
      'src-components',
      'src-sections',
      'src-auth',
      'src-types',
      ['parent', 'sibling', 'index'],
      ['type-parent', 'type-sibling', 'type-index'],
      'unknown',
    ],
  },
];

/**
 * Layers rewritten to the stricter bar (UI, actions, guards, request handlers). The older
 * backend modules (ai, ingest, rag) still use a few justified non-null assertions on
 * indexed access.
 */
const STRICT_FILES = [
  'src/actions/**',
  'src/app/**',
  'src/auth/**',
  'src/components/**',
  'src/hooks/**',
  'src/layouts/**',
  'src/routes/**',
  'src/sections/**',
  'src/server/api/**',
  'src/server/data.ts',
  'src/types/**',
  'src/utils/**',
];

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'public/**',
      '.data/**',
      'drizzle/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    plugins: { perfectionist, 'unused-imports': unusedImports },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      'unused-imports/no-unused-imports': 'error',
      'perfectionist/sort-imports': sortImports,
      'perfectionist/sort-named-imports': ['error', { type: 'line-length', order: 'asc' }],
      'perfectionist/sort-named-exports': ['error', { type: 'line-length', order: 'asc' }],
      'perfectionist/sort-exports': ['error', { type: 'line-length', order: 'asc' }],
    },
  },
  {
    files: STRICT_FILES,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // Named exports everywhere; Next.js requires default exports for route files and configs.
    files: ['src/**'],
    ignores: ['src/app/**'],
    rules: { 'import/no-default-export': 'error' },
  },
];

export default config;
