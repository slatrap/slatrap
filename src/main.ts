import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppProductionModule } from './app-production.module';
import { AppSimulationModule } from './app-simulation.module';
import { resolveBootstrapConfig } from './bootstrap/bootstrap-config';

async function bootstrap() {
  const { profile } = resolveBootstrapConfig(process.env);

  const rootModule =
    profile === 'simulation' ? AppSimulationModule : AppProductionModule;
  const app = await NestFactory.create(rootModule, { rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
}
bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
