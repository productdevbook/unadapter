import type { InferModelTypes } from './db.ts'
import type { AdapterOptions } from './options.ts'
import type { TablesSchema } from './schema.ts'

/**
 * Adapter where clause
 */
export interface Where {
  operator?:
    | 'eq'
    | 'ne'
    | 'lt'
    | 'lte'
    | 'gt'
    | 'gte'
    | 'in'
    | 'contains'
    | 'starts_with'
    | 'ends_with' // eq by default
  value: string | number | boolean | string[] | number[] | Date | null
  field: string
  connector?: 'AND' | 'OR' // AND by default
}

/**
 * Adapter Interface
 */
export interface Adapter<
  T extends Record<string, any> = Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
  Models extends InferModelTypes<Schema> = InferModelTypes<Schema>,
> {
  id: string

  create: <M extends keyof Models>(data: {
    model: M & (string | object)
    data: Omit<Models[M], 'id'>
    select?: string[]
  }) => Promise<Models[M]>

  findOne: <M extends keyof Models>(data: {
    model: M & (string | object)
    where: Where[]
    select?: string[]
  }) => Promise<Models[M] | null>

  findMany: <M extends keyof Models>(data: {
    model: M & (string | object)
    where?: Where[]
    limit?: number
    sortBy?: {
      field: string
      direction: 'asc' | 'desc'
    }
    offset?: number
    select?: string[]
  }) => Promise<Models[M][]>

  count: (data: {
    where?: Where[]
    model: string
  }) => Promise<number>

  /**
   * ⚠︎ Update may not return the updated data
   * if multiple where clauses are provided
   */
  update: <M extends keyof Models>(data: {
    model: M & (string | object)
    where: Where[]
    update: Partial<Models[M]>
  }) => Promise<Models[M] | null>

  updateMany: <M extends keyof Models>(data: {
    model: M & (string | object)
    where: Where[]
    update: Partial<Models[M]>
  }) => Promise<number>

  delete: <M extends keyof Models>(
    data: {
      model: M & (string | object)
      where: Where[]
    }
  ) => Promise<void>

  deleteMany: <M extends keyof Models>(
    data: {
      model: M & (string | object)
      where: Where[]
    }
  ) => Promise<number>
  /**
   *
   * @param options
   * @param file - file path if provided by the user
   */
  createSchema?: (
    options: AdapterOptions<T, Schema>,
    file?: string,
  ) => Promise<AdapterSchemaCreation>

  options?: Record<string, any>
}

export interface AdapterSchemaCreation {
  /**
   * Code to be inserted into the file
   */
  code: string
  /**
   * Path to the file, including the file name and extension.
   * Relative paths are supported, with the current working directory of the developer's project as the base.
   */
  path: string
  /**
   * Append the file if it already exists.
   * Note: This will not apply if `overwrite` is set to true.
   */
  append?: boolean
  /**
   * Overwrite the file if it already exists
   */
  overwrite?: boolean
}

export interface AdapterInstance<
  T extends Record<string, any>,
  Schema extends TablesSchema = TablesSchema,
> {
  (
    getTables: (options: AdapterOptions<T, Schema>) => Schema,
    options: AdapterOptions<T, Schema>,
  ): Adapter<T, Schema>
}
