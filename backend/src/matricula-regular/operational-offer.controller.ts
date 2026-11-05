import { Body, Controller, Get, Headers, HttpCode, HttpException, Post, Req, UseFilters } from '@nestjs/common'
import type { Request } from 'express'
import { assertWriteScope } from '../programacion-academica/demo.controller.js'
import { DemoAccessService } from '../programacion-academica/demo-access.js'
import { DemoHttpErrorFilter } from '../programacion-academica/demo-http.filter.js'
import { OperationalOfferService } from './operational-offer.service.js'

@Controller('local/matricula-regular/v1/ofertas')
@UseFilters(DemoHttpErrorFilter)
export class OperationalOfferController {
  private readonly access = new DemoAccessService()

  constructor(private readonly offers: OperationalOfferService) {}

  @Get()
  async catalog(@Req() request: Request) {
    await this.access.assertAllowed(request)
    if (Object.keys(request.query).length > 0 || Number(request.headers['content-length'] ?? 0) > 0
      || request.headers['transfer-encoding'] !== undefined) {
      throw new HttpException({ error: { code: 'INVALID_REQUEST', message: 'La consulta de ofertas no acepta query ni body' } }, 400)
    }
    return this.offers.catalog()
  }

  @Post('activar')
  @HttpCode(200)
  async activate(@Req() request: Request, @Headers('origin') origin: string | undefined,
    @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.offers.activate(body)
  }
}
