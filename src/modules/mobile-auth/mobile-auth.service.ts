import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { SessionStatus } from '../session/entities/session.entity';
import { MobileJwtService } from './mobile-jwt.service';

@Injectable()
export class MobileAuthService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly mobileJwtService: MobileJwtService,
  ) {}

  async start(phoneNumber: string): Promise<{ sessionId: string; pairingCode?: string; status: SessionStatus }> {
    const session = await this.sessionService.findOrCreateByPhone(phoneNumber);

    if (session.status === SessionStatus.READY && this.sessionService.isActive(session.id)) {
      return { sessionId: session.id, status: SessionStatus.READY };
    }

    if (this.sessionService.isActive(session.id)) {
      await this.sessionService.stop(session.id);
    }

    const hasNeverConnected = !session.connectedAt;

    if (hasNeverConnected) {
      await this.sessionService.startWithPhone(session.id, phoneNumber);
    } else {
      await this.sessionService.start(session.id);
    }

    const updated = await this.sessionService.findOne(session.id);

    if (updated.status === SessionStatus.READY) {
      return { sessionId: session.id, status: SessionStatus.READY };
    }

    try {
      const { pairingCode, status } = await this.waitForPairingCode(session.id, 15000);
      return { sessionId: session.id, pairingCode, status };
    } catch {
      return { sessionId: session.id, status: updated.status };
    }
  }

  private async waitForPairingCode(
    sessionId: string,
    timeoutMs: number,
  ): Promise<{ pairingCode: string; status: SessionStatus }> {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const session = await this.sessionService.findOne(sessionId);

      if (session.status === SessionStatus.READY) {
        throw new BadRequestException('Session is already authenticated');
      }

      try {
        return await this.sessionService.getPairingCode(sessionId);
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    throw new BadRequestException('Pairing code is not ready yet. Poll GET /mobile/auth/status/:sessionId');
  }

  async getStatus(sessionId: string): Promise<{ status: SessionStatus; pairingCode?: string; phone?: string }> {
    const session = await this.sessionService.findOne(sessionId);

    const result: { status: SessionStatus; pairingCode?: string; phone?: string } = {
      status: session.status,
      phone: session.phone ?? undefined,
    };

    if (session.status !== SessionStatus.READY) {
      try {
        const { pairingCode } = await this.sessionService.getPairingCode(sessionId);
        result.pairingCode = pairingCode;
      } catch {
        // Pairing code not available yet
      }
    }

    return result;
  }

  async complete(sessionId: string): Promise<{
    token: string;
    expiresAt: string;
    sessionId: string;
    phone: string;
  }> {
    const session = await this.sessionService.findOne(sessionId);

    if (session.status !== SessionStatus.READY) {
      throw new BadRequestException('Session is not ready. Complete WhatsApp pairing first.');
    }

    const phone = session.phone ?? session.name;
    const { token, expiresAt } = this.mobileJwtService.sign(phone, sessionId);

    return { token, expiresAt, sessionId, phone };
  }

  async getMeAsync(token: string): Promise<{
    phone: string;
    sessionId: string;
    role: string;
    sessionStatus: SessionStatus;
    pushName?: string;
  }> {
    const auth = this.mobileJwtService.verify(token);

    let session;
    try {
      session = await this.sessionService.findOne(auth.sessionId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException('Session not found');
      }
      throw error;
    }

    return {
      phone: auth.phone,
      sessionId: auth.sessionId,
      role: auth.role,
      sessionStatus: session.status,
      pushName: session.pushName ?? undefined,
    };
  }
}
