import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    reporters: process.env.GITHUB_ACTIONS ? ["dot", "github-actions"] : ["dot"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      include: ["src/**/*.ts", "!src/types"],
    },
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
})
