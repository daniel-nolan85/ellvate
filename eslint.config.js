// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // TypeScript fully validates named/namespace imports, so eslint-plugin-import's
      // cross-file `import/namespace` analysis is redundant here. It is also slow and,
      // under `expo lint`, produces false "unclosed JSX tag" parse errors on valid
      // files. typescript-eslint recommends disabling it for TypeScript projects.
      'import/namespace': 'off',
    },
  },
]);
