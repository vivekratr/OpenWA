import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

export interface MobileJwtPayload {
  sub: string;
  sessionId: string;
  role: ApiKeyRole;
  exp: number;
}

export interface MobileAuthContext {
  phone: string;
  sessionId: string;
  role: ApiKeyRole;
}

@Injectable()
export class MobileJwtService {
  private readonly secret: string;
  private readonly expiresInDays: number;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('mobile.jwtSecret') ?? 'openwa-mobile-jwt-secret-change-me';
    this.expiresInDays = this.configService.get<number>('mobile.jwtExpiresInDays') ?? 90;
  }

  sign(phone: string, sessionId: string): { token: string; expiresAt: string } {
    const exp = Math.floor(Date.now() / 1000) + this.expiresInDays * 24 * 60 * 60;
    const payload: MobileJwtPayload = {
      sub: phone,
      sessionId,
      role: ApiKeyRole.OPERATOR,
      exp,
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.secret).update(`${header}.${body}`).digest('base64url');

    return {
      token: `${header}.${body}.${signature}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  verify(token: string): MobileAuthContext {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid token');
    }

    const [header, body, signature] = parts;
    const expected = createHmac('sha256', this.secret).update(`${header}.${body}`).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException('Invalid token signature');
    }

    let payload: MobileJwtPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as MobileJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (!payload.sub || !payload.sessionId || !payload.exp) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expired');
    }

    return {
      phone: payload.sub,
      sessionId: payload.sessionId,
      role: payload.role ?? ApiKeyRole.OPERATOR,
    };
  }
}
