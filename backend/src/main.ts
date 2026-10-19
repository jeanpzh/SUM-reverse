import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { LocalScenariosService } from './local-profile-dashboard/local-scenarios.service.js'
import { buildBuiltInEnrollmentScenarioBundles } from './matricula-regular/enrollment-scenarios.js'

async function bootstrap() {
  if (process.env.SIMULATOR_INSECURE_COOKIE === '1') {
    const origin = process.env.SIMULATOR_PUBLIC_ORIGIN
    if (process.env.SIMULATOR_DEPLOYMENT !== 'public' || process.env.NODE_ENV === 'production' || !origin || !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
      throw new Error('SIMULATOR_INSECURE_COOKIE=1 is limited to non-production loopback public deployments')
    }
  }
  const app = await NestFactory.create(AppModule)
  if (process.env.SUM_LOCAL_SCENARIOS === '1') {
    app.get(LocalScenariosService).configure(buildBuiltInEnrollmentScenarioBundles())
  }
  app.enableShutdownHooks()
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '127.0.0.1')
}

await bootstrap()
