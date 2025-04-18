import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    workspace: [
      {
        test: {
          name: "Node.js",
          environment: "node",
        },
      },
    ],
  },
});
