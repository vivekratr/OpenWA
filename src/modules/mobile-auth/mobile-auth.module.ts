import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { MobileAuthService } from './mobile-auth.service';
import { MobileAuthController } from './mobile-auth.controller';
import { MobileJwtService } from './mobile-jwt.service';

@Module({
  imports: [SessionModule],
  controllers: [MobileAuthController],
  providers: [MobileAuthService, MobileJwtService],
  exports: [MobileAuthService, MobileJwtService],
})
export class MobileAuthModule {}
