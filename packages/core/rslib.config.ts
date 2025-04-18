import { defineConfig, type LibConfig, type Format } from "@rslib/core";

const generateCoreConfig = (format: Format): LibConfig => {
  return {
    format,
    source: {
      entry: {
        index: "./src/core/index.ts",
      },
    },
    output: {
      externals: ["@llama-flow/core/async-context"],
      distPath: {
        root: `./dist/${format}`,
      },
      sourceMap: true,
    },
    dts: {
      bundle: true,
      distPath: "./dist/types",
      autoExtension: true,
    },
  };
};

const generateCoreBrowserConfig = (format: Format): LibConfig => {
  return {
    format,
    source: {
      entry: {
        "index.browser": "./src/core/index.ts",
      },
      tsconfigPath: "./tsconfig.browser.build.json",
    },
    output: {
      target: "web",
      distPath: {
        root: `./dist/${format}`,
      },
      minify: true,
      sourceMap: true,
    },
  };
};

const generateApiConfig = (format: Format): LibConfig => {
  return {
    format,
    bundle: false,
    source: {
      entry: {
        index: ["src", "!src/core/*.ts"],
      },
    },
    output: {
      externals: ["@llama-flow/core", "@llama-flow/core/async-context"],
      distPath: {
        root: `./dist/${format}`,
      },
      sourceMap: true,
    },
    redirect: {
      dts: {
        path: false,
      },
    },
    dts: {
      bundle: false,
      distPath: "./dist/types",
      autoExtension: true,
    },
  };
};

export default defineConfig({
  lib: [
    // Core APIs - bundle ESM
    {
      ...generateCoreConfig("esm"),
    },
    // Core APIs - bundle CJS
    {
      ...generateCoreConfig("cjs"),
    },
    // Core APIs - bundle Browser ESM
    {
      ...generateCoreBrowserConfig("esm"),
    },
    // bundleless ESM
    {
      ...generateApiConfig("esm"),
    },
    // bundleless CJS
    {
      ...generateApiConfig("cjs"),
    },
  ],
  source: {
    tsconfigPath: "./tsconfig.build.json",
  },
});
