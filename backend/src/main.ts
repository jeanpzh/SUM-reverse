import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { LocalScenariosService } from './local-profile-dashboard/local-scenarios.service.js'
import { buildBuiltInEnrollmentScenarioBundles } from './matricula-regular/enrollment-scenarios.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  if (process.env.SUM_LOCAL_SCENARIOS === '1') {
    app.get(LocalScenariosService).configure(buildBuiltInEnrollmentScenarioBundles())
  }
  app.enableShutdownHooks()
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '127.0.0.1')
}

await bootstrap()
