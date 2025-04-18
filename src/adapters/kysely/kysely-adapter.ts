import type {
  InsertQueryBuilder,
  Kysely,
  UpdateQueryBuilder,
} from 'kysely'
import type {
  AdapterOptions,
  InferModelTypes,
  UnDbSchema,
  Where,
} from 'unadapter/types'
import type { AdapterDebugLogs } from '../create/index.ts'
import type { KyselyDatabaseType } from './types.ts'
import { createAdapter } from '../create/index.ts'

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
  Schema extends UnDbSchema = UnDbSchema,
  Models extends Record<string, any> = InferModelTypes<Schema>,
>(
  db: Kysely<any>,
  getTables: (options: AdapterOptions<T>) => Schema,
  config?: KyselyAdapterConfig,
) {
  return createAdapter<T, Schema, Models>({
    getTables,
    config: {
      adapterId: 'kysely',
      adapterName: 'Kysely Adapter',
      usePlural: config?.usePlural,
      debugLogs: config?.debugLogs,
      supportsBooleans: !(config?.type === 'sqlite' || config?.type === 'mssql' || !config?.type),
      supportsDates: !(config?.type === 'sqlite' || config?.type === 'mssql' || !config?.type),
      supportsJSON: false,
    },
    adapter: ({ getFieldName, schema }) => {
      const withReturning = async (
        values: Record<string, any>,
        builder:
          | InsertQueryBuilder<any, any, any>
          | UpdateQueryBuilder<any, string, string, any>,
        model: string,
        where: Where[],
      ) => {
        let res: any
        if (config?.type === 'mysql') {
          // This isn't good, but kysely doesn't support returning in mysql and it doesn't return the inserted id.
          // Change this if there is a better way.
          await builder.execute()
          const field = values.id
            ? 'id'
            : where.length > 0 && where[0].field
              ? where[0].field
              : 'id'

          if (!values.id && where.length === 0) {
            res = await db
              .selectFrom(model)
              .selectAll()
              .orderBy(getFieldName({ model, field }), 'desc')
              .limit(1)
              .executeTakeFirst()
            return res
          }

          const value = values[field] || where[0].value
          res = await db
            .selectFrom(model)
            .selectAll()
            .orderBy(getFieldName({ model, field }), 'desc')
            .where(getFieldName({ model, field }), '=', value)
            .limit(1)
            .executeTakeFirst()
          return res
        }
        if (config?.type === 'mssql') {
          res = await builder.outputAll('inserted').executeTakeFirst()
          return res
        }
        res = await builder.returningAll().executeTakeFirst()
        return res
      }
      function transformValueToDB(value: any, model: string, field: string) {
        if (field === 'id') {
          return value
        }
        const { type = 'sqlite' } = config || {}
        let f = schema[model]?.fields[field]
        if (!f) {
          // @ts-expect-error - The model name can be a sanitized, thus using the custom model name, not one of the default ones.
          f = Object.values(schema).find(f => f.modelName === model)!
        }
        if (
          f.type === 'boolean'
          && (type === 'sqlite' || type === 'mssql')
          && value !== null
          && value !== undefined
        ) {
          return value ? 1 : 0
        }
        if (f.type === 'date' && value && value instanceof Date) {
          return type === 'sqlite' ? value.toISOString() : value
        }
        return value
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
          let {
            field: _field,
            value,
            operator = '=',
            connector = 'AND',
          } = condition
          const field = getFieldName({ model, field: _field })
          value = transformValueToDB(value, model, _field)
          const expr = (eb: any) => {
            if (operator.toLowerCase() === 'in') {
              return eb(field, 'in', Array.isArray(value) ? value : [value])
            }

            if (operator === 'contains') {
              return eb(field, 'like', `%${value}%`)
            }

            if (operator === 'starts_with') {
              return eb(field, 'like', `${value}%`)
            }

            if (operator === 'ends_with') {
              return eb(field, 'like', `%${value}`)
            }

            if (operator === 'eq') {
              return eb(field, '=', value)
            }

            if (operator === 'ne') {
              return eb(field, '<>', value)
            }

            if (operator === 'gt') {
              return eb(field, '>', value)
            }

            if (operator === 'gte') {
              return eb(field, '>=', value)
            }

            if (operator === 'lt') {
              return eb(field, '<', value)
            }

            if (operator === 'lte') {
              return eb(field, '<=', value)
            }

            return eb(field, operator, value)
          }

          if (connector === 'OR') {
            conditions.or.push(expr)
          }
          else {
            conditions.and.push(expr)
          }
        })

        return {
          and: conditions.and.length ? conditions.and : null,
          or: conditions.or.length ? conditions.or : null,
        }
      }
      return {
        create: async ({
          data,
          model,
        }) => {
          const builder = db.insertInto(model).values(data)
          return await withReturning(data, builder, model, [])
        },

        findOne: async ({
          model,
          where,
          select,
        }) => {
          const { and, or } = convertWhereClause(model, where)
          let query = db.selectFrom(model).selectAll()
          if (and) {
            query = query.where(eb => eb.and(and.map(expr => expr(eb))))
          }
          if (or) {
            query = query.where(eb => eb.or(or.map(expr => expr(eb))))
          }
          const res = await query.executeTakeFirst() as any
          if (!res)
            return null
          return res
        },

        findMany: async ({
          model,
          where,
          limit,
          offset,
          sortBy,
        }) => {
          const { and, or } = convertWhereClause(model, where)
          let query = db.selectFrom(model)
          if (and) {
            query = query.where(eb => eb.and(and.map(expr => expr(eb)))) as any
          }
          if (or) {
            query = query.where(eb => eb.or(or.map(expr => expr(eb)))) as any
          }
          if (config?.type === 'mssql') {
            if (!offset) {
              query = query.top(limit || 100) as any
            }
          }
          else {
            query = query.limit(limit || 100) as any
          }
          if (sortBy) {
            query = query.orderBy(
              getFieldName({ model, field: sortBy.field }),
              sortBy.direction,
            ) as any
          }
          if (offset) {
            if (config?.type === 'mssql') {
              if (!sortBy) {
                query = query.orderBy(getFieldName({ model, field: 'id' })) as any
              }
              query = query.offset(offset).fetch(limit || 100) as any
            }
            else {
              query = query.offset(offset) as any
            }
          }

          const res = await query.selectAll().execute() as any
          if (!res)
            return []
          return res
        },

        update: async ({
          model,
          where,
          update: values,
        }) => {
          const { and, or } = convertWhereClause(model, where)

          let query = db.updateTable(model).set(values as any)
          if (and) {
            query = query.where(eb => eb.and(and.map(expr => expr(eb))))
          }
          if (or) {
            query = query.where(eb => eb.or(or.map(expr => expr(eb))))
          }
          return await withReturning(values as any, query, model, where)
        },

        updateMany: async ({
          model,
          where,
          update: values,
        }) => {
          const { and, or } = convertWhereClause(model, where)
          let query = db.updateTable(model).set(values as any)
          if (and) {
            query = query.where(eb => eb.and(and.map(expr => expr(eb))))
          }
          if (or) {
            query = query.where(eb => eb.or(or.map(expr => expr(eb))))
          }
          const res = await query.execute()
          return res.length
        },

        count: async ({
          model,
          where,
        }) => {
          const { and, or } = convertWhereClause(model, where)
          let query = db
            .selectFrom(model)
          // a temporal solution for counting other than "*" - see more - https://www.sqlite.org/quirks.html#double_quoted_string_literals_are_accepted
            .select(db.fn.count('id').as('count'))
          if (and) {
            query = query.where(eb => eb.and(and.map(expr => expr(eb))))
          }
          if (or) {
            query = query.where(eb => eb.or(or.map(expr => expr(eb))))
          }
          const res = await query.execute()

          // string | number | bigint
          if (typeof res[0].count === 'string') {
            return Number.parseInt(res[0].count, 10)
          }
          if (typeof res[0].count === 'bigint') {
            return Number(res[0].count)
          }
          if (typeof res[0].count === 'number') {
            return res[0].count
          }
          return res[0].count
        },

        delete: async ({
          model,
          where,
        }) => {
          const { and, or } = convertWhereClause(model, where)
          let query = db.deleteFrom(model)
          if (and) {
            query = query.where(eb => eb.and(and.map(expr => expr(eb))))
          }

          if (or) {
            query = query.where(eb => eb.or(or.map(expr => expr(eb))))
          }
          await query.execute()
        },

        deleteMany: async ({
          model,
          where,
        }) => {
          const { and, or } = convertWhereClause(model, where)
          let query = db.deleteFrom(model)
          if (and) {
            query = query.where(eb => eb.and(and.map(expr => expr(eb))))
          }
          if (or) {
            query = query.where(eb => eb.or(or.map(expr => expr(eb))))
          }
          return (await query.execute()).length
        },
        options: config,
      }
    },
  })
}
