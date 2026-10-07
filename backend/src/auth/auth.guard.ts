import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await verifyToken(token, { secretKey });

      if (!payload.sub) {
        throw new UnauthorizedException();
      }

      request.user = {
        id: payload.sub,
        authenticated: true,
      };

      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private extractBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return undefined;
    }

    return authorization.slice('Bearer '.length).trim() || undefined;
  }
}
