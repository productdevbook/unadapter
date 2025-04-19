import type { InferModelTypes } from './db.ts'
import type { AdapterOptions } from './options.ts'
import type { UnDbSchema } from './schema.ts'

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
  Schema extends UnDbSchema = UnDbSchema,
> {
  id: string

  create: <M extends keyof InferModelTypes<Schema>>(data: {
    model: keyof InferModelTypes<Schema>
    data: Omit<InferModelTypes<Schema>[M], 'id'>
    select?: string[]
  }) => Promise<InferModelTypes<Schema>[M]>

  findOne: <M extends keyof InferModelTypes<Schema>>(data: {
    model: M & string
    where: Where[]
    select?: string[]
  }) => Promise<InferModelTypes<Schema>[M] | null>

  findMany: <M extends keyof InferModelTypes<Schema>>(data: {
    model: M & string
    where?: Where[]
    limit?: number
    sortBy?: {
      field: string
      direction: 'asc' | 'desc'
    }
    offset?: number
    select?: string[]
  }) => Promise<InferModelTypes<Schema>[M][]>

  count: (data: {
    model: string
    where?: Where[]
  }) => Promise<number>

  /**
   * ⚠︎ Update may not return the updated data
   * if multiple where clauses are provided
   */
  update: <M extends keyof InferModelTypes<Schema>>(data: {
    model: M & string
    where: Where[]
    update: Partial<InferModelTypes<Schema>[M]>
  }) => Promise<InferModelTypes<Schema>[M] | null>

  updateMany: <M extends keyof InferModelTypes<Schema>>(data: {
    model: M & string
    where: Where[]
    update: Partial<InferModelTypes<Schema>[M]>
  }) => Promise<number>

  delete: (data: { model: string, where: Where[] }) => Promise<void>

  deleteMany: (data: { model: string, where: Where[] }) => Promise<number>
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
  Schema extends UnDbSchema = UnDbSchema,
> {
  (
    getTables: (options: AdapterOptions<T, Schema>) => Schema,
    options: AdapterOptions<T, Schema>,
  ): Adapter<T, Schema>
}
