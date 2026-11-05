import { describe, expect, it, vi } from 'vitest'
import { DemoAccessService } from '../src/programacion-academica/demo-access.js'

const requestFrom = (remoteAddress: string) => ({ socket: { remoteAddress } })
const localProxyEnv = { SUM_ACADEMIC_SCHEDULING: '1', SUM_ACADEMIC_PROXY_HOST: 'frontend' }

describe('academic demo access policy', () => {
  it('allows loopback in local mode without resolving DNS, but denies it in public mode', async () => {
    const resolver = vi.fn(async () => [{ address: '10.0.0.4', family: 4 }])
    const access = new DemoAccessService(resolver)
    await expect(access.assertAllowed(requestFrom('127.0.0.1'))).resolves.toBeUndefined()
    await expect(access.assertAllowed(requestFrom('::1'))).resolves.toBeUndefined()
    expect(resolver).not.toHaveBeenCalled()
    await expect(access.assertAllowed(requestFrom('127.0.0.1'), { ...localProxyEnv, SIMULATOR_DEPLOYMENT: 'public' })).rejects.toMatchObject({ status: 403 })
  })

  it('allows only an exact currently resolved frontend address in explicitly enabled local mode', async () => {
    const resolver = vi.fn(async () => [
      { address: '10.0.0.4', family: 4 },
      { address: 'fd00::4', family: 6 },
    ])
    const access = new DemoAccessService(resolver)
    await expect(access.assertAllowed(requestFrom('10.0.0.4'), localProxyEnv)).resolves.toBeUndefined()
    await expect(access.assertAllowed(requestFrom('fd00::4'), localProxyEnv)).resolves.toBeUndefined()
    await expect(access.assertAllowed(requestFrom('10.0.0.5'), localProxyEnv)).rejects.toMatchObject({ status: 403 })
    expect(resolver).toHaveBeenCalledTimes(3)
    expect(resolver).toHaveBeenCalledWith('frontend', { all: true })
  })

  it('uses fresh DNS answers for each request and denies resolution failures safely', async () => {
    const resolver = vi.fn()
      .mockResolvedValueOnce([{ address: '10.0.0.4', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }])
      .mockRejectedValueOnce(new Error('resolver detail must not escape'))
    const access = new DemoAccessService(resolver)
    await expect(access.assertAllowed(requestFrom('10.0.0.4'), localProxyEnv)).resolves.toBeUndefined()
    await expect(access.assertAllowed(requestFrom('10.0.0.4'), localProxyEnv)).rejects.toMatchObject({ status: 403 })
    await expect(access.assertAllowed(requestFrom('10.0.0.5'), localProxyEnv)).rejects.toMatchObject({ status: 403 })
  })

  it('denies proxy access when either opt-in flag is missing or the deployment is public', async () => {
    const resolver = vi.fn(async () => [{ address: '10.0.0.4', family: 4 }])
    const access = new DemoAccessService(resolver)
    await expect(access.assertAllowed(requestFrom('10.0.0.4'), { SUM_ACADEMIC_PROXY_HOST: 'frontend' })).rejects.toMatchObject({ status: 403 })
    await expect(access.assertAllowed(requestFrom('10.0.0.4'), { SUM_ACADEMIC_SCHEDULING: '1' })).rejects.toMatchObject({ status: 403 })
    await expect(access.assertAllowed(requestFrom('10.0.0.4'), { ...localProxyEnv, SIMULATOR_DEPLOYMENT: 'public' })).rejects.toMatchObject({ status: 403 })
    expect(resolver).not.toHaveBeenCalled()
  })

  it('does not trust forwarded headers or accept broad private ranges', async () => {
    const resolver = vi.fn(async () => [{ address: '10.0.0.4', family: 4 }])
    const access = new DemoAccessService(resolver)
    const spoofed = { ...requestFrom('10.0.0.5'), headers: { 'x-forwarded-for': '127.0.0.1', host: 'frontend' } }
    await expect(access.assertAllowed(spoofed, localProxyEnv)).rejects.toMatchObject({ status: 403 })
    await expect(access.assertAllowed(requestFrom('10.0.0.0'), { ...localProxyEnv, SUM_ACADEMIC_PROXY_HOST: '10.0.0.0/8' })).rejects.toMatchObject({ status: 403 })
    expect(resolver).toHaveBeenCalledTimes(1)
  })
})
