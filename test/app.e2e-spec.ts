import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { type AppProfile } from '../src/bootstrap/bootstrap-config';
import { createE2eApp } from './e2e-app';

describe.each<[string, AppProfile]>([
  ['production', 'production'],
  ['simulation', 'simulation'],
])('AppController (e2e, %s profile)', (_label, profile) => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createE2eApp(profile);
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
