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

  test("generates Prisma schema models from TablesSchema", async () => {
    const source = await generate(getTables, {}, { format: "prisma" })

    expect(source).toMatch(/model User \{/)
    expect(source).toContain("id            String    @id")
    expect(source).toContain("email         String    @unique")
    expect(source).toContain("emailVerified Boolean   @default(false)")
    expect(source).toContain("createdAt     DateTime  @default(now())")
    expect(source).toContain("updatedAt     DateTime  @default(now()) @updatedAt")
    expect(source).toContain("accounts      Account[]")
    expect(source).toContain("sessions      Session[]")
    expect(source).toContain('@@map("user")')
    expect(source).toContain("@@index([name])")

    expect(source).toMatch(/model Account \{/)
    expect(source).toContain("userId      String")
    expect(source).toContain(
      "user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)",
    )
    expect(source).toContain("accessToken String?")
    expect(source).toContain('@@map("account")')

    expect(source).toMatch(/model Session \{/)
    expect(source).toContain("token     String   @unique")
    expect(source).toContain(
      "user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)",
    )
    expect(source).toContain('@@map("session")')

    expect(source).toMatch(/model Verification \{/)
    expect(source).toContain('@@map("verification")')
  })

  test("generates Prisma schema with number IDs", async () => {
    const source = await generate(
      getTables,
      {
        advanced: {
          database: {
            useNumberId: true,
          },
        },
      },
      { format: "prisma" },
    )

    expect(source).toContain("id          Int      @id @default(autoincrement())")
    expect(source).toContain("userId      Int")
    expect(source).toContain(
      "user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)",
    )
  })

  test("generates Prisma schema with UUID IDs", async () => {
    const source = await generate(
      getTables,
      {
        advanced: {
          database: {
            generateId: "uuid",
          },
        },
      },
      { format: "prisma" },
    )

    expect(source).toContain("id            String    @id @default(uuid())")
    expect(source).toContain("userId      String")
  })

  test("generates Prisma schema with datasource & generator headers", async () => {
    const source = await generate(
      getTables,
      {},
      {
        format: "prisma",
        provider: "sqlite",
        includeDatasource: true,
      },
    )

    expect(source).toContain('generator client {\n  provider = "prisma-client"\n}')
    expect(source).toContain('datasource db {\n  provider = "sqlite"\n}')
    expect(source).toMatch(/model User \{/)
  })

  test("generates Prisma schema with field @map for custom column names", async () => {
    const customTables = () => ({
      user: {
        modelName: "user",
        fields: {
          email: { type: "string" as const, required: true, fieldName: "email_address" },
        },
      },
    })

    const source = await generate(customTables, {}, { format: "prisma" })
    expect(source).toContain('email String @map("email_address")')
  })

  test("generates Prisma schema with multiple relations and 1-to-1 relations", async () => {
    const complexTables = () => ({
      user: {
        modelName: "user",
        fields: {
          name: { type: "string" as const, required: true },
        },
      },
      profile: {
        modelName: "profile",
        fields: {
          userId: {
            type: "string" as const,
            required: true,
            unique: true,
            references: { model: "user", field: "id" },
          },
          bio: { type: "string" as const, required: false },
        },
      },
      post: {
        modelName: "post",
        fields: {
          title: { type: "string" as const, required: true },
          authorId: {
            type: "string" as const,
            required: true,
            references: { model: "user", field: "id" },
          },
          reviewerId: {
            type: "string" as const,
            required: false,
            references: { model: "user", field: "id" },
          },
        },
      },
    })

    const source = await generate(complexTables, {}, { format: "prisma" })

    // User model should have 1-to-1 profile? and two named post relations
    expect(source).toMatch(/model User \{/)
    expect(source).toContain("profile          Profile?")
    expect(source).toContain('posts_authorId   Post[]   @relation("post_authorId")')
    expect(source).toContain('posts_reviewerId Post[]   @relation("post_reviewerId")')

    // Profile model
    expect(source).toMatch(/model Profile \{/)
    expect(source).toContain("userId String  @unique")
    expect(source).toContain("user   User    @relation(fields: [userId], references: [id])")

    // Post model
    expect(source).toMatch(/model Post \{/)
    expect(source).toContain(
      'author     User    @relation("post_authorId", fields: [authorId], references: [id])',
    )
    expect(source).toContain(
      'reviewer   User?   @relation("post_reviewerId", fields: [reviewerId], references: [id])',
    )
  })

  test("generates Prisma schema with special types (json, bigint, arrays)", async () => {
    const typesTables = () => ({
      log: {
        modelName: "log",
        fields: {
          metadata: { type: "json" as const, required: false },
          count: { type: "number" as const, bigint: true, required: true },
          tags: { type: "string[]" as const, required: true },
          scores: { type: "number[]" as const, required: true },
        },
      },
    })

    const source = await generate(typesTables, {}, { format: "prisma" })
    expect(source).toContain("metadata Json?")
    expect(source).toContain("count    BigInt")
    expect(source).toContain("tags     String[]")
    expect(source).toContain("scores   Int[]")
  })

  test("generates Prisma schema with cuid and nanoid ID strategies", async () => {
    const cuidSource = await generate(
      getTables,
      { advanced: { database: { generateId: "cuid" } } },
      { format: "prisma" },
    )
    expect(cuidSource).toContain("@id @default(cuid())")

    const nanoidSource = await generate(
      getTables,
      { advanced: { database: { generateId: "nanoid" } } },
      { format: "prisma" },
    )
    expect(nanoidSource).toContain("@id @default(nanoid())")
  })
})
