import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { HttpException } from '@nestjs/common'
import { DEV_SESSION_COOKIE, SESSION_COOKIE, SimulatorAuthService } from './simulator-auth.service.js'

function loopback(host: string) { return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.startsWith('127.') }
function cookieName(request: Request) { return process.env.SIMULATOR_INSECURE_COOKIE === '1' && loopback(request.hostname) ? DEV_SESSION_COOKIE : SESSION_COOKIE }
function readToken(request: Request) {
  const name = cookieName(request)
  const raw = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  return raw ? decodeURIComponent(raw.slice(name.length + 1)) : undefined
}
function requireOrigin(request: Request) {
  const expected = process.env.SIMULATOR_PUBLIC_ORIGIN
  if (!expected || request.get('origin') !== expected) throw new HttpException({ error: { code: 'FORBIDDEN', fields: [] } }, 403)
  if (new URL(request.originalUrl, expected).search) throw new HttpException({ error: { code: 'INVALID_REQUEST', fields: ['query'] } }, 400)
}
function requireEmptyRequest(request: Request, mutating = true) {
  if (mutating) requireOrigin(request)
  else if (new URL(request.originalUrl, 'http://localhost').search) throw new HttpException({ error: { code: 'INVALID_REQUEST', fields: ['query'] } }, 400)
  const body = Number(request.headers['content-length'] ?? 0) > 0 || request.headers['transfer-encoding'] !== undefined
  if (body) throw new HttpException({ error: { code: 'INVALID_REQUEST', fields: ['body'] } }, 400)
}
function setCookie(response: Response, name: string, token: string, maxAge: number, secure: boolean) {
  response.setHeader('Set-Cookie', `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`)
}

@Controller('simulator/auth/v1')
export class SimulatorAuthController {
  constructor(private readonly auth: SimulatorAuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    requireOrigin(request)
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || typeof (body as Record<string, unknown>).credential !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test((body as Record<string, string>).credential)) throw new HttpException({ error: { code: 'INVALID_REQUEST', fields: ['body'] } }, 400)
    try {
      const result = await this.auth.login((body as Record<string, string>).credential, request.ip ?? 'unknown')
      const name = cookieName(request)
      setCookie(response, name, result.token, 900, name === SESSION_COOKIE)
      return { data: { actorId: result.principal.actorId, campaignId: result.principal.campaignId, runId: result.principal.runId, expiresAt: result.expiresAt } }
    } catch (error) {
      const mapped = mapAuthError(error)
      if (mapped.getStatus() === 429) response.setHeader('Retry-After', '60')
      throw mapped
    }
  }

  @Get('session')
  async session(@Req() request: Request) {
    requireEmptyRequest(request, false)
    try {
      const result = await this.auth.current(readToken(request))
      return { data: { actorId: result.principal.actorId, campaignId: result.principal.campaignId, runId: result.principal.runId, expiresAt: result.expiresAt } }
    } catch (error) { throw mapAuthError(error) }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    requireEmptyRequest(request)
    try { await this.auth.logout(readToken(request)) } catch (error) { throw mapAuthError(error) }
    const name = cookieName(request)
    setCookie(response, name, '', 0, name === SESSION_COOKIE)
  }
}

function mapAuthError(error: unknown): HttpException {
  const message = error instanceof Error ? error.message : ''
  const status = message === 'RATE_LIMITED' ? 429 : message === 'FORBIDDEN' ? 403 : message === 'INVALID_REQUEST' ? 400 : message === 'STORAGE_UNAVAILABLE' ? 503 : 401
  const code = message === 'INVALID_REQUEST' ? 'INVALID_REQUEST' : message === 'RATE_LIMITED' ? 'RATE_LIMITED' : message === 'FORBIDDEN' ? 'FORBIDDEN' : message === 'STORAGE_UNAVAILABLE' ? 'STORAGE_UNAVAILABLE' : 'UNAUTHENTICATED'
  return new HttpException({ error: { code, fields: [] } }, status)
}
