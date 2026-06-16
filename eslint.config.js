const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const importPlugin = require('eslint-plugin-import');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: ['tests/sample-repo/**', 'node_modules/**', 'dist/**', 'coverage/**', '.yal/**', '**/.dccache'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  importPlugin.flatConfigs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
      },
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.vue'],
        },
      },
    },
    rules: {
      'no-console': 'off',
      'no-debugger': 'off',
      'arrow-parens': ['error', 'as-needed'],
      'require-jsdoc': 'off',
      'space-before-function-paren': 'off',
      'comma-dangle': 'off',
      'object-curly-spacing': ['error', 'always'],
      'padded-blocks': 'off',
      camelcase: 'warn',
      'object-property-newline': 'off',
      'prefer-const': 'warn',
      'import/no-absolute-path': 'off',
      'no-prototype-builtins': 'off',
      // The codebase resolves modules via TypeScript; the import resolver cannot
      // see type-only packages (e.g. `sarif`), so leave resolution to tsc.
      'import/no-unresolved': 'off',
      // Ternary/short-circuit expressions are used intentionally for side effects here.
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      // Match the prior baseline: unused catch bindings and `_`-prefixed names are allowed.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { caughtErrors: 'none', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Several call sites rethrow loosely-typed error objects; keep this visible but non-blocking.
      '@typescript-eslint/only-throw-error': 'warn',
      indent: ['warn', 2],
      'quote-props': ['warn', 'as-needed'],
      'lines-between-class-members': 'off',
      'prefer-destructuring': ['warn', { object: true, array: false }],
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          mjs: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],
      'no-restricted-syntax': 'off',
      'no-await-in-loop': 'warn',
      'no-underscore-dangle': 'off',
      'max-classes-per-file': 'off',
      'no-use-before-define': 'off',
      'no-continue': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-param-reassign': 'off',
    },
  },
);
