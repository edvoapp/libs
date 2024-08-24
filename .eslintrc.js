//
// Each package in the repo also has it's own .eslintrc.js file that extends this file.
//
// Some of the rules are violated widely in the code and so we're shutting them to 'warn' so that
// non-trivial refactors are not required to recommit existing code.
//
// The places where rules have been relaxed are noted with comments.
//
module.exports = {
  // 'root: true' stops the search for more .eslintrc.js files higher in the directory tree.
  root: true,
  // 'env' provides sets of global variables. see https://eslint.org/docs/user-guide/configuring/language-options
  env: {
    browser: true,
    node: true,
    es2020: true,
  },
  // The parser, the plugin and eslintrc itself are correspondingly-named npm packages
  // '@typescript-eslint/parser' replaces the stock estree parser with one that is compatible with typescript
  // https://www.npmjs.com/package/@typescript-eslint/parser
  parser: '@typescript-eslint/parser',
  // '@typescript-eslint' provides typescript support in eslint
  plugins: ['@typescript-eslint', 'edvo'],
  // 'extends' provides sets of linting rules.
  // ESLint rules => https://eslint.org/docs/rules/
  // Plugin rules = https://www.npmjs.com/package/@typescript-eslint/eslint-plugin#user-content-supported-rules
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  parserOptions: {
    // This option allows you to provide a path to your project's tsconfig.json.
    // Because of this bug: https://github.com/typescript-eslint/typescript-eslint/issues/890
    // We point to a tsconfig.eslint.json that both lists which files to parse with the plugin,
    // and points in turn to the root tsconig.json file for this repo.  Each subpackage follows the same pattern.
    project: ['./tsconfig.eslint.json', './packages/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  // 'rules' let you turn off or change the behavior of rules in the 'extends' list.
  rules: {
    'edvo/owned-property': 'error',
    // New rules that should be temporary or confirmed to be desired as permanent by the team:
    '@typescript-eslint/no-misused-promises': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/restrict-template-expressions': 'warn',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
    '@typescript-eslint/prefer-regexp-exec': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/no-this-alias': 'warn',
    'prefer-rest-params': 'warn',
    'no-debugger': 'warn',
    'no-case-declarations': 'warn',
    'no-prototype-builtins': 'warn',
    'no-var': 'warn',
    // End of new (temporary?) rules
    '@typescript-eslint/restrict-plus-operands': 'off',
    'prefer-const': 'off',
    'no-constant-condition': 'off',
    '@typescript-eslint/ban-ts-ignore': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-base-to-string': 'warn',
    '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
    '@typescript-eslint/no-duplicate-type-constituents': 'warn',
    '@typescript-eslint/no-redundant-type-constituents': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    // no-floating-promises changed from 'error' to 'warn'
    '@typescript-eslint/no-floating-promises': ['warn', { ignoreVoid: true }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/require-await': 1,
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-types': [
      'warn',
      {
        types: {
          Function: {
            fixWith: '(...args: unknown[]) => void',
          },
        },
      },
    ],
  },
  // 'override' changes or removes a rule for specific file names.
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
  ],
};
