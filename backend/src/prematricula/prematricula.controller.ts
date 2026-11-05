import { Body, Controller, Headers, HttpCode, Post, Req, UseFilters } from '@nestjs/common'
import type { Request } from 'express'
import { assertWriteScope } from '../programacion-academica/demo.controller.js'
import { DemoAccessService } from '../programacion-academica/demo-access.js'
import { PrematriculaErrorFilter } from './prematricula-error.filter.js'
import { PrematriculaService } from './prematricula.service.js'

@Controller('local/prematricula/v1')
@UseFilters(PrematriculaErrorFilter)
export class PrematriculaController {
  private readonly access = new DemoAccessService()

  constructor(private readonly prematricula: PrematriculaService) {}

  @Post('contexto')
  @HttpCode(200)
  async context(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.prematricula.getContext(body)
  }

  @Post('publicacion')
  @HttpCode(200)
  async publication(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.prematricula.getPublication(body)
  }

  @Post('validar')
  @HttpCode(200)
  async validate(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.prematricula.validate(body)
  }

  @Post('guardar')
  @HttpCode(200)
  async save(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.prematricula.save(body)
  }

  @Post('intencion/contexto')
  @HttpCode(200)
  async intentionContext(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.prematricula.getIntentionContext(body)
  }

  @Post('intencion/registrar')
  @HttpCode(200)
  async registerIntention(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.prematricula.registerIntention(body)
  }

  @Post('intencion/traslado')
  @HttpCode(200)
  async transferIntention(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.prematricula.transferIntention(body)
  }

  @Post('demanda')
  @HttpCode(200)
  async demand(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.prematricula.getDemand(body)
  }
}
