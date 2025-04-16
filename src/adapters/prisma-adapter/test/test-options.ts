import type { Adapter, BetterAuthOptions } from '../../../types/index.ts'

export function createTestOptions(adapter: (options: BetterAuthOptions) => Adapter, useNumberId = false) {
  return ({
    database: adapter,
    user: {
      fields: { email: 'email_address' },
      additionalFields: {
        test: {
          type: 'string',
          defaultValue: 'test',
        },
      },
    },
    advanced: {
      database: {
        useNumberId,
      },
    },
  }) satisfies BetterAuthOptions
}
