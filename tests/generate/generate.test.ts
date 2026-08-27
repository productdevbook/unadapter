// @ts-nocheck
import type { AdapterOptions, TablesSchema } from "../../src/types/index.ts"
import { Kysely, MysqlDialect, PostgresDialect, SqliteDialect } from "kysely"
import { describe, expect, test } from "vitest"
import { kyselyAdapter } from "../../src/adapters/kysely/kysely-adapter.ts"
import { memoryAdapter } from "../../src/adapters/memory/memory-adapter.ts"
import { generate } from "../../src/generate/index.ts"

const tables: TablesSchema = {
  user: {
    modelName: "user",
    fields: {
      email: { type: "string", required: true, unique: true, index: true },
      bio: { type: "string", required: false },
      createdAt: { type: "date", defaultValue: () => new Date() },
    },
  },
  post: {
    modelName: "post",
    fields: {
      title: { type: "string", required: true },
      authorId: {
        type: "string",
        required: true,
        references: { model: "user", field: "id" },
      },
      meta: { type: "json", required: false },
    },
    order: 2,
  },
}

const getTables = () => tables

// Build a driverless Kysely instance wrapped in an adapter — we never
// .execute(), only .compile().sql, so no live connection is needed.
function adapterFor(type: "postgres" | "mysql" | "sqlite") {
  const dialect =
    type === "postgres"
      ? new PostgresDialect({ pool: {} as any })
      : type === "mysql"
        ? new MysqlDialect({ pool: {} as any })
        : new SqliteDialect({ database: {} as any })
  const db = new Kysely<any>({ dialect })
  return kyselyAdapter(db, { type })
}

function opts(
  type: "postgres" | "mysql" | "sqlite",
  advancedDb: Record<string, unknown> = {},
): AdapterOptions {
  return { database: adapterFor(type), advanced: { database: advancedDb } } as AdapterOptions
}

function adapterWithThrowingIntrospection() {
  return () => ({
    id: "throwing-introspection",
    createMigrator: () => ({
      introspect: async () => {
        throw new Error("introspection should not run during generate")
      },
      createTable: async () => {},
      addColumn: async () => {},
      resolveType: () => "text",
      matchType: () => true,
      compileCreateTable: (table, idColumn, fields) => {
        const columns = [
          `"id" ${idColumn.type} primary key`,
          ...Object.entries(fields).map(([name, column]) => `"${name}" ${column.type}`),
        ]
        return `create table "${table}" (${columns.join(", ")})`
      },
    }),
  })
}

describe("generate() — offline SQL schema", () => {
  test("postgres: text PK, jsonb, timestamp default, FK, index", async () => {
    const sql = await generate(getTables, opts("postgres"), { format: "sql" })
    expect(sql).toMatch(/create table "user"/i)
    expect(sql).toContain('"id" text not null primary key')
    expect(sql).toContain('"createdAt" timestamp')
    expect(sql).toContain("default CURRENT_TIMESTAMP")
    expect(sql).toContain('"meta" jsonb')
    expect(sql).toMatch(/references "user" ?\("id"\)/)
    expect(sql).toMatch(/create unique index "user_email_idx"/i)
  })

  test("mysql: varchar(36) FK + json type + backtick quoting", async () => {
    const sql = await generate(getTables, opts("mysql"))
    expect(sql).toContain("varchar(36)")
    expect(sql).toContain("`meta` json")
  })

  test("sqlite: TEXT for json", async () => {
    const sql = await generate(getTables, opts("sqlite"))
    expect(sql).toContain('"meta" text')
  })

  test("useNumberId: integer PK", async () => {
    const sql = await generate(getTables, opts("sqlite", { useNumberId: true }))
    expect(sql).toContain('"id" integer')
  })

  test("uuid id strategy: postgres gen_random_uuid() default", async () => {
    const sql = await generate(getTables, opts("postgres", { generateId: "uuid" }))
    expect(sql).toContain("gen_random_uuid()")
  })

  test("orders tables by `order` — post (order:2) before user (unordered)", async () => {
    const sql = await generate(getTables, opts("postgres"))
    const userIdx = sql.search(/create table "user"/i)
    const postIdx = sql.search(/create table "post"/i)
    expect(userIdx).toBeGreaterThanOrEqual(0)
    expect(postIdx).toBeGreaterThanOrEqual(0)
    expect(postIdx).toBeLessThan(userIdx)
  })

  test("throws when options.database is not an adapter instance", async () => {
    await expect(
      generate(getTables, { advanced: { database: {} } } as AdapterOptions, { format: "sql" }),
    ).rejects.toThrow(/requires an adapter instance/)
  })

  test("does not call live introspection", async () => {
    const sql = await generate(getTables, {
      database: adapterWithThrowingIntrospection(),
    } as AdapterOptions)

    expect(sql).toMatch(/create table "user"/i)
    expect(sql).toMatch(/create table "post"/i)
  })

  test("throws an actionable error for adapters without migrators", async () => {
    await expect(
      generate(getTables, {
        database: memoryAdapter({ user: [], post: [] }),
      } as AdapterOptions),
    ).rejects.toThrow(/adapter "memory" does not implement createMigrator/)
  })

  test("throws an actionable error for unsupported formats", async () => {
    await expect(
      generate(getTables, opts("postgres"), { format: "unknown_format" as any }),
    ).rejects.toThrow(/unsupported generate format "unknown_format"/)
  })
})
