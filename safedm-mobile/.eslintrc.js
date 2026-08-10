module.exports = {
  root: true,
  extends: ["eslint:recommended"],
  env: {
    es2021: true,
    node: true,
  },
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: "latest",
    sourceType: "module",
  },
  globals: {
    __DEV__: "readonly",
    fetch: "readonly",
    FormData: "readonly",
  },
  ignorePatterns: ["node_modules/", "android/", "ios/", ".expo/"],
};
