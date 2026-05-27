import { Controller, Get } from '@nestjs/common';

/**
 * Root controller - serves as health check endpoint
 */
@Controller()
export class AppController {
  @Get()
  healthCheck(): { status: string } {
    return { status: 'ok' };
  }
}
