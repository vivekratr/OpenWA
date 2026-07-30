import { BadRequestException } from '@nestjs/common';
import { SessionStatus } from '../session/entities/session.entity';
import { MobileAuthService } from './mobile-auth.service';

function createService(overrides: {
  findOrCreateByPhone?: jest.Mock;
  isActive?: jest.Mock;
  start?: jest.Mock;
  stop?: jest.Mock;
  startWithPhone?: jest.Mock;
  findOne?: jest.Mock;
  getPairingCode?: jest.Mock;
}) {
  const sessionService = {
    findOrCreateByPhone: overrides.findOrCreateByPhone ?? jest.fn(),
    isActive: overrides.isActive ?? jest.fn().mockReturnValue(false),
    start: overrides.start ?? jest.fn(),
    stop: overrides.stop ?? jest.fn(),
    startWithPhone: overrides.startWithPhone ?? jest.fn(),
    findOne: overrides.findOne ?? jest.fn(),
    getPairingCode: overrides.getPairingCode ?? jest.fn(),
  };

  const service = new MobileAuthService(sessionService as never, {} as never);
  return { service, sessionService };
}

describe('MobileAuthService.start', () => {
  it('restores paired session without startWithPhone', async () => {
    const session = {
      id: 'sess-1',
      status: SessionStatus.DISCONNECTED,
      connectedAt: new Date('2026-01-01'),
    };

    const { service, sessionService } = createService({
      findOrCreateByPhone: jest.fn().mockResolvedValue(session),
      start: jest.fn().mockResolvedValue(session),
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ ...session, status: SessionStatus.INITIALIZING })
        .mockResolvedValue({ ...session, status: SessionStatus.READY }),
    });

    const result = await service.start('918208772095');

    expect(sessionService.startWithPhone).not.toHaveBeenCalled();
    expect(sessionService.start).toHaveBeenCalledWith('sess-1');
    expect(result.status).toBe(SessionStatus.READY);
  });

  it('waits when engine already starting instead of stopping it', async () => {
    const session = {
      id: 'sess-1',
      status: SessionStatus.INITIALIZING,
      connectedAt: new Date('2026-01-01'),
    };

    const { service, sessionService } = createService({
      findOrCreateByPhone: jest.fn().mockResolvedValue(session),
      isActive: jest.fn().mockReturnValue(true),
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ ...session, status: SessionStatus.INITIALIZING })
        .mockResolvedValue({ ...session, status: SessionStatus.READY }),
    });

    const result = await service.start('918208772095');

    expect(sessionService.stop).not.toHaveBeenCalled();
    expect(sessionService.start).not.toHaveBeenCalled();
    expect(result.status).toBe(SessionStatus.READY);
  });

  it('treats already-started as restore in progress', async () => {
    const session = {
      id: 'sess-1',
      status: SessionStatus.DISCONNECTED,
      connectedAt: new Date('2026-01-01'),
    };

    const { service, sessionService } = createService({
      findOrCreateByPhone: jest.fn().mockResolvedValue(session),
      start: jest
        .fn()
        .mockRejectedValue(new BadRequestException('Session is already started')),
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ ...session, status: SessionStatus.INITIALIZING })
        .mockResolvedValue({ ...session, status: SessionStatus.READY }),
    });

    const result = await service.start('918208772095');

    expect(sessionService.startWithPhone).not.toHaveBeenCalled();
    expect(result.status).toBe(SessionStatus.READY);
  });

  it('falls back to startWithPhone when restore ends in QR mode', async () => {
    const session = {
      id: 'sess-1',
      status: SessionStatus.DISCONNECTED,
      connectedAt: new Date('2026-01-01'),
    };

    const { service, sessionService } = createService({
      findOrCreateByPhone: jest.fn().mockResolvedValue(session),
      isActive: jest.fn().mockReturnValue(false),
      start: jest.fn().mockResolvedValue(session),
      startWithPhone: jest.fn().mockResolvedValue(session),
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ ...session, status: SessionStatus.QR_READY })
        .mockResolvedValueOnce({ ...session, status: SessionStatus.PAIRING_READY })
        .mockResolvedValue({ ...session, status: SessionStatus.PAIRING_READY }),
      getPairingCode: jest
        .fn()
        .mockResolvedValue({ pairingCode: 'ABCD1234', status: SessionStatus.PAIRING_READY }),
    });

    const result = await service.start('918208772095');

    expect(sessionService.startWithPhone).toHaveBeenCalledWith('sess-1', '918208772095');
    expect(result.pairingCode).toBe('ABCD1234');
    expect(result.status).toBe(SessionStatus.PAIRING_READY);
  });
});
