import type { AdapterOptions, InferModelTypes, UnDbSchema } from 'unadapter/types'

export function createAdapter<
  T extends Record<string, any>,
  Schema extends UnDbSchema = UnDbSchema,
  Models extends Record<string, any> = InferModelTypes<Schema>,
>(
  table: (
    options: AdapterOptions<Schema, Models>,
  ) => T,
  options: AdapterOptions<T>,
) {
  if (!options.database) {
    throw new Error('Adapter not provided')
  }
  let adapter
  if (typeof options.database === 'function') {
    // If it's an AdapterInstance (function)
    adapter = options.database(
      options,
      table,
    )
  }
  else {
    throw new TypeError('Invalid adapter provided')
  }
  return adapter
}

export function createTable<
  T extends Record<string, any>,
  Schema extends UnDbSchema = UnDbSchema,
>(table: (options: AdapterOptions<T>) => Schema) {
  return table
}
