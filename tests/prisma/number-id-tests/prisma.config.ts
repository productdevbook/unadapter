import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "./schema.prisma",
  datasource: {
    url: "file:.db/dev.db",
  },
})
