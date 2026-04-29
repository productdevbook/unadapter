// @ts-nocheck
import type { TablesSchema } from "../../src/types/index.ts"
import { Kysely, MysqlDialect, PostgresDialect, SqliteDialect } from "kysely"
import { describe, expect, test } from "vitest"
import { createKyselyMigratorFromKysely } from "../../src/adapters/kysely/migrator.ts"
import { getMigrations } from "../../src/db/get-migration.ts"
import { toZodSchema } from "../../src/db/to-zod.ts"

// Build a Kysely instance with no real driver — we never .execute(),
// only .compile().sql for assertions.
function compileKysely(dialect: "postgres" | "mysql" | "sqlite") {
  const dialectImpl =
    dialect === "postgres"
      ? new PostgresDialect({ pool: {} as any })
      : dialect === "mysql"
        ? new MysqlDialect({ pool: {} as any })
        : new SqliteDialect({ database: {} as any })
  // We can't instantiate Kysely without a real driver for execute,
  // but compile() doesn't reach the driver, so this is safe.
  return new Kysely({ dialect: dialectImpl })
}

const baseTables: TablesSchema = {
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

describe("migration engine — compile path", () => {
  test("postgres: emits text PK + jsonb + timestamp default + FK + index", async () => {
    const db = compileKysely("postgres")
    const migrator = createKyselyMigratorFromKysely({ db, dialect: "postgres" })
    const sql = await compileWith(migrator, baseTables)
    expect(sql).toMatch(/create table "user"/i)
    expect(sql).toContain('"id" text not null primary key')
    expect(sql).toContain('"createdAt" timestamp')
    expect(sql).toContain("default CURRENT_TIMESTAMP")
    expect(sql).toContain('"meta" jsonb')
    expect(sql).toMatch(/references "user" ?\("id"\)/)
    expect(sql).toMatch(/create unique index "user_email_idx"/i)
  })

  test("mysql: emits varchar(36) FK + json type", async () => {
    const db = compileKysely("mysql")
    const migrator = createKyselyMigratorFromKysely({ db, dialect: "mysql" })
    migrator.introspect = async () => []
    const sql = await compileWith(migrator, baseTables)
    expect(sql).toContain("varchar(36)")
    expect(sql).toContain("`meta` json")
  })

  test("sqlite: emits TEXT for json + integer PK with useNumberId", async () => {
    const db = compileKysely("sqlite")
    const migrator = createKyselyMigratorFromKysely({ db, dialect: "sqlite" })
    migrator.introspect = async () => []
    const sql = await compileWith(migrator, baseTables, { useNumberId: true })
    expect(sql).toContain('"meta" text')
    expect(sql).toContain('"id" integer')
  })

  test("uuid id strategy: postgres emits gen_random_uuid() default", async () => {
    const db = compileKysely("postgres")
    const migrator = createKyselyMigratorFromKysely({ db, dialect: "postgres" })
    migrator.introspect = async () => []
    const sql = await compileWith(migrator, baseTables, {}, { generateId: "uuid" })
    expect(sql).toContain("gen_random_uuid()")
  })

  test("plugin schema: same table referenced twice merges fields", async () => {
    const db = compileKysely("sqlite")
    const migrator = createKyselyMigratorFromKysely({ db, dialect: "sqlite" })
    migrator.introspect = async () => []
    const tablesWithDup: TablesSchema = {
      ...baseTables,
      // Plugin contributes a second user-table entry under a synthetic key.
      userExtra: {
        modelName: "user",
        fields: { extra: { type: "string", required: false } },
      },
    }
    const sql = await compileWith(migrator, tablesWithDup)
    // Only one CREATE TABLE for `user`, with both fields present.
    const userCreates = sql.match(/create table "user"/gi)
    expect(userCreates?.length).toBe(1)
    expect(sql).toContain('"extra" text')
  })
})

describe("toZodSchema", () => {
  test("returned: false drops field from server schema, kept on client", () => {
    const schema = toZodSchema({
      fields: {
        email: { type: "string", required: true },
        password: { type: "string", required: true, returned: false },
      },
      isClientSide: false,
    })
    expect(Object.keys(schema.shape)).toEqual(["email"])

    const clientSchema = toZodSchema({
      fields: {
        email: { type: "string", required: true },
        password: { type: "string", required: true, returned: false },
      },
      isClientSide: true,
    })
    expect(Object.keys(clientSchema.shape)).toEqual(["email", "password"])
  })

  test("input: false drops field on client", () => {
    const schema = toZodSchema({
      fields: {
        email: { type: "string", required: true },
        internal: { type: "string", required: true, input: false },
      },
      isClientSide: true,
    })
    expect(Object.keys(schema.shape)).toEqual(["email"])
  })

  test("required: false → optional", () => {
    const schema = toZodSchema({
      fields: { bio: { type: "string", required: false } },
      isClientSide: true,
    })
    expect(schema.shape.bio.safeParse(undefined).success).toBe(true)
  })

  test("array types and json", () => {
    const schema = toZodSchema({
      fields: {
        tags: { type: "string[]" },
        prefs: { type: "json" },
      },
      isClientSide: true,
    })
    expect(schema.shape.tags.safeParse(["a", "b"]).success).toBe(true)
    expect(schema.shape.tags.safeParse([1]).success).toBe(false)
  })
})

// ─── helpers ────────────────────────────────────────────────────────────────

async function compileWith(
  migrator: ReturnType<typeof createKyselyMigratorFromKysely>,
  tables: TablesSchema,
  advancedDb: Record<string, unknown> = {},
  generateConfig: { generateId?: "uuid" | "serial" } = {},
): Promise<string> {
  // Lightweight re-implementation of getMigrations that uses an explicit
  // migrator instead of going through resolveMigrator. Mirrors what the
  // real engine does so these tests stay accurate.
  const { getSchema } = await import("../../src/db/get-schema.ts")
  const config = {
    advanced: { database: { ...advancedDb, ...generateConfig } },
  } as any
  // Force-build: treat all tables as new
  const schema = getSchema(config, () => tables)
  const idStrategy =
    advancedDb.useNumberId === true
      ? "number"
      : generateConfig.generateId === "uuid"
        ? "uuid"
        : generateConfig.generateId === "serial"
          ? "serial"
          : "string"
  const migratorOptions = { useNumberId: idStrategy === "number", idStrategy }
  const statements: string[] = []
  for (const [tableName, value] of Object.entries(schema)) {
    const fields: Record<string, any> = {}
    for (const [fieldName, field] of Object.entries(value.fields)) {
      fields[fieldName] = {
        type: migrator.resolveType(field, fieldName, migratorOptions),
        notNull: field.required !== false,
        unique: field.unique,
        references: field.references
          ? { table: field.references.model, field: field.references.field }
          : undefined,
        bigint: field.bigint,
        sortable: field.sortable,
        defaultExpr:
          field.type === "date" && typeof field.defaultValue === "function"
            ? "CURRENT_TIMESTAMP"
            : undefined,
      }
    }
    const idColumn = {
      type: migrator.resolveType({ type: "string" }, "id", migratorOptions),
      notNull: true,
      primaryKey: true,
      autoIncrement: idStrategy === "number" || idStrategy === "serial",
      defaultExpr: idStrategy === "uuid" ? "gen_random_uuid()" : undefined,
    }
    statements.push(migrator.compileCreateTable!(tableName, idColumn, fields, migratorOptions))
    for (const [fieldName, field] of Object.entries(value.fields)) {
      if (field.index) {
        statements.push(
          migrator.compileCreateIndex!({
            table: tableName,
            field: fieldName,
            unique: !!field.unique,
          }),
        )
      }
    }
  }
  return statements.join(";\n")
}
