import type { SQL } from "drizzle-orm"
import type { Adapter, TablesSchema, Where } from "../../types/index.ts"
import type { AdapterDebugLogs } from "../create/index.ts"
import { and, asc, count, desc, eq, gt, gte, inArray, like, lt, lte, ne, or } from "drizzle-orm"
import { BetterAuthError } from "../../error/index.ts"
import { createAdapter } from "../create/index.ts"

export interface DB {
  [key: string]: any
}

export interface DrizzleAdapterConfig {
  /**
   * The schema object that defines the tables and fields
   */
  schema?: Record<string, any>
  /**
   * The database provider
   */
  provider: "pg" | "mysql" | "sqlite"
  /**
   * If the table names in the schema are plural
   * set this to true. For example, if the schema
   * has an object with a key "users" instead of "user"
   */
  usePlural?: boolean
  /**
   * Enable debug logs for the adapter
   *
   * @default false
   */
  debugLogs?: AdapterDebugLogs
}

export function drizzleAdapter<
  T extends Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
>(
  db: DB,
  config: DrizzleAdapterConfig,
): (getTables: (options: any) => Schema, options: any) => Adapter<T, Schema> {
  return createAdapter<T, Schema>({
    config: {
      adapterId: "drizzle",
      adapterName: "Drizzle Adapter",
      usePlural: config.usePlural ?? false,
      debugLogs: config.debugLogs ?? false,
    },
    adapter: ({ getFieldName }) => {
      function getSchema(model: string) {
        const schema = config.schema || db._.fullSchema
        if (!schema) {
          throw new BetterAuthError(
            "Drizzle adapter failed to initialize. Schema not found. Please provide a schema object in the adapter options object.",
          )
        }
        const schemaModel = schema[model]
        if (!schemaModel) {
          throw new BetterAuthError(
            `[# Drizzle Adapter]: The model "${model}" was not found in the schema object. Please pass the schema directly to the adapter options.`,
          )
        }
        return schemaModel
      }
      const findById = async (model: string, id: unknown) => {
        const schemaModel = getSchema(model)
        // If the user doesn't have `id` as a field, then this will fail.
        // We expect that they defined `id` in all of their models.
        if (!("id" in schemaModel)) {
          throw new BetterAuthError(
            `The model "${model}" does not have an "id" field. Please use the "id" field as your primary key.`,
          )
        }
        const res = await db
          .select()
          .from(schemaModel)
          .where(eq(schemaModel.id, id))
          .limit(1)
          .execute()
        return res[0] ?? null
      }
      function buildCondition(w: Where, model: string) {
        const schemaModel = getSchema(model)
        const field = getFieldName({ model, field: w.field })
        if (!schemaModel[field]) {
          throw new BetterAuthError(
            `The field "${w.field}" does not exist in the schema for the model "${model}". Please update your schema.`,
          )
        }
        if (w.operator === "in") {
          if (!Array.isArray(w.value)) {
            throw new BetterAuthError(
              `The value for the field "${w.field}" must be an array when using the "in" operator.`,
            )
          }
          return inArray(schemaModel[field], w.value)
        }
        if (w.operator === "contains") {
          return like(schemaModel[field], `%${w.value}%`)
        }
        if (w.operator === "starts_with") {
          return like(schemaModel[field], `${w.value}%`)
        }
        if (w.operator === "ends_with") {
          return like(schemaModel[field], `%${w.value}`)
        }
        if (w.operator === "lt") {
          return lt(schemaModel[field], w.value)
        }
        if (w.operator === "lte") {
          return lte(schemaModel[field], w.value)
        }
        if (w.operator === "gt") {
          return gt(schemaModel[field], w.value)
        }
        if (w.operator === "gte") {
          return gte(schemaModel[field], w.value)
        }
        if (w.operator === "ne") {
          return ne(schemaModel[field], w.value)
        }
        return eq(schemaModel[field], w.value)
      }

      function convertWhereClause(where: Where[], model: string) {
        if (!where || where.length === 0) return []
        if (where.length === 1) {
          const w = where[0]
          if (!w) {
            return []
          }
          return [buildCondition(w, model)]
        }
        const andGroup = where.filter((w) => (w.connector ?? "AND") !== "OR")
        const orGroup = where.filter((w) => w.connector === "OR")

        const andClause = and(...andGroup.map((w) => buildCondition(w, model)))
        const orClause = or(...orGroup.map((w) => buildCondition(w, model)))

        const clause: SQL<unknown>[] = []

        if (andGroup.length) clause.push(andClause!)
        if (orGroup.length) clause.push(orClause!)
        return clause
      }
      function checkMissingFields(
        schema: Record<string, any>,
        model: string,
        values: Record<string, any>,
      ) {
        if (!schema) {
          throw new BetterAuthError(
            "Drizzle adapter failed to initialize. Schema not found. Please provide a schema object in the adapter options object.",
          )
        }
        for (const key in values) {
          if (!schema[key]) {
            throw new BetterAuthError(
              `The field "${key}" does not exist in the "${model}" schema. Please update your drizzle schema or re-generate using "npx @better-auth/cli generate".`,
            )
          }
        }
      }
      return {
        async create({ model, data: values }) {
          const schemaModel = getSchema(model)
          checkMissingFields(schemaModel, model, values)
          const builder = db.insert(schemaModel).values(values)
          if (config.provider !== "mysql") {
            const rows = await builder.returning()
            return rows[0]
          }
          // MySQL has no RETURNING. Look the row up by the id we sent (or the
          // schema's $defaultFn produced), or by the auto-increment id the
          // insert reports. Never fall back to "latest row": under concurrent
          // inserts that is someone else's row.
          const result = await builder
          const header = Array.isArray(result) ? result[0] : result
          const insertedId =
            values.id ??
            builder.config?.values?.[0]?.id?.value ??
            (typeof header?.insertId === "number" && header.insertId > 0
              ? header.insertId
              : undefined)
          if (insertedId === undefined || insertedId === null) {
            throw new BetterAuthError(
              `Could not determine the id of the row inserted into "${model}".`,
            )
          }
          return await findById(model, insertedId)
        },
        async findOne({ model, where }) {
          const schemaModel = getSchema(model)
          const clause = convertWhereClause(where, model)
          const res = await db
            .select()
            .from(schemaModel)
            .where(...clause)
          if (!res.length) return null
          return res[0]
        },
        async findMany({ model, where, sortBy, limit, offset }) {
          const schemaModel = getSchema(model)
          const clause = where ? convertWhereClause(where, model) : []

          const sortFn = sortBy?.direction === "desc" ? desc : asc
          const builder = db
            .select()
            .from(schemaModel)
            .limit(limit || 100)
            .offset(offset || 0)
          if (sortBy?.field) {
            builder.orderBy(sortFn(schemaModel[getFieldName({ model, field: sortBy?.field })]))
          }
          return await builder.where(...clause)
        },
        async count({ model, where }) {
          const schemaModel = getSchema(model)
          const clause = where ? convertWhereClause(where, model) : []
          const res = await db
            .select({ count: count() })
            .from(schemaModel)
            .where(...clause)
          return res[0].count
        },
        async update({ model, where, update: values }) {
          const schemaModel = getSchema(model)
          const clause = convertWhereClause(where, model)
          const builder = db
            .update(schemaModel)
            .set(values)
            .where(...clause)
          if (config.provider !== "mysql") {
            const rows = await builder.returning()
            return rows[0] ?? null
          }
          // MySQL has no RETURNING. Resolve the target row's id before the
          // update (which may change the fields `where` matches on), then
          // read the row back by that id.
          const target = await db
            .select({ id: schemaModel.id })
            .from(schemaModel)
            .where(...clause)
            .limit(1)
          if (!target.length) return null
          await builder
          return await findById(model, target[0].id)
        },
        async updateMany({ model, where, update: values }) {
          const schemaModel = getSchema(model)
          const clause = convertWhereClause(where, model)
          const builder = db
            .update(schemaModel)
            .set(values)
            .where(...clause)
          const result = await builder
          return getAffectedRows(result)
        },
        async delete({ model, where }) {
          const schemaModel = getSchema(model)
          const clause = convertWhereClause(where, model)
          await db.delete(schemaModel).where(...clause)
        },
        async deleteMany({ model, where }: { model: string; where: Where[] }) {
          const schemaModel = getSchema(model)
          const clause = convertWhereClause(where, model)
          const result = await db.delete(schemaModel).where(...clause)
          return getAffectedRows(result)
        },
        options: config,
      }
    },
  })
}

function getAffectedRows(result: any): number {
  if (typeof result === "number") return result
  if (!result) return 0
  if (typeof result.rowCount === "number") return result.rowCount
  if (typeof result.changes === "number") return result.changes
  if (Array.isArray(result)) {
    if (result[0] && typeof result[0].affectedRows === "number") {
      return result[0].affectedRows
    }
    return result.length
  }
  if (typeof result.affectedRows === "number") return result.affectedRows
  return 0
}
