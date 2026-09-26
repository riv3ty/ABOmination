import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/", "_site/", "node_modules/", "abo-manager.html"] },
  js.configs.recommended,
  {
    files: ["web/src/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.browser, google: "readonly" } },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }]
    }
  },
  {
    files: ["web/tests/**/*.js", "server/**/*.js", "*.config.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } }
  },
  {
    files: ["e2e/**/*.js"],                                                   // Node-Skript, Callbacks laufen im Browser
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node, ...globals.browser } },
    rules: { "no-empty": ["error", { allowEmptyCatch: true }] }
  },
  {
    files: ["web/public/sw.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "script", globals: { ...globals.serviceworker } }
  },
  {
    files: ["scripts/**/*.js"],                                               // Node-Skripte, Puppeteer-Callbacks laufen im Browser
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node, ...globals.browser } }
  },
  {
    files: ["site/**/*.js"],                                                  // Website (klassisches Skript im Browser)
    languageOptions: { ecmaVersion: 2024, sourceType: "script", globals: { ...globals.browser } },
    rules: { "no-empty": ["error", { allowEmptyCatch: true }], "no-unused-vars": ["error", { caughtErrors: "none" }] }
  }
];
