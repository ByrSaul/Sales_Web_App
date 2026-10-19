import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, projectService: true },
      globals: {
        window: 'readonly',
        document: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        RequestInit: 'readonly',
        AbortController: 'readonly',
        DOMException: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tseslint, 'react-hooks': reactHooks, sonarjs },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': 'error',
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-nested-conditional': 'error',
      'sonarjs/pseudo-random': 'error',
      'sonarjs/unused-import': 'error',
      'sonarjs/no-dead-store': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-all-duplicated-branches': 'error',
    },
  },
];
