export type Models =
  | "user"
  | "account"
  | "verification"
  | "organization"
  | "member"
  | "invitation"
  | "jwks"
  | "passkey"
  | "two-factor"

interface RateLimit {
  /**
   * The key to use for rate limiting
   */
  key: string
  /**
   * The number of requests made
   */
  count: number
  /**
   * The last request time in milliseconds
   */
  lastRequest: number
}

// Surface types written explicitly so they don't depend on zod inference
// in our public d.ts (`--isolatedDeclarations` can't follow z.infer through
// the build). The matching Zod schemas are still exported from
// `unadapter/db` for runtime validation.
export interface User {
  id: string
  email: string
  emailVerified: boolean
  name: string
  image?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Account {
  id: string
  providerId: string
  accountId: string
  userId: string
  accessToken?: string | null
  refreshToken?: string | null
  idToken?: string | null
  accessTokenExpiresAt?: Date | null
  refreshTokenExpiresAt?: Date | null
  scope?: string | null
  password?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Verification {
  id: string
  value: string
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
  identifier: string
}

export type { RateLimit }
