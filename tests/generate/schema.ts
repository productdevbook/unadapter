import { createTable } from "../../src/index.ts"

export interface GenerateTestOptions {
  user?: {
    modelName?: string
  }
}

/**
 * A realistic schema shared by the source-generator tests.
 */
export const getTables = createTable<GenerateTestOptions>((options) => {
  const userModelName = options.user?.modelName || "user"

  return {
    user: {
      modelName: userModelName,
      fields: {
        name: { type: "string", required: true, index: true },
        email: { type: "string", required: true, unique: true, index: true },
        emailVerified: { type: "boolean", required: true, defaultValue: () => false },
        createdAt: { type: "date", required: true, defaultValue: () => new Date() },
        updatedAt: { type: "date", required: true, defaultValue: () => new Date() },
      },
      order: 1,
    },
    account: {
      modelName: "account",
      fields: {
        providerId: { type: "string", required: true },
        accountId: { type: "string", required: true },
        userId: {
          type: "string",
          required: true,
          references: { model: "user", field: "id", onDelete: "cascade" },
        },
        accessToken: { type: "string", required: false },
        createdAt: { type: "date", required: true },
        updatedAt: { type: "date", required: true },
      },
      order: 2,
    },
    session: {
      modelName: "session",
      fields: {
        token: { type: "string", required: true, unique: true },
        userId: {
          type: "string",
          required: true,
          references: { model: "user", field: "id", onDelete: "cascade" },
        },
        expiresAt: { type: "date", required: true },
        createdAt: { type: "date", required: true },
        updatedAt: { type: "date", required: true },
      },
      order: 3,
    },
    verification: {
      modelName: "verification",
      fields: {
        identifier: { type: "string", required: true },
        value: { type: "string", required: true },
        expiresAt: { type: "date", required: true },
        createdAt: { type: "date", required: true },
      },
      order: 4,
    },
  }
})
