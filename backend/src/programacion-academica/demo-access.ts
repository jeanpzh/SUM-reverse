import { lookup } from 'node:dns/promises'
import { HttpException, Injectable } from '@nestjs/common'
import { isIP } from 'node:net'
import type { LookupAddress } from 'node:dns'
import type { Request } from 'express'

export type FrontendAddressLookup = (hostname: string, options: { all: true }) => Promise<LookupAddress[]>

const defaultLookup: FrontendAddressLookup = (hostname, options) => lookup(hostname, options)
const normalizeAddress = (address: string): string => address.replace(/^::ffff:/i, '').toLowerCase()

@Injectable()
export class DemoAccessService {
  constructor(private readonly resolveFrontend: FrontendAddressLookup = defaultLookup) {}

  async assertAllowed(request: Pick<Request, 'socket'>, env: NodeJS.ProcessEnv = process.env): Promise<void> {
    if (env.SIMULATOR_DEPLOYMENT === 'public') this.reject()

    const remoteAddress = request.socket.remoteAddress
    if (!remoteAddress) this.reject()
    const normalizedRemote = normalizeAddress(remoteAddress)
    if (normalizedRemote === '127.0.0.1' || normalizedRemote === '::1') return

    if (env.SUM_ACADEMIC_SCHEDULING !== '1' || env.SUM_ACADEMIC_PROXY_HOST !== 'frontend') this.reject()
    if (isIP(normalizedRemote) === 0) this.reject()

    let resolved: LookupAddress[]
    try {
      resolved = await this.resolveFrontend('frontend', { all: true })
    } catch {
      this.reject()
    }
    if (resolved.some(({ address }) => normalizeAddress(address) === normalizedRemote)) return
    this.reject()
  }

  private reject(): never {
    throw new HttpException({ error: { code: 'LOOPBACK_ONLY', message: 'La API está limitada a conexiones locales' } }, 403)
  }
}
