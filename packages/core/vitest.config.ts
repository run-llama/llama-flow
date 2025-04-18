import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    workspace: [
      {
        test: {
          name: "DOM",
          environment: "happy-dom",
        },
      },
      {
        test: {
          name: "Node.js",
          environment: "node",
        },
      },
      {
        test: {
          name: "Edge Runtime",
          environment: "edge-runtime",
        },
      },
    ],
  },
});
