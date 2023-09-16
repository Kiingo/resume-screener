module.exports = {
  "root": true,
  "ignorePatterns": ['.eslintrc.cjs'],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.eslint.json",
    "sourceType": "module"
  },
  "plugins": [
    "@typescript-eslint",
    "prettier",
    "filename-rules",
    "jest"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jest/recommended",
    "plugin:jest/style",
    "plugin:prettier/recommended",
    "prettier"
  ],
  "rules": {
    "curly": "error",
    "no-self-compare": "error",
    "no-empty-function": "off",
    "no-constant-condition": ["error", { "checkLoops": false }],
    "@typescript-eslint/no-empty-function": "warn",
    "@typescript-eslint/no-empty-interface": "off",
    // Note: you must disable the base rule as it can report incorrect errors
    "no-use-before-define": "off",
    "@typescript-eslint/no-use-before-define": ["warn", { "ignoreTypeReferences": true, "typedefs": false, "classes": false }],
    "no-template-curly-in-string": "warn",
    "camelcase": "warn",
    "no-invalid-this": "warn",
    "no-var": "error",
    "prefer-const": "warn",
    "prefer-object-spread": "warn",
    "prefer-spread": "warn",
    "arrow-spacing": "error",
    "prefer-arrow-callback": "error",
    "no-confusing-arrow": "warn",
    "consistent-this": ["error", "that"],
    "eqeqeq": ["warn", "smart"],
    "no-console": "warn",
    "prettier/prettier": [
      "error"
    ], // Error on prettier issues
    "semi": [
      2,
      "always"
    ],
    // We'll make it so that unused-vars error is ignored if we prefix variable with underscore ("_")
    // https://stackoverflow.com/questions/64052318/how-to-disable-warn-about-some-unused-params-but-keep-typescript-eslint-no-un
    // We must disable the base rule as it can report incorrect errors if we don't
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error", // or "warn"
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "variable",
        "types": ["boolean"],
        "format": ["PascalCase"],
        "prefix": ["is", "should", "has", "had", "can", "did", "does", "will", "was", "used","use", "were", "are",
                  "_is", "_should", "_has", "_had", "_can", "_did", "_does", "_will", "_was", "_used", "_use", "_were", "_are"]
      },
      {
        "selector": ["function"],
        "format": ["camelCase", "PascalCase"],
        "leadingUnderscore": "allow"
      },
      {
        "selector": "variable",
        "format": ["camelCase", "PascalCase", "UPPER_CASE"],
        "leadingUnderscore": "allow"
      },
      {
        "selector": "typeParameter",
        "format": ["PascalCase"],
        "prefix": ["T"]
      },
      {
        "selector": "interface",
        "format": ["PascalCase"],
        "prefix": ["I"]
      }
    ],
    "filename-rules/match": [2, /^(([a-z0-9][a-z0-9]*)([-_][a-z0-9]+)*\.?\\?)+$/], // kebab case with dots
    "jest/prefer-strict-equal": "error",
    "jest/prefer-to-have-length": "warn"
  }
}