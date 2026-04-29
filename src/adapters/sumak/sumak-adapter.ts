import type { Sumak } from "sumak"
import type { Adapter, TablesSchema, Where } from "../../types/index.ts"
import type { AdapterDebugLogs } from "../create/index.ts"
import type { SumakDatabaseType } from "./types.ts"
import { and, or } from "sumak"
import { createAdapterFactory } from "../create/index.ts"
import { createSumakMigratorFromSumak } from "./migrator.ts"

export interface SumakAdapterConfig {
  /**
   * Database type sumak is configured for.
   */
  type?: SumakDatabaseType
  /**
   * Enable debug logs for the adapter
   *
   * @default false
   */
  debugLogs?: AdapterDebugLogs
  /**
   * Use plural for table names.
   *
   * @default false
   */
  usePlural?: boolean
}

/**
 * Build a `Col`-style expression for a single Where condition.
 *
 * Sumak's `where(({ col1, col2 }) => col1.eq(...))` callback style works at
 * runtime without static table types — we just dereference the column proxy
 * by name and call the appropriate operator. We `as any` because the
 * adapter runs against a runtime `TablesSchema`, not a compile-time DB
 * schema.
 */
function applyOperator(col: any, operator: string, value: unknown): any {
  const op = operator.toLowerCase()
  if (op === "in") {
    return col.in(Array.isArray(value) ? value : [value])
  }
  if (op === "contains") return col.like(`%${value}%`)
  if (op === "starts_with") return col.like(`${value}%`)
  if (op === "ends_with") return col.like(`%${value}`)
  if (op === "eq" || op === "=") return col.eq(value)
  if (op === "ne" || op === "<>" || op === "!=") return col.neq(value)
  if (op === "gt" || op === ">") return col.gt(value)
  if (op === "gte" || op === ">=") return col.gte(value)
  if (op === "lt" || op === "<") return col.lt(value)
  if (op === "lte" || op === "<=") return col.lte(value)
  return col.eq(value)
}

export function sumakAdapter<
  T extends Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
>(
  db: Sumak<any>,
  config?: SumakAdapterConfig,
): (getTables: (options: any) => Schema, options: any) => Adapter<T, Schema> {
  return createAdapterFactory<T, Schema>({
    config: {
      adapterId: "sumak",
      adapterName: "Sumak Adapter",
      usePlural: config?.usePlural,
      debugLogs: config?.debugLogs,
      // Same defaults as Kysely / Knex: SQLite & MSSQL don't have native
      // boolean / datetime types we want to round-trip, so the framework
      // handles 0/1 and ISO strings for us.
      supportsBooleans: !(config?.type === "sqlite" || config?.type === "mssql" || !config?.type),
      supportsDates: !(config?.type === "sqlite" || config?.type === "mssql" || !config?.type),
      supportsJSON: false,
    },
    adapter: ({ getFieldName, schema }) => {
      function transformValueToDB(value: any, model: string, field: string): any {
        if (field === "id") return value
        const { type = "sqlite" } = config || {}
        let f = schema[model]?.fields[field]
        if (!f) {
          // @ts-expect-error - model name might be a sanitized custom name
          f = Object.values(schema).find((f) => f.modelName === model)!
        }
        if (
          f.type === "boolean" &&
          (type === "sqlite" || type === "mssql") &&
          value !== null &&
          value !== undefined
        ) {
          return value ? 1 : 0
        }
        if (f.type === "date" && value && value instanceof Date) {
          return type === "sqlite" ? value.toISOString() : value
        }
        return value
      }

      // Build a sumak `WhereCallback` from our `Where[]`. The result is
      // a single combined expression suitable for `.where(eb => ...)`.
      function buildWhereExpr(model: string, w: Where[] | undefined): ((eb: any) => any) | null {
        if (!w || w.length === 0) return null
        const ands = w.filter((c) => (c.connector ?? "AND") !== "OR")
        const ors = w.filter((c) => c.connector === "OR")
        return (eb: any) => {
          const piece = (c: Where): any => {
            const fieldName = getFieldName({ model, field: c.field })
            const col = eb[fieldName]
            const value = transformValueToDB(c.value, model, c.field)
            return applyOperator(col, c.operator ?? "=", value)
          }
          const parts: any[] = []
          if (ands.length > 0) {
            parts.push(ands.length === 1 ? piece(ands[0]) : and(...ands.map(piece)))
          }
          if (ors.length > 0) {
            parts.push(ors.length === 1 ? piece(ors[0]) : or(...ors.map(piece)))
          }
          return parts.length === 1 ? parts[0] : and(...parts)
        }
      }

      const supportsReturning = config?.type !== "mysql"

      async function fetchByPrimaryKey(
        model: string,
        idField: string,
        idValue: unknown,
      ): Promise<any> {
        const row = await (db as any)
          .selectFrom(model)
          .selectAll()
          .where((eb: any) => eb[idField].eq(idValue))
          .first()
        return row
      }

      return {
        create: async ({ data, model }) => {
          const idField = getFieldName({ model, field: "id" })
          if (!supportsReturning) {
            const result = await (db as any).insertInto(model).values(data).exec()
            const supplied = (data as { id?: unknown }).id
            const insertedId =
              typeof supplied === "string" || typeof supplied === "number"
                ? supplied
                : (result?.insertId ?? result?.lastInsertId)
            if (insertedId !== undefined) {
              const row = await fetchByPrimaryKey(model, idField, insertedId)
              if (row) return row
            }
            // Last resort fallback — race-prone but mirrors what Kysely
            // does on MySQL when no insertId is available either.
            return await (db as any).selectFrom(model).selectAll().orderBy(idField, "DESC").first()
          }
          const rows = await (db as any).insertInto(model).values(data).returningAll().many()
          return Array.isArray(rows) ? rows[0] : rows
        },

        findOne: async ({ model, where }) => {
          let query: any = (db as any).selectFrom(model).selectAll()
          const cb = buildWhereExpr(model, where)
          if (cb) query = query.where(cb)
          const res = await query.first()
          return res ?? null
        },

        findMany: async ({ model, where, limit, offset, sortBy }) => {
          let query: any = (db as any).selectFrom(model).selectAll()
          const cb = buildWhereExpr(model, where)
          if (cb) query = query.where(cb)
          if (sortBy) {
            query = query.orderBy(
              getFieldName({ model, field: sortBy.field }),
              sortBy.direction.toUpperCase(),
            )
          }
          // MSSQL requires ORDER BY when OFFSET is used.
          if (config?.type === "mssql" && offset && !sortBy) {
            query = query.orderBy(getFieldName({ model, field: "id" }), "ASC")
          }
          query = query.limit(limit || 100)
          if (offset) query = query.offset(offset)
          return await query.many()
        },

        update: async ({ model, where, update: values }) => {
          const cb = buildWhereExpr(model, where)
          if (!supportsReturning) {
            let q: any = (db as any).update(model).set(values)
            if (cb) q = q.where(cb)
            await q.exec()
            // Fetch the updated row by the first where clause, mirroring
            // the Knex/Kysely MySQL adapter strategy.
            if (where && where.length > 0) {
              const w = where[0]
              const fieldName = getFieldName({ model, field: w.field })
              const value = transformValueToDB(w.value, model, w.field)
              const row = await (db as any)
                .selectFrom(model)
                .selectAll()
                .where((eb: any) => eb[fieldName].eq(value))
                .first()
              return row
            }
            return null
          }
          // Sumak's UpdateBuilder requires `.where(...)` before `.returningAll()` —
          // returningAll() narrows to a returning-builder that doesn't expose where.
          let q: any = (db as any).update(model).set(values)
          if (cb) q = q.where(cb)
          q = q.returningAll()
          const rows = await q.many()
          return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
        },

        updateMany: async ({ model, where, update: values }) => {
          let q: any = (db as any).update(model).set(values)
          const cb = buildWhereExpr(model, where)
          if (cb) q = q.where(cb)
          const res = await q.exec()
          return res?.affected ?? 0
        },

        count: async ({ model, where }) => {
          let q: any = (db as any).selectCount(model)
          const cb = buildWhereExpr(model, where)
          if (cb) q = q.where(cb)
          const rows = await q.many()
          const raw = rows?.[0]?.count
          if (typeof raw === "string") return Number.parseInt(raw, 10)
          if (typeof raw === "bigint") return Number(raw)
          if (typeof raw === "number") return raw
          return Number(raw ?? 0)
        },

        delete: async ({ model, where }) => {
          let q: any = (db as any).deleteFrom(model)
          const cb = buildWhereExpr(model, where)
          if (cb) {
            q = q.where(cb)
          } else {
            q = q.allRows()
          }
          await q.exec()
        },

        deleteMany: async ({ model, where }) => {
          let q: any = (db as any).deleteFrom(model)
          const cb = buildWhereExpr(model, where)
          if (cb) {
            q = q.where(cb)
          } else {
            q = q.allRows()
          }
          const res = await q.exec()
          return res?.affected ?? 0
        },

        transaction: async (cb: any) => {
          // Sumak's `db.transaction` hands the callback a fully-scoped
          // Sumak instance with the same surface as `db`. We rebuild a
          // wrapped adapter inside so callers' adapter operations stay
          // inside the transaction.
          return await (db as any).transaction(async (tx: any) => {
            const txAdapter = sumakAdapter<T, Schema>(tx, config)
            // The `getTables` / options here are ignored — `cb` only
            // cares about the adapter's runtime methods.
            return await cb(
              txAdapter(() => schema as Schema, {
                database: undefined as any,
              } as any),
            )
          })
        },

        createMigrator: () =>
          createSumakMigratorFromSumak({
            db,
            dialect: config?.type ?? "sqlite",
          }),

        options: config,
      }
    },
  })
}
