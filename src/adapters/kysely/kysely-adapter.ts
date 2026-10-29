import type { Kysely } from "kysely"
import type { Adapter, TablesSchema, Where } from "../../types/index.ts"
import type { AdapterDebugLogs } from "../create/index.ts"
import type { KyselyDatabaseType } from "./types.ts"
import { createAdapter } from "../create/index.ts"
import { createKyselyMigratorFromKysely } from "./migrator.ts"

interface KyselyAdapterConfig {
  /**
   * Database type.
   */
  type?: KyselyDatabaseType
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

export function kyselyAdapter<
  T extends Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
>(
  db: Kysely<any>,
  config?: KyselyAdapterConfig,
): (getTables: (options: any) => Schema, options: any) => Adapter<T, Schema> {
  return createAdapter<T, Schema>({
    config: {
      adapterId: "kysely",
      adapterName: "Kysely Adapter",
      usePlural: config?.usePlural,
      debugLogs: config?.debugLogs,
      supportsBooleans: !(config?.type === "sqlite" || config?.type === "mssql" || !config?.type),
      supportsDates: !(config?.type === "sqlite" || config?.type === "mssql" || !config?.type),
      supportsJSON: false,
    },
    adapter: ({ getFieldName, getFieldAttributes }) => {
      const findById = async (model: string, id: unknown) => {
        const idField = getFieldName({ model, field: "id" })
        const res = await db
          .selectFrom(model)
          .selectAll()
          .where(idField, "=", id)
          .executeTakeFirst()
        return res ?? null
      }
      function transformValueToDB(value: any, model: string, field: string) {
        if (field === "id") {
          return value
        }
        const { type = "sqlite" } = config || {}
        // `model` is the table name (maybe plural or custom) and `field` the
        // column name, so resolve them back to the schema entry.
        const f = getFieldAttributes({ model, field })
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

      function applyWhere<Q extends { where: (...args: any[]) => any }>(
        query: Q,
        model: string,
        w?: Where[],
      ): Q {
        const { and, or } = convertWhereClause(model, w)
        let q: any = query
        if (and) {
          q = q.where((eb: any) => eb.and(and.map((expr) => expr(eb))))
        }
        if (or) {
          q = q.where((eb: any) => eb.or(or.map((expr) => expr(eb))))
        }
        return q
      }

      function convertWhereClause(model: string, w?: Where[]) {
        if (!w) {
          return {
            and: null,
            or: null,
          }
        }

        const conditions = {
          and: [] as any[],
          or: [] as any[],
        }

        w.forEach((condition) => {
          let { field: _field, value, operator = "=", connector = "AND" } = condition
          const field = getFieldName({ model, field: _field })
          value = transformValueToDB(value, model, _field)
          const expr = (eb: any) => {
            if (operator.toLowerCase() === "in") {
              return eb(field, "in", Array.isArray(value) ? value : [value])
            }

            if (operator === "contains") {
              return eb(field, "like", `%${value}%`)
            }

            if (operator === "starts_with") {
              return eb(field, "like", `${value}%`)
            }

            if (operator === "ends_with") {
              return eb(field, "like", `%${value}`)
            }

            if (operator === "eq") {
              return eb(field, "=", value)
            }

            if (operator === "ne") {
              return eb(field, "<>", value)
            }

            if (operator === "gt") {
              return eb(field, ">", value)
            }

            if (operator === "gte") {
              return eb(field, ">=", value)
            }

            if (operator === "lt") {
              return eb(field, "<", value)
            }

            if (operator === "lte") {
              return eb(field, "<=", value)
            }

            return eb(field, operator, value)
          }

          if (connector === "OR") {
            conditions.or.push(expr)
          } else {
            conditions.and.push(expr)
          }
        })

        return {
          and: conditions.and.length ? conditions.and : null,
          or: conditions.or.length ? conditions.or : null,
        }
      }
      return {
        create: async ({ data, model }) => {
          const builder = db.insertInto(model).values(data)
          if (config?.type === "mysql") {
            // MySQL has no RETURNING. Look the row up by the id we sent, or by
            // the auto-increment id the insert reports. Never fall back to
            // "latest row": under concurrent inserts that is someone else's row.
            const result = await builder.executeTakeFirst()
            const suppliedId = (data as { id?: unknown }).id
            const insertedId =
              suppliedId !== undefined && suppliedId !== null
                ? suppliedId
                : result.insertId !== undefined && result.insertId > 0n
                  ? Number(result.insertId)
                  : undefined
            if (insertedId === undefined) {
              throw new Error(
                `[Kysely Adapter] Could not determine the id of the row inserted into "${model}".`,
              )
            }
            return await findById(model, insertedId)
          }
          if (config?.type === "mssql") {
            return await builder.outputAll("inserted").executeTakeFirst()
          }
          return await builder.returningAll().executeTakeFirst()
        },

        findOne: async ({ model, where, select: _select }) => {
          const { and, or } = convertWhereClause(model, where)
          let query: any = db.selectFrom(model).selectAll()
          if (and) {
            query = query.where((eb: any) => eb.and(and.map((expr) => expr(eb))))
          }
          if (or) {
            query = query.where((eb: any) => eb.or(or.map((expr) => expr(eb))))
          }
          const res = (await query.executeTakeFirst()) as any
          if (!res) return null
          return res
        },

        findMany: async ({ model, where, limit, offset, sortBy }) => {
          const { and, or } = convertWhereClause(model, where)
          let query: any = db.selectFrom(model)
          if (and) {
            query = query.where((eb: any) => eb.and(and.map((expr) => expr(eb))))
          }
          if (or) {
            query = query.where((eb: any) => eb.or(or.map((expr) => expr(eb))))
          }
          if (config?.type === "mssql") {
            if (!offset) {
              query = query.top(limit || 100)
            }
          } else {
            query = query.limit(limit || 100)
          }
          if (sortBy) {
            query = query.orderBy(getFieldName({ model, field: sortBy.field }), sortBy.direction)
          }
          if (offset) {
            if (config?.type === "mssql") {
              if (!sortBy) {
                query = query.orderBy(getFieldName({ model, field: "id" }))
              }
              query = query.offset(offset).fetch(limit || 100)
            } else {
              query = query.offset(offset)
            }
          }

          const res = (await query.selectAll().execute()) as any
          if (!res) return []
          return res
        },

        update: async ({ model, where, update: values }) => {
          const query = applyWhere(db.updateTable(model).set(values as any), model, where)
          if (config?.type === "mysql") {
            // MySQL has no RETURNING. Resolve the target row's id before the
            // update (which may change the fields `where` matches on), then
            // read the row back by that id.
            const idField = getFieldName({ model, field: "id" })
            const target = await applyWhere(
              (db as any).selectFrom(model).select(idField),
              model,
              where,
            )
              .limit(1)
              .executeTakeFirst()
            if (!target) return null
            await query.execute()
            return await findById(model, (target as any)[idField])
          }
          if (config?.type === "mssql") {
            return (await query.outputAll("inserted").executeTakeFirst()) ?? null
          }
          return (await query.returningAll().executeTakeFirst()) ?? null
        },

        updateMany: async ({ model, where, update: values }) => {
          const { and, or } = convertWhereClause(model, where)
          let query: any = db.updateTable(model).set(values as any)
          if (and) {
            query = query.where((eb: any) => eb.and(and.map((expr) => expr(eb))))
          }
          if (or) {
            query = query.where((eb: any) => eb.or(or.map((expr) => expr(eb))))
          }
          const res = await query.execute()
          return res.reduce((acc: number, r: any) => acc + Number(r.numUpdatedRows ?? 0), 0)
        },

        count: async ({ model, where }) => {
          const { and, or } = convertWhereClause(model, where)
          let query = db
            .selectFrom(model)
            // a temporal solution for counting other than "*" - see more - https://www.sqlite.org/quirks.html#double_quoted_string_literals_are_accepted
            .select(db.fn.count("id").as("count"))
          if (and) {
            query = query.where((eb) => eb.and(and.map((expr) => expr(eb))))
          }
          if (or) {
            query = query.where((eb) => eb.or(or.map((expr) => expr(eb))))
          }
          const res = await query.execute()

          // string | number | bigint
          if (typeof res[0].count === "string") {
            return Number.parseInt(res[0].count, 10)
          }
          if (typeof res[0].count === "bigint") {
            return Number(res[0].count)
          }
          if (typeof res[0].count === "number") {
            return res[0].count
          }
          return res[0].count
        },

        delete: async ({ model, where }) => {
          const { and, or } = convertWhereClause(model, where)
          let query = db.deleteFrom(model)
          if (and) {
            query = query.where((eb) => eb.and(and.map((expr) => expr(eb))))
          }

          if (or) {
            query = query.where((eb) => eb.or(or.map((expr) => expr(eb))))
          }
          await query.execute()
        },

        deleteMany: async ({ model, where }) => {
          const { and, or } = convertWhereClause(model, where)
          let query = db.deleteFrom(model)
          if (and) {
            query = query.where((eb) => eb.and(and.map((expr) => expr(eb))))
          }
          if (or) {
            query = query.where((eb) => eb.or(or.map((expr) => expr(eb))))
          }
          const res = await query.execute()
          return res.reduce((acc: number, r: any) => acc + Number(r.numDeletedRows ?? 0), 0)
        },
        createMigrator: () =>
          createKyselyMigratorFromKysely({
            db,
            dialect: config?.type ?? "sqlite",
          }),
        options: config,
      }
    },
  })
}
