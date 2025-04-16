import type { FieldAttribute } from '../db/field.ts'

export type AuthPluginSchema = {
  [table in string]: {
    fields: {
      [field in string]: FieldAttribute;
    }
    disableMigration?: boolean
    modelName?: string
  };
}
