import type { AnyOptions } from './options.ts'

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
export interface Adapter<Models extends Record<string, any> = Record<string, any>> {
  id: string
  create: <M extends keyof Models>(data: {
    model: M & string
    data: Omit<Models[M], 'id'>
    select?: string[]
  }) => Promise<Models[M]>
  findOne: <M extends keyof Models>(data: {
    model: M & string
    where: Where[]
    select?: string[]
  }) => Promise<Models[M] | null>
  findMany: <M extends keyof Models>(data: {
    model: M & string
    where?: Where[]
    limit?: number
    sortBy?: {
      field: string
      direction: 'asc' | 'desc'
    }
    offset?: number
  }) => Promise<Models[M][]>
  count: (data: {
    model: string
    where?: Where[]
  }) => Promise<number>
  /**
   * ⚠︎ Update may not return the updated data
   * if multiple where clauses are provided
   */
  update: <M extends keyof Models>(data: {
    model: M & string
    where: Where[]
    update: Partial<Models[M]>
  }) => Promise<Models[M] | null>
  updateMany: <M extends keyof Models>(data: {
    model: M & string
    where: Where[]
    update: Partial<Models[M]>
  }) => Promise<number>
  delete: (data: { model: string, where: Where[] }) => Promise<void>
  deleteMany: (data: { model: string, where: Where[] }) => Promise<number>
  /**
   *
   * @param options
   * @param file - file path if provided by the user
   */
  createSchema?: (
    options: AnyOptions,
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

export interface AdapterInstance<Models extends Record<string, any> = Record<string, any>> {
  (options: AnyOptions): Adapter<Models>
}

export interface SecondaryStorage {
  /**
   *
   * @param key - Key to get
   * @returns - Value of the key
   */
  get: (key: string) => Promise<string | null> | string | null
  set: (
  /**
   * Key to store
   */
    key: string,
  /**
   * Value to store
   */
    value: string,
  /**
   * Time to live in seconds
   */
    ttl?: number,
  ) => Promise<void | null | string> | void
  /**
   *
   * @param key - Key to delete
   */
  delete: (key: string) => Promise<void | null | string> | void
}
