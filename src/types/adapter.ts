import type { AdapterOptions, AnyOptions } from './options.ts'

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
export interface Adapter<T extends Record<string, any> = Record<string, any>> {
  id: string
  create: <R = AdapterOptions<T>>(data: {
    model: string
    data: Omit<T, 'id'>
    select?: string[]
  }) => Promise<R>
  findOne: <R = AdapterOptions<T>>(data: {
    model: string
    where: Where[]
    select?: string[]
  }) => Promise<R | null>
  findMany: <R = AdapterOptions<T>>(data: {
    model: string
    where?: Where[]
    limit?: number
    sortBy?: {
      field: string
      direction: 'asc' | 'desc'
    }
    offset?: number
  }) => Promise<R[]>
  count: (data: {
    model: string
    where?: Where[]
  }) => Promise<number>
  /**
   * ⚠︎ Update may not return the updated data
   * if multiple where clauses are provided
   */
  update: <R = AdapterOptions<T>>(data: {
    model: string
    where: Where[]
    update: Record<string, any>
  }) => Promise<R | null>
  updateMany: (data: {
    model: string
    where: Where[]
    update: Record<string, any>
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

export interface AdapterInstance {
  (options: AnyOptions): Adapter
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
