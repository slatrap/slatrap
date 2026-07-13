import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppProductionModule } from '../src/app-production.module';
import { AppSimulationModule } from '../src/app-simulation.module';
import { type AppProfile } from '../src/bootstrap/bootstrap-config';

export async function createE2eApp(
  profile: AppProfile,
): Promise<INestApplication> {
  const rootModule =
    profile === 'simulation' ? AppSimulationModule : AppProductionModule;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [rootModule],
  }).compile();

  const app = moduleFixture.createNestApplication({ rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  return app;
}
