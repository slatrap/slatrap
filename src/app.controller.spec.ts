import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = app.get<AppController>(AppController);
  });

  describe('healthCheck', () => {
    it('returns status ok', () => {
      expect(controller.healthCheck()).toEqual({ status: 'ok' });
    });
  });
});
