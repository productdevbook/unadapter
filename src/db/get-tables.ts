import type { FieldAttribute } from './index.ts'

/**
 * Database schema structure for authentication
 * This type is exported so users can define their own schema externally
 */
export type UnDbSchema = Record<
  string,
  {
    /**
     * The name of the table in the database
     */
    modelName: string
    /**
     * The fields of the table
     */
    fields: Record<string, FieldAttribute>
    /**
     * Whether to disable migrations for this table
     * @default false
     */
    disableMigrations?: boolean
    /**
     * The order of the table
     */
    order?: number
  }
>
