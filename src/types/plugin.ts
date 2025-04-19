import type { TablesSchema } from 'unadapter/types'

export type PluginSchema = Omit<TablesSchema, 'order'>
