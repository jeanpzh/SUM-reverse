import type { PublicPrincipal } from '../persistence/enrollment-store.js'

export interface IdentityProvider {
  authenticateCredential(credential: string): Promise<PublicPrincipal | null>
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER')
