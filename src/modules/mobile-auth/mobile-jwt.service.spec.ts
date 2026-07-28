import { ConfigService } from '@nestjs/config';
import { MobileJwtService } from './mobile-jwt.service';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

describe('MobileJwtService', () => {
  let service: MobileJwtService;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'mobile.jwtSecret') return 'test-secret';
        if (key === 'mobile.jwtExpiresInDays') return 90;
        return defaultValue;
      }),
    } as unknown as ConfigService;

    service = new MobileJwtService(configService);
  });

  it('should sign and verify a token', () => {
    const { token } = service.sign('919876543210', 'session-uuid');
    const auth = service.verify(token);

    expect(auth.phone).toBe('919876543210');
    expect(auth.sessionId).toBe('session-uuid');
    expect(auth.role).toBe(ApiKeyRole.OPERATOR);
  });

  it('should reject tampered tokens', () => {
    const { token } = service.sign('919876543210', 'session-uuid');
    const tampered = `${token}x`;

    expect(() => service.verify(tampered)).toThrow();
  });
});
