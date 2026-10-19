import { Inject, Injectable } from '@nestjs/common'
import { randomBytes, createHash } from 'node:crypto'
import { PostgresEnrollmentStore } from '../persistence/postgres-enrollment.store.js'
import { SIMULATOR_POOL } from '../persistence/postgres.js'
import type { Pool } from 'pg'
import type { PublicPrincipal } from '../persistence/enrollment-store.js'
import { IDENTITY_PROVIDER } from './identity-provider.js'
import type { IdentityProvider } from './identity-provider.js'

export const ACCESS_TTL_MS = 15 * 60_000
export const SESSION_COOKIE = '__Host-simulator-session'
export const DEV_SESSION_COOKIE = 'simulator-session'

@Injectable()
export class SimulatorAuthService {
  constructor(private readonly store: PostgresEnrollmentStore, @Inject(SIMULATOR_POOL) private readonly pool: Pool, @Inject(IDENTITY_PROVIDER) private readonly identities: IdentityProvider) {}

  async login(credential: string, ip: string): Promise<{ principal: PublicPrincipal; token: string; expiresAt: string }> {
    await this.consumeRateLimit(`ip:${this.fingerprint(ip)}`, Number(process.env.SIMULATOR_LOGIN_IP_LIMIT ?? 120))
    await this.consumeRateLimit(`credential:${this.fingerprint(credential)}`, 5)
    let principal: PublicPrincipal | null
    try { principal = await this.identities.authenticateCredential(credential) } catch { throw new Error('STORAGE_UNAVAILABLE') }
    if (!principal) throw new Error('UNAUTHENTICATED')
    const token = randomBytes(32).toString('base64url')
    let expiresAt: string
    try { expiresAt = await this.store.createAccessSession(principal, token, ACCESS_TTL_MS) } catch { throw new Error('STORAGE_UNAVAILABLE') }
    return { principal, token, expiresAt }
  }

  async current(token: string | undefined) {
    if (!token) throw new Error('UNAUTHENTICATED')
    let principal: PublicPrincipal | null
    try { principal = await this.store.authenticateSession(token) } catch { throw new Error('STORAGE_UNAVAILABLE') }
    if (!principal) throw new Error('UNAUTHENTICATED')
    try { return { principal, expiresAt: await this.store.sessionExpiry(token) } } catch { throw new Error('STORAGE_UNAVAILABLE') }
  }

  async logout(token: string | undefined) {
    if (token) {
      try { await this.store.revokeAccessSession(token) } catch { throw new Error('STORAGE_UNAVAILABLE') }
    }
  }

  async require(token: string | undefined): Promise<PublicPrincipal> {
    return (await this.current(token)).principal
  }

  private fingerprint(value: string) { return createHash('sha256').update(value).digest('hex') }

  private async consumeRateLimit(key: string, limit: number) {
    let result
    try {
      result = await this.pool.query<{ hits: number }>(
        `INSERT INTO simulator_rate_limits(bucket_key,window_start,hits)
         VALUES($1,date_trunc('minute',now()),1)
         ON CONFLICT(bucket_key,window_start) DO UPDATE SET hits=simulator_rate_limits.hits+1
         RETURNING hits`, [key],
      )
    } catch { throw new Error('STORAGE_UNAVAILABLE') }
    if (Number(result.rows[0]?.hits ?? 0) > limit) throw new Error('RATE_LIMITED')
  }
}
