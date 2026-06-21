import { fileURLToPath } from "node:url"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { prismaAdapter } from "../../../src/adapters/prisma/index.ts"
import { PrismaClient } from "./generated/client/client.ts"

export function getAdapter() {
  const sqliteAdapter = new PrismaBetterSqlite3({
    url: fileURLToPath(new URL(".db/dev.db", import.meta.url)),
  })
  const db = new PrismaClient({ adapter: sqliteAdapter })

  async function clearDb() {
    await db.user.deleteMany()
  }

  const adapter = prismaAdapter(db, {
    provider: "sqlite",
    debugLogs: {
      isRunningAdapterTests: true,
    },
  })

  return { adapter, clearDb }
}
