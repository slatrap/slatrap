import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';

@Injectable()
export class SimulationInternalNetworkGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.resolveClientIp(request);
    if (!clientIp || !this.isInternalIp(clientIp)) {
      throw new ForbiddenException(
        'Simulation endpoints are only accessible from internal network addresses.',
      );
    }

    return true;
  }

  private resolveClientIp(request: Request): string | null {
    return this.normalizeIp(
      request.ip ?? request.socket?.remoteAddress ?? null,
    );
  }

  private normalizeIp(ip: string | null | undefined): string | null {
    if (!ip) {
      return null;
    }

    const trimmed = ip.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('::ffff:')) {
      return trimmed.slice('::ffff:'.length);
    }

    return trimmed;
  }

  private isInternalIp(ip: string): boolean {
    if (ip === '::1') {
      return true;
    }

    const lowerIp = ip.toLowerCase();
    if (
      lowerIp.startsWith('fc') ||
      lowerIp.startsWith('fd') ||
      lowerIp.startsWith('fe80:')
    ) {
      return true;
    }

    const octets = ip.split('.').map((part) => Number(part));
    if (
      octets.length !== 4 ||
      octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return false;
    }

    const [a, b] = octets;
    return (
      a === 10 ||
      a === 127 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31)
    );
  }
}
