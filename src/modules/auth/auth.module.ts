import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiKey } from './entities/api-key.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthValidateController } from './auth-validate.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { MobileAuthModule } from '../mobile-auth/mobile-auth.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApiKey], 'main'), MobileAuthModule],
  controllers: [AuthController, AuthValidateController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
