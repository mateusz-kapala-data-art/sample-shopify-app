/**
 * This is intended to be a basic starting point for linting in your app.
 * It relies on recommended configs out of the box for simplicity, but you can
 * and should modify this configuration to best suit your team's needs.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },
  // The lint script passes `--ignore-path .gitignore`, which overrides .eslintignore
  // AND ignores each extension's own .gitignore — so extension build/codegen output
  // must be excluded here or it gets linted. All three are CLI-managed: the Shopify
  // CLI rewrites them on `app function typegen` / `app generate extension`, so any
  // hand-fix would be silently clobbered on the next run.
  ignorePatterns: [
    "!**/.server",
    "!**/.client",
    "extensions/*/generated/**", // graphql-codegen output (shopify app function typegen)
    "extensions/*/dist/**", // compiled function.wasm bundle
    "extensions/*/shopify.d.ts", // CLI-written ambient types for extension targets
  ],

  // Base config
  extends: ["eslint:recommended"],

  overrides: [
    // React
    {
      files: ["**/*.{js,jsx,ts,tsx}"],
      plugins: ["react", "jsx-a11y"],
      extends: [
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
      ],
      settings: {
        react: {
          version: "detect",
        },
        formComponents: ["Form"],
        linkComponents: [
          { name: "Link", linkAttribute: "to" },
          { name: "NavLink", linkAttribute: "to" },
        ],
        "import/resolver": {
          typescript: {},
        },
      },
      rules: {
        "react/no-unknown-property": ["error", { ignore: ["variant"] }],
      },
    },

    // Typescript
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["@typescript-eslint", "import"],
      parser: "@typescript-eslint/parser",
      settings: {
        "import/internal-regex": "^~/",
        "import/resolver": {
          node: {
            extensions: [".ts", ".tsx"],
          },
          typescript: {
            alwaysTryTypes: true,
          },
        },
      },
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript",
      ],
    },

    // Node
    {
      files: [
        ".eslintrc.cjs",
        "vite.config.{js,ts}",
        ".graphqlrc.{js,ts}",
        "shopify.server.{js,ts}",
        "**/*.server.{js,ts}",
        // Function tests run under vitest in Node (they build the .wasm and drive
        // it through function-runner), so they use __dirname and Node built-ins.
        "extensions/*/tests/**/*.{js,ts}",
        "extensions/*/*.config.{js,ts}",
      ],
      env: {
        node: true,
      },
    },
  ],
  globals: {
    shopify: "readonly"
  },
};
