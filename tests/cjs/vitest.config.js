const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    environment: "node",
    globals: true, // Enable globals for easier testing
    // Configure for CommonJS with TypeScript support
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    typecheck: {
      enabled: true,
    },
    // Include TypeScript files
    include: ["**/*.test.ts", "**/*.test.js"],
  },
  esbuild: {
    // Enable TypeScript compilation
    target: "node18",
  },
});
