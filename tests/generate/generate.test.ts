// @ts-nocheck
import type { AdapterOptions, TablesSchema } from "../../src/types/index.ts"
import { describe, expect, test } from "vitest"
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

function opts(advancedDb: Record<string, unknown> = {}): AdapterOptions {
  return { advanced: { database: advancedDb } } as AdapterOptions
}

describe("generate() — offline SQL schema", () => {
  test("postgresql: text PK, jsonb, timestamp default, FK, index", async () => {
    const sql = await generate(getTables, opts(), { format: "sql", dialect: "postgresql" })
    expect(sql).toMatch(/create table "user"/i)
    expect(sql).toContain('"id" text not null primary key')
    expect(sql).toContain('"createdAt" timestamp')
    expect(sql).toContain("default CURRENT_TIMESTAMP")
    expect(sql).toContain('"meta" jsonb')
    expect(sql).toMatch(/references "user" ?\("id"\)/)
    expect(sql).toMatch(/create unique index "user_email_idx"/i)
  })

  test("mysql: varchar(36) FK + json type + backtick quoting", async () => {
    const sql = await generate(getTables, opts(), { dialect: "mysql" })
    expect(sql).toContain("varchar(36)")
    expect(sql).toContain("`meta` json")
  })

  test("sqlite: TEXT for json", async () => {
    const sql = await generate(getTables, opts(), { dialect: "sqlite" })
    expect(sql).toContain('"meta" text')
  })

  test("defaults to postgresql when no dialect given", async () => {
    const sql = await generate(getTables, opts())
    expect(sql).toMatch(/create table "user"/i)
    expect(sql).toContain('"id" text not null primary key')
  })

  test("useNumberId: integer PK", async () => {
    const sql = await generate(getTables, opts({ useNumberId: true }), { dialect: "sqlite" })
    expect(sql).toContain('"id" integer')
  })

  test("uuid id strategy: postgres gen_random_uuid() default", async () => {
    const sql = await generate(getTables, opts({ generateId: "uuid" }), { dialect: "postgresql" })
    expect(sql).toContain("gen_random_uuid()")
  })

  test("orders tables by `order` — post (order:2) before user (unordered)", async () => {
    const sql = await generate(getTables, opts(), { dialect: "postgresql" })
    const userIdx = sql.search(/create table "user"/i)
    const postIdx = sql.search(/create table "post"/i)
    expect(userIdx).toBeGreaterThanOrEqual(0)
    expect(postIdx).toBeGreaterThanOrEqual(0)
    expect(postIdx).toBeLessThan(userIdx)
  })
})
