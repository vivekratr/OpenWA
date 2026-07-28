import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { ApiKeyRole } from '../entities/api-key.entity';
import { REQUIRED_ROLE_KEY, PUBLIC_KEY } from '../decorators/auth.decorators';
import { MobileJwtService } from '../../mobile-auth/mobile-jwt.service';

export interface MobileAuthRequest {
  phone: string;
  sessionId: string;
  role: ApiKeyRole;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
    private readonly mobileJwtService: MobileJwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const xApiKey = request.headers['x-api-key'] as string | undefined;

    if (xApiKey) {
      return this.authenticateApiKey(context, request, xApiKey);
    }

    const bearerToken = this.extractBearer(request);
    if (bearerToken) {
      if (bearerToken.split('.').length === 3) {
        return this.authenticateMobileJwt(context, request, bearerToken);
      }
      return this.authenticateApiKey(context, request, bearerToken);
    }

    throw new UnauthorizedException('API key or Bearer token is required');
  }

  private async authenticateApiKey(
    context: ExecutionContext,
    request: Request,
    apiKeyHeader: string,
  ): Promise<boolean> {
    const sessionId = (request.params['sessionId'] || request.params['id']) as string | undefined;
    const clientIp = this.getClientIp(request);

    const apiKey = await this.authService.validateApiKey(apiKeyHeader, clientIp, sessionId);

    const requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRole && !this.authService.hasPermission(apiKey, requiredRole)) {
      throw new UnauthorizedException(`Insufficient permissions. Required: ${requiredRole}`);
    }

    (request as Request & { apiKey: typeof apiKey }).apiKey = apiKey;
    return true;
  }

  private authenticateMobileJwt(context: ExecutionContext, request: Request, token: string): boolean {
    const mobileAuth = this.mobileJwtService.verify(token);
    const routeSessionId = (request.params['sessionId'] || request.params['id']) as string | undefined;

    if (routeSessionId && routeSessionId !== mobileAuth.sessionId) {
      throw new ForbiddenException('You can only access your own session');
    }

    const requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRole && !this.hasMobilePermission(mobileAuth.role, requiredRole)) {
      throw new UnauthorizedException(`Insufficient permissions. Required: ${requiredRole}`);
    }

    (request as Request & { mobileAuth: MobileAuthRequest }).mobileAuth = mobileAuth;
    return true;
  }

  private hasMobilePermission(role: ApiKeyRole, requiredRole: ApiKeyRole): boolean {
    const roleHierarchy: Record<ApiKeyRole, number> = {
      [ApiKeyRole.VIEWER]: 1,
      [ApiKeyRole.OPERATOR]: 2,
      [ApiKeyRole.ADMIN]: 3,
    };

    return roleHierarchy[role] >= roleHierarchy[requiredRole];
  }

  private extractBearer(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return undefined;
    }

    return authHeader.substring(7);
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }
    return request.ip || request.socket.remoteAddress || '';
  }
}
