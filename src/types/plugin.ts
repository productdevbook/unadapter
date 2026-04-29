import type { TablesSchema } from "./index.ts";

export type PluginSchema = Omit<TablesSchema, "order">;
