import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Request } from 'express';

const SIMULATION_TOKEN_HEADER = 'x-simulation-token';

@Injectable()
export class SimulationInternalTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedToken = this.configService.get<string>(
      'SIMULATION_INTERNAL_TOKEN',
    );

    if (!expectedToken) {
      throw new UnauthorizedException(
        'Simulation endpoints are disabled: SIMULATION_INTERNAL_TOKEN is not configured.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const receivedToken = request.header(SIMULATION_TOKEN_HEADER);

    if (!receivedToken || receivedToken !== expectedToken) {
      throw new UnauthorizedException(
        'Missing or invalid simulation internal token.',
      );
    }

    return true;
  }
}
