import type { Knex } from "knex"
import type { Adapter, TablesSchema, Where } from "../../types/index.ts"
import type { AdapterDebugLogs } from "../create/index.ts"
import type { KnexDatabaseType } from "./types.ts"
import { createAdapter } from "../create/index.ts"
import { createKnexMigratorFromKnex } from "./migrator.ts"

interface KnexAdapterConfig {
  /**
   * Database type.
   */
  type?: KnexDatabaseType
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

export function knexAdapter<
  T extends Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
>(
  db: Knex,
  config?: KnexAdapterConfig,
): (getTables: (options: any) => Schema, options: any) => Adapter<T, Schema> {
  return createAdapter<T, Schema>({
    config: {
      adapterId: "knex",
      adapterName: "Knex Adapter",
      usePlural: config?.usePlural,
      debugLogs: config?.debugLogs,
      supportsBooleans: !(config?.type === "sqlite" || config?.type === "mssql" || !config?.type),
      supportsDates: !(config?.type === "sqlite" || config?.type === "mssql" || !config?.type),
      supportsJSON: false,
    },
    adapter: ({ getFieldName, schema }) => {
      function transformValueToDB(value: any, model: string, field: string) {
        if (field === "id") {
          return value
        }
        const { type = "sqlite" } = config || {}
        let f = schema[model]?.fields[field]
        if (!f) {
          // @ts-expect-error - The model name can be sanitized.
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

      function applyWhere(query: Knex.QueryBuilder, model: string, w?: Where[]) {
        if (!w || w.length === 0) return query

        const ands = w.filter((c) => (c.connector ?? "AND") !== "OR")
        const ors = w.filter((c) => c.connector === "OR")

        const applyCondition = (qb: Knex.QueryBuilder, condition: Where) => {
          const field = getFieldName({ model, field: condition.field })
          const operator = condition.operator ?? "="
          const value = transformValueToDB(condition.value, model, condition.field)

          if (operator.toLowerCase() === "in") {
            return qb.whereIn(field, Array.isArray(value) ? value : [value])
          }
          if (operator === "contains") {
            return qb.where(field, "like", `%${value}%`)
          }
          if (operator === "starts_with") {
            return qb.where(field, "like", `${value}%`)
          }
          if (operator === "ends_with") {
            return qb.where(field, "like", `%${value}`)
          }
          if (operator === "eq") return qb.where(field, "=", value)
          if (operator === "ne") return qb.where(field, "<>", value)
          if (operator === "gt") return qb.where(field, ">", value)
          if (operator === "gte") return qb.where(field, ">=", value)
          if (operator === "lt") return qb.where(field, "<", value)
          if (operator === "lte") return qb.where(field, "<=", value)
          return qb.where(field, operator, value)
        }

        if (ands.length > 0) {
          query = query.where((qb) => {
            for (const c of ands) applyCondition(qb, c)
          })
        }
        if (ors.length > 0) {
          query = query.andWhere((qb) => {
            for (let i = 0; i < ors.length; i++) {
              if (i === 0) applyCondition(qb, ors[i])
              else qb.orWhere((sub) => applyCondition(sub, ors[i]))
            }
          })
        }
        return query
      }

      async function fetchInsertedRow(model: string, values: Record<string, any>, where: Where[]) {
        const field = values.id ? "id" : where.length > 0 && where[0].field ? where[0].field : "id"

        if (!values.id && where.length === 0) {
          const row = await db(model).orderBy(getFieldName({ model, field }), "desc").first()
          return row
        }

        const value = values[field] || where[0].value
        const row = await db(model)
          .where(getFieldName({ model, field }), value)
          .orderBy(getFieldName({ model, field }), "desc")
          .first()
        return row
      }

      return {
        create: async ({ data, model }) => {
          const type = config?.type
          if (type === "mysql") {
            await db(model).insert(data)
            // mysql doesn't support returning; fetch the inserted row.
            // If the data has an id we use it, otherwise fall back to last-inserted.
            return await fetchInsertedRow(model, data, [])
          }
          const rows = await db(model).insert(data).returning("*")
          return Array.isArray(rows) ? rows[0] : rows
        },

        findOne: async ({ model, where }) => {
          let query = db(model).select("*")
          query = applyWhere(query, model, where)
          const res = await query.first()
          return res ?? null
        },

        findMany: async ({ model, where, limit, offset, sortBy }) => {
          let query = db(model).select("*")
          query = applyWhere(query, model, where)
          if (sortBy) {
            query = query.orderBy(getFieldName({ model, field: sortBy.field }), sortBy.direction)
          }
          if (config?.type === "mssql" && offset && !sortBy) {
            // MSSQL requires ORDER BY when using OFFSET.
            query = query.orderBy(getFieldName({ model, field: "id" }))
          }
          query = query.limit(limit || 100)
          if (offset) {
            query = query.offset(offset)
          }
          const res = await query
          return res ?? []
        },

        update: async ({ model, where, update: values }) => {
          const type = config?.type
          if (type === "mysql") {
            let query = db(model).update(values as any)
            query = applyWhere(query, model, where)
            await query
            return await fetchInsertedRow(model, values as any, where)
          }
          let query = db(model)
            .update(values as any)
            .returning("*")
          query = applyWhere(query, model, where)
          const rows = await query
          return Array.isArray(rows) ? rows[0] : rows
        },

        updateMany: async ({ model, where, update: values }) => {
          let query = db(model).update(values as any)
          query = applyWhere(query, model, where)
          const res = (await query) as unknown as number
          return typeof res === "number" ? res : 0
        },

        count: async ({ model, where }) => {
          let query = db(model).count({ count: "id" })
          query = applyWhere(query, model, where)
          const res = await query
          const raw = (res?.[0] as any)?.count
          if (typeof raw === "string") return Number.parseInt(raw, 10)
          if (typeof raw === "bigint") return Number(raw)
          if (typeof raw === "number") return raw
          return Number(raw ?? 0)
        },

        delete: async ({ model, where }) => {
          let query = db(model).delete()
          query = applyWhere(query, model, where)
          await query
        },

        deleteMany: async ({ model, where }) => {
          let query = db(model).delete()
          query = applyWhere(query, model, where)
          const res = (await query) as unknown as number
          return typeof res === "number" ? res : 0
        },
        createMigrator: () =>
          createKnexMigratorFromKnex({
            db,
            dialect: config?.type ?? "sqlite",
          }),
        options: config,
      }
    },
  })
}
