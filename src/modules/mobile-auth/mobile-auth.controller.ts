import { Controller, Post, Get, Body, Param, Headers, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MobileAuthService } from './mobile-auth.service';
import { StartMobileAuthDto } from './dto/mobile-auth.dto';
import { Public } from '../auth/decorators/auth.decorators';

@ApiTags('mobile-auth')
@Controller('mobile/auth')
export class MobileAuthController {
  constructor(private readonly mobileAuthService: MobileAuthService) {}

  @Public()
  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start mobile auth with phone pairing code' })
  @ApiResponse({ status: 200, description: 'Pairing started' })
  async start(@Body() dto: StartMobileAuthDto) {
    return this.mobileAuthService.start(dto.phoneNumber);
  }

  @Public()
  @Get('status/:sessionId')
  @ApiOperation({ summary: 'Poll pairing / session status' })
  async status(@Param('sessionId') sessionId: string) {
    return this.mobileAuthService.getStatus(sessionId);
  }

  @Public()
  @Post('complete/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue JWT after WhatsApp session is ready' })
  async complete(@Param('sessionId') sessionId: string) {
    return this.mobileAuthService.complete(sessionId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current mobile user from JWT' })
  async me(@Headers('authorization') authHeader?: string) {
    const token = this.extractBearer(authHeader);
    return this.mobileAuthService.getMeAsync(token);
  }
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (client should discard JWT)' })
  logout() {
    return { success: true };
  }

  private extractBearer(authHeader?: string): string {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization Bearer token required');
    }
    return authHeader.substring(7);
  }
}
