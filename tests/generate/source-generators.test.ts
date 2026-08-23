import { describe, expect, test } from "vitest"
import { generate } from "../../src/generate/index.ts"
import { getTables } from "./schema.ts"

describe("source schema generators", () => {
  test("generates PostgreSQL Drizzle schema code from TablesSchema", async () => {
    const source = await generate(
      getTables,
      {},
      {
        format: "drizzle",
        dialect: "postgres",
      },
    )

    expect(source).toContain('from "drizzle-orm/pg-core"')
    expect(source).toMatch(/export const user = pgTable\("user"/)
    expect(source).toContain('email: text("email").notNull().unique()')
    expect(source).toContain('createdAt: timestamp("createdAt").notNull().defaultNow()')
    expect(source).toMatch(/export const account = pgTable\("account"/)
    expect(source).toContain(
      'userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" })',
    )
  })

  test("generates MySQL and SQLite Drizzle schemas", async () => {
    const mysql = await generate(getTables, {}, { format: "drizzle", dialect: "mysql" })
    const sqlite = await generate(getTables, {}, { format: "drizzle", dialect: "sqlite" })

    expect(mysql).toContain('from "drizzle-orm/mysql-core"')
    expect(mysql).toMatch(/export const user = mysqlTable\("user"/)
    expect(mysql).toContain('name: varchar("name", { length: 255 }).notNull()')
    expect(mysql).toContain('index("user_name_idx").on(table.name)')
    expect(mysql).toContain('createdAt: datetime("createdAt").notNull().defaultNow()')

    expect(sqlite).toContain('from "drizzle-orm/sqlite-core"')
    expect(sqlite).toMatch(/export const user = sqliteTable\("user"/)
    expect(sqlite).toContain('emailVerified: integer("emailVerified", { mode: "boolean" })')
  })
})
