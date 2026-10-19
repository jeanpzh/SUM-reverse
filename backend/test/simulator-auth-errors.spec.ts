import { HttpException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { SimulatorAuthController } from '../src/auth/simulator-auth.controller.js'
import { ACCESS_TTL_MS, SimulatorAuthService } from '../src/auth/simulator-auth.service.js'
import type { PublicPrincipal } from '../src/persistence/enrollment-store.js'

const origin = 'http://127.0.0.1:5189'
const credential = 'A'.repeat(43)
const principal: PublicPrincipal = { campaignId: '00000000-0000-4000-8000-000000000001', runId: '00000000-0000-4000-8000-000000000002', actorId: 'SYN-AUTH-U0001' }

function service(store: Record<string, unknown>, pool: Record<string, unknown>, identities: Record<string, unknown>) {
  return new SimulatorAuthService(store as never, pool as never, identities as never)
}

function request(path: string, headers: Record<string, string> = {}) {
  return {
    hostname: '127.0.0.1',
    originalUrl: path,
    headers,
    ip: '127.0.0.1',
    get: (name: string) => name.toLowerCase() === 'origin' ? origin : undefined,
  } as unknown as Request
}

async function rejection(promise: Promise<unknown>) {
  try { await promise } catch (error) { return error as HttpException }
  throw new Error('Expected request to reject')
}

describe('simulator authentication storage failures', () => {
  it('maps rate-limit database errors to storage failure while preserving rate-limit decisions', async () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error('database offline')) }
    const api = service({}, pool, {})
    await expect(api.login(credential, '127.0.0.1')).rejects.toMatchObject({ message: 'STORAGE_UNAVAILABLE' })

    const limited = service({}, { query: vi.fn().mockResolvedValue({ rows: [{ hits: 121 }] }) }, {})
    await expect(limited.login(credential, '127.0.0.1')).rejects.toMatchObject({ message: 'RATE_LIMITED' })
  })

  it('maps credential, session creation and session-expiry database failures to storage failure', async () => {
    const limiter = { query: vi.fn().mockResolvedValue({ rows: [{ hits: 1 }] }) }
    const credentialFailure = service({}, limiter, { authenticateCredential: vi.fn().mockRejectedValue(new Error('database offline')) })
    await expect(credentialFailure.login(credential, '127.0.0.1')).rejects.toMatchObject({ message: 'STORAGE_UNAVAILABLE' })

    const createAccessSession = vi.fn().mockRejectedValue(new Error('database offline'))
    const sessionCreationFailure = service({ createAccessSession }, limiter, { authenticateCredential: vi.fn().mockResolvedValue(principal) })
    await expect(sessionCreationFailure.login(credential, '127.0.0.1')).rejects.toMatchObject({ message: 'STORAGE_UNAVAILABLE' })
    expect(createAccessSession).toHaveBeenCalledWith(principal, expect.any(String), ACCESS_TTL_MS)

    const sessionReadFailure = service({ authenticateSession: vi.fn().mockResolvedValue(principal), sessionExpiry: vi.fn().mockRejectedValue(new Error('database offline')) }, {}, {})
    await expect(sessionReadFailure.current('session-token')).rejects.toMatchObject({ message: 'STORAGE_UNAVAILABLE' })
  })

  it('maps logout revocation failures to HTTP 503 and includes a finite Retry-After on 429', async () => {
    vi.stubEnv('SIMULATOR_PUBLIC_ORIGIN', origin)
    const logoutController = new SimulatorAuthController({ logout: vi.fn().mockRejectedValue(new Error('STORAGE_UNAVAILABLE')) } as never)
    const logoutError = await rejection(logoutController.logout(request('/simulator/auth/v1/logout'), { setHeader: vi.fn() } as unknown as Response))
    expect(logoutError).toBeInstanceOf(HttpException)
    expect(logoutError.getStatus()).toBe(503)
    expect(logoutError.getResponse()).toEqual({ error: { code: 'STORAGE_UNAVAILABLE', fields: [] } })

    const setHeader = vi.fn()
    const response = { setHeader } as unknown as Response
    const loginController = new SimulatorAuthController({ login: vi.fn().mockRejectedValue(new Error('RATE_LIMITED')) } as never)
    const loginError = await rejection(loginController.login({ credential }, request('/simulator/auth/v1/login'), response))
    expect(loginError.getStatus()).toBe(429)
    expect(loginError.getResponse()).toEqual({ error: { code: 'RATE_LIMITED', fields: [] } })
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '60')

    const sessionController = new SimulatorAuthController({ current: vi.fn().mockRejectedValue(new Error('STORAGE_UNAVAILABLE')) } as never)
    const sessionError = await rejection(sessionController.session(request('/simulator/auth/v1/session')))
    expect(sessionError.getStatus()).toBe(503)
    expect(sessionError.getResponse()).toEqual({ error: { code: 'STORAGE_UNAVAILABLE', fields: [] } })
    vi.unstubAllEnvs()
  })
})
